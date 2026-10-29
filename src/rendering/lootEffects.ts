import * as THREE from 'three';

const beamVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 cameraRight = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
    float widthScale = length(modelMatrix[0].xyz);
    float heightScale = length(modelMatrix[1].xyz);
    vec3 world = center + cameraRight * position.x * widthScale + vec3(0.0, 1.0, 0.0) * position.y * heightScale;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

/** A softly shaded billboard column and ground glow; the pickup body is separate. */
export function createLootEffects(color: THREE.ColorRepresentation): THREE.Group {
  const group = new THREE.Group();
  group.name = 'loot-effects';
  group.userData.comicOverlay = true;
  const tint = new THREE.Color(color);
  const beamMaterial = new THREE.ShaderMaterial({
    name: 'SoftLootColumn',
    uniforms: { tint: { value: tint } },
    vertexShader: beamVertex,
    fragmentShader: /* glsl */ `
      uniform vec3 tint;
      varying vec2 vUv;
      void main() {
        float radius = abs(vUv.x - 0.5) * 2.0;
        float halo = exp(-radius * radius * 5.5) * (1.0 - smoothstep(0.7, 1.0, radius));
        float core = exp(-radius * radius * 85.0);
        float heightFade = smoothstep(0.0, 0.06, vUv.y) * (1.0 - smoothstep(0.40, 1.0, vUv.y));
        float alpha = (halo * 0.23 + core * 0.43) * heightFade;
        if (alpha < 0.001) discard;
        gl_FragColor = vec4(tint * (1.15 + core * 0.7), alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 3.4), beamMaterial);
  beam.name = 'soft-loot-beam';
  beam.position.y = 1.75;
  beam.userData.comicOverlay = true;
  beam.castShadow = false;
  beam.receiveShadow = false;

  const ringMaterial = new THREE.ShaderMaterial({
    name: 'SoftLootGroundRing',
    uniforms: { tint: { value: tint } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 tint;
      varying vec2 vUv;
      void main() {
        float radius = length(vUv * 2.0 - 1.0);
        float ring = exp(-pow((radius - 0.67) / 0.09, 2.0));
        float aura = exp(-radius * radius * 4.0);
        float alpha = (ring * 0.62 + aura * 0.11) * (1.0 - smoothstep(0.90, 1.0, radius));
        if (alpha < 0.001) discard;
        gl_FragColor = vec4(tint * 1.4, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.45), ringMaterial);
  ring.name = 'soft-loot-ring';
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.018;
  ring.userData.comicOverlay = true;
  ring.castShadow = false;
  ring.receiveShadow = false;
  group.add(beam, ring);
  return group;
}
