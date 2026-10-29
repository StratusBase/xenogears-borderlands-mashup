import * as THREE from 'three';
import { createComicToonMaterial } from './materials';

/** World-space paint dimensions. They describe albedo, never additional geometry. */
export const groundLayout = {
  roads: {
    horizontal: { center: [0, 1] as const, size: [180, 14] as const },
    vertical: { center: [0, -19] as const, size: [18, 70] as const },
  },
  lanes: {
    horizontal: { start: -84, end: 84, spacing: 8, length: 3.4, width: 0.22, center: 1 },
    vertical: { start: -49, end: 50, spacing: 9, length: 3.4, width: 0.22, center: 0 },
  },
  hazards: { centers: [-35, 35] as const, width: 1.15, length: 110, stripePeriod: 3.2 },
  boarding: { center: [6, 8] as const, radius: 4.5, stripeOffset: 3.6, stripeWidth: 0.2, stripeLength: 4.6 },
  repair: { center: [0, 16] as const, radius: 3.7 },
  heavyPatch: { center: [50, -4] as const, size: [8, 9] as const },
} as const;

const rectangle = (shape: { center: readonly [number, number]; size: readonly [number, number] }) =>
  new THREE.Vector4(shape.center[0], shape.center[1], shape.size[0] / 2, shape.size[1] / 2);

const paintFunctions = /* glsl */ `
  varying vec2 vGroundXZ;
  uniform vec4 groundRoadHorizontal;
  uniform vec4 groundRoadVertical;
  uniform vec4 groundHeavyPatch;
  uniform vec4 groundLaneHorizontal;
  uniform vec4 groundLaneVertical;
  uniform vec4 groundLaneExtent;
  uniform vec2 groundLaneWidth;
  uniform vec4 groundHazards;
  uniform float groundHazardStripePeriod;
  uniform vec4 groundBoarding;
  uniform vec4 groundBoardingStripes;
  uniform vec4 groundRepair;
  uniform vec3 groundRoadColor;
  uniform vec3 groundHeavyColor;
  uniform vec3 groundLaneColor;
  uniform vec3 groundInkColor;
  uniform vec3 groundYellowColor;
  uniform vec3 groundBoardingColor;
  uniform vec3 groundRepairColor;

  float groundBoxDistance(vec2 p, vec4 box) {
    vec2 d = abs(p - box.xy) - box.zw;
    return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0);
  }

  float groundCoverage(float signedDistance) {
    float antialias = max(fwidth(signedDistance), 0.0001);
    return 1.0 - smoothstep(-antialias, antialias, signedDistance);
  }

  float groundDashDistance(float coordinate, float first, float spacing, float halfLength) {
    float offset = mod(coordinate - first + spacing * 0.5, spacing) - spacing * 0.5;
    return abs(offset) - halfLength;
  }

  vec3 groundPaint(vec2 p, vec3 sand) {
    // Paint the union once. No independent overlapping slabs or texture origins
    // meet at the crossroads, so no depth or color seam exists there.
    float roadDistance = min(groundBoxDistance(p, groundRoadHorizontal), groundBoxDistance(p, groundRoadVertical));
    vec3 color = mix(sand, groundRoadColor, groundCoverage(roadDistance));
    color = mix(color, groundHeavyColor, groundCoverage(groundBoxDistance(p, groundHeavyPatch)));

    float horizontalDash = max(
      max(groundDashDistance(p.x, groundLaneHorizontal.x, groundLaneHorizontal.y, groundLaneHorizontal.z), abs(p.y - groundLaneHorizontal.w) - groundLaneWidth.x),
      max(groundLaneExtent.x - p.x, p.x - groundLaneExtent.y)
    );
    float verticalDash = max(
      max(groundDashDistance(p.y, groundLaneVertical.x, groundLaneVertical.y, groundLaneVertical.z), abs(p.x - groundLaneVertical.w) - groundLaneWidth.y),
      max(groundLaneExtent.z - p.y, p.y - groundLaneExtent.w)
    );
    color = mix(color, groundLaneColor, groundCoverage(min(horizontalDash, verticalDash)));

    float boardingRadius = length(p - groundBoarding.xy);
    float boardingCoverage = groundCoverage(boardingRadius - groundBoarding.z);
    vec3 boardingColor = groundBoardingColor;
    float boardingStripe = min(
      groundBoxDistance(p, vec4(groundBoarding.xy + vec2(groundBoardingStripes.x, 0.0), groundBoardingStripes.yz)),
      groundBoxDistance(p, vec4(groundBoarding.xy - vec2(groundBoardingStripes.x, 0.0), groundBoardingStripes.yz))
    );
    float boardingRing = abs(boardingRadius - (groundBoarding.z - 0.18)) - 0.055;
    boardingColor = mix(boardingColor, groundYellowColor, groundCoverage(min(boardingStripe, boardingRing)));
    color = mix(color, boardingColor, boardingCoverage);

    float repairRadius = length(p - groundRepair.xy);
    float repairCoverage = groundCoverage(repairRadius - groundRepair.z);
    float repairSymbol = min(
      groundBoxDistance(p, vec4(groundRepair.xy, 0.18, 1.05)),
      groundBoxDistance(p, vec4(groundRepair.xy, 1.05, 0.18))
    );
    float repairRing = abs(repairRadius - (groundRepair.z - 0.18)) - 0.055;
    vec3 repairColor = mix(groundRepairColor, groundLaneColor, groundCoverage(min(repairSymbol, repairRing)));
    color = mix(color, repairColor, repairCoverage);

    // Alternating diagonal ribbons fill the entire narrow band continuously.
    // The mask clips every ribbon to the same band; there are no yellow plates.
    float hazardDistance = min(
      groundBoxDistance(p, vec4(groundHazards.x, 0.0, groundHazards.z, groundHazards.w)),
      groundBoxDistance(p, vec4(groundHazards.y, 0.0, groundHazards.z, groundHazards.w))
    );
    float stripePhase = (p.y + p.x) / groundHazardStripePeriod;
    float stripeAA = max(fwidth(stripePhase) * 6.2831853, 0.0001);
    float yellow = smoothstep(-stripeAA, stripeAA, sin(stripePhase * 6.2831853));
    vec3 hazardColor = mix(groundInkColor, groundYellowColor, yellow);
    return mix(color, hazardColor, groundCoverage(hazardDistance));
  }
`;

/** One lit terrain surface, with analytic, antialiased world-space paint in albedo. */
export function createGroundMaterial(options: THREE.MeshToonMaterialParameters): THREE.MeshToonMaterial {
  const material = createComicToonMaterial(options);
  const configureLighting = material.onBeforeCompile.bind(material);
  const lightingCacheKey = material.customProgramCacheKey();
  material.name = 'painted-terrain-material';
  material.userData.surfacePaint = groundLayout;
  material.customProgramCacheKey = () => `${lightingCacheKey}:world-xz-ground-paint-v1`;
  material.onBeforeCompile = (shader, renderer) => {
    configureLighting(shader, renderer);
    Object.assign(shader.uniforms, {
      groundRoadHorizontal: { value: rectangle(groundLayout.roads.horizontal) },
      groundRoadVertical: { value: rectangle(groundLayout.roads.vertical) },
      groundHeavyPatch: { value: rectangle(groundLayout.heavyPatch) },
      groundLaneHorizontal: { value: new THREE.Vector4(groundLayout.lanes.horizontal.start, groundLayout.lanes.horizontal.spacing, groundLayout.lanes.horizontal.length / 2, groundLayout.lanes.horizontal.center) },
      groundLaneVertical: { value: new THREE.Vector4(groundLayout.lanes.vertical.start, groundLayout.lanes.vertical.spacing, groundLayout.lanes.vertical.length / 2, groundLayout.lanes.vertical.center) },
      groundLaneExtent: { value: new THREE.Vector4(groundLayout.lanes.horizontal.start - groundLayout.lanes.horizontal.length / 2, groundLayout.lanes.horizontal.end + groundLayout.lanes.horizontal.length / 2, groundLayout.lanes.vertical.start - groundLayout.lanes.vertical.length / 2, groundLayout.lanes.vertical.end + groundLayout.lanes.vertical.length / 2) },
      groundLaneWidth: { value: new THREE.Vector2(groundLayout.lanes.horizontal.width / 2, groundLayout.lanes.vertical.width / 2) },
      groundHazards: { value: new THREE.Vector4(groundLayout.hazards.centers[0], groundLayout.hazards.centers[1], groundLayout.hazards.width / 2, groundLayout.hazards.length / 2) },
      groundHazardStripePeriod: { value: groundLayout.hazards.stripePeriod },
      groundBoarding: { value: new THREE.Vector4(groundLayout.boarding.center[0], groundLayout.boarding.center[1], groundLayout.boarding.radius, 0) },
      groundBoardingStripes: { value: new THREE.Vector4(groundLayout.boarding.stripeOffset, groundLayout.boarding.stripeWidth / 2, groundLayout.boarding.stripeLength / 2, 0) },
      groundRepair: { value: new THREE.Vector4(groundLayout.repair.center[0], groundLayout.repair.center[1], groundLayout.repair.radius, 0) },
      groundRoadColor: { value: new THREE.Color(0xb99060) },
      groundHeavyColor: { value: new THREE.Color(0x9c805e) },
      groundLaneColor: { value: new THREE.Color(0xf5dea4) },
      groundInkColor: { value: new THREE.Color(0x221c23) },
      groundYellowColor: { value: new THREE.Color(0xffc23f) },
      groundBoardingColor: { value: new THREE.Color(0x646b60) },
      groundRepairColor: { value: new THREE.Color(0x167f89) },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGroundXZ;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGroundXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${paintFunctions}`)
      .replace('#include <map_fragment>', /* glsl */ `
        #include <map_fragment>
        vec3 groundTexture = diffuseColor.rgb / max(diffuse, vec3(0.0001));
        diffuseColor.rgb = groundPaint(vGroundXZ, diffuse) * groundTexture;
      `);
  };
  return material;
}
