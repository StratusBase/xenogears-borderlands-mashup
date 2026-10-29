import * as THREE from 'three';
import type { ElementType } from '../core/arsenal';

export interface ElementCoatingOptions {
  scope?: 'enemy' | 'equipment';
  intensity?: number;
  /** Idle gear uses designed emitters; active enemy conditions cover hit armor. */
  surfaceOnly?: boolean;
  variant?: number;
}

const elementIndex: Record<ElementType, number> = { kinetic: -1, corrosive: 0, fire: 1, ice: 2, shock: 3, radiation: 4, gravity: 5, adhesive: 6 };
const vertexShader = /* glsl */ `
  uniform vec3 boundsMin;
  uniform vec3 boundsSize;
  uniform float normalOffset;
  varying vec3 vSurface;
  varying vec3 vViewNormal;
  void main() {
    vSurface = (position - boundsMin) / boundsSize;
    vViewNormal = normalize(normalMatrix * normal);
    vec3 coated = position + normalize(normal) * normalOffset;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(coated, 1.0);
  }
`;
const fragmentShader = /* glsl */ `
  uniform float elementKind;
  uniform float time;
  uniform float intensity;
  uniform float seed;
  varying vec3 vSurface;
  varying vec3 vViewNormal;

  float hash(vec3 p) {
    p = fract(p * .1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
                   mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                   mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
  }
  void main() {
    vec3 p = vSurface + vec3(seed, seed * .71, seed * .37);
    float broad = noise(p * 3.7);
    float fine = noise(p * 11.0);
    float surfacePattern = broad * .78 + fine * .22;
    float coverage = 0.0;
    vec3 color = vec3(0.0);
    float glow = 0.0;

    if (elementKind < .5) {
      // Thick wet acid islands leave visible original armor between patches.
      float drips = noise(vec3(p.x * 9.0, p.y * 1.3 + time * .22, p.z * 9.0));
      float wet = smoothstep(.44, .53, surfacePattern);
      float streak = smoothstep(.66, .74, drips) * smoothstep(.0, .35, vSurface.y);
      coverage = max(wet, streak);
      vec3 rim = vec3(.055, .24, .006);
      vec3 toxic = vec3(.42, 1.0, .012);
      color = mix(rim, toxic, smoothstep(.44, .59, surfacePattern + streak * .2));
      float sheen = pow(max(0.0, dot(normalize(vViewNormal), normalize(vec3(-.3,.5,1.0)))), 12.0);
      float movingShine = pow(max(0.0, sin(vSurface.y * 12.0 + time * 1.7 + seed)), 16.0);
      color += vec3(.5, .8, .15) * sheen * (.28 + movingShine * .6);
      glow = streak * .22;
    } else if (elementKind < 1.5) {
      float cracks = 1.0 - smoothstep(.05, .17, abs(sin(p.x * 13.0 + p.z * 9.0 + broad * 7.0)));
      coverage = max(cracks, smoothstep(.60, .7, surfacePattern) * .9);
      float hot = .65 + sin(time * 4.0 + p.y * 8.0) * .2;
      color = mix(vec3(.8,.015,.001), vec3(1.5,.62,.035), cracks * hot);
      glow = cracks * .3;
    } else if (elementKind < 2.5) {
      float frost = smoothstep(.42, .60, surfacePattern);
      float fractures = pow(1.0 - abs(sin(p.x * 17.0 + p.z * 11.0 + p.y * 7.0)), 9.0);
      coverage = max(frost * .93, fractures * .8);
      color = mix(vec3(.16,.5,.7), vec3(.86,1.1,1.2), fine * .7 + fractures * .5);
      glow = .15 + sin(time * 1.7 + seed) * .06;
    } else if (elementKind < 3.5) {
      float veins = 1.0 - smoothstep(.055, .18, abs(sin((p.x+p.z)*18.0 + p.y*8.0 + broad*8.0)));
      float branches = 1.0 - smoothstep(.03, .10, abs(sin(p.y*25.0-p.x*7.0+fine*6.0)));
      coverage = max(veins, branches * .65);
      float pulse = .7 + .3 * sin(time*17.0 + seed);
      color = mix(vec3(.025,.26,1.15), vec3(.75,1.25,1.6), veins * pulse);
      glow = .25 * pulse;
    } else if (elementKind < 4.5) {
      coverage = smoothstep(.48, .60, surfacePattern);
      float pulse = .75 + sin(time * 3.7 + seed) * .25;
      color = mix(vec3(.23,.38,.005), vec3(1.1,1.25,.075), fine * .7 + pulse * .3);
      glow = pulse * .2;
    } else if (elementKind < 5.5) {
      vec2 centered = vSurface.xz - .5;
      float spiral = sin(length(centered)*25.0 - atan(centered.y, centered.x)*2.0 - time*2.3 + vSurface.y*5.0);
      coverage = smoothstep(.66,.85,spiral) * .95;
      color = mix(vec3(.12,.015,.34), vec3(.75,.25,1.4), fine);
      glow = .3;
    } else {
      float strings = noise(vec3(p.x * 9.0, p.y * 1.4 + time * .08, p.z * 9.0));
      coverage = max(smoothstep(.48,.60,surfacePattern), smoothstep(.69,.78,strings));
      color = mix(vec3(.45,.17,.015), vec3(1.1,.72,.12), surfacePattern);
      float shine = pow(max(0.0, dot(normalize(vViewNormal), normalize(vec3(.3,.6,1.0)))),18.0);
      color += vec3(.5,.4,.15) * shine;
    }
    float opacity = coverage * min(1.0, intensity) * .98;
    if (opacity < .045) discard;
    float facet = .78 + abs(normalize(vViewNormal).y) * .15 + max(0.0,normalize(vViewNormal).z) * .07;
    gl_FragColor = vec4(color * (facet + glow), opacity);
  }
`;

function overlayAncestor(object: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) if (node.userData.comicOverlay === true) return true;
  return false;
}

function nearestOwner(object: THREE.Object3D): unknown {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    if (node.userData.visualOwner !== undefined) return node.userData.visualOwner;
  }
  return undefined;
}

/** Borrows physical surfaces; coatings own only their overlay meshes and shader materials. */
export class ElementCoating {
  readonly overlays: THREE.Mesh[] = [];
  private elapsed = 0;
  private disposed = false;

  constructor(root: THREE.Object3D, readonly element: ElementType, options: ElementCoatingOptions = {}) {
    if (element === 'kinetic') return;
    const scope = options.scope ?? 'enemy';
    const intensity = THREE.MathUtils.clamp(Number.isFinite(options.intensity) ? options.intensity! : 1, 0, 2);
    const sources: THREE.Mesh[] = [];
    // Snapshot first: never recurse into newly attached overlays or another coating's surfaces.
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || overlayAncestor(object)) return;
      if (scope === 'enemy' ? Number.isFinite(object.userData.enemyId) && typeof object.userData.enemyId === 'number'
        : nearestOwner(object) === 'weapon' && (!options.surfaceOnly || object.userData.equipmentElementSurface === element)) sources.push(object);
    });
    sources.forEach((source, index) => {
      const geometry = source.geometry;
      if (!geometry.getAttribute('position') || !geometry.getAttribute('normal')) return;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const bounds = geometry.boundingBox!;
      if (bounds.isEmpty()) return;
      const size = bounds.getSize(new THREE.Vector3()); size.set(Math.max(.0001,size.x), Math.max(.0001,size.y), Math.max(.0001,size.z));
      const originalMaterial = Array.isArray(source.material) ? source.material[0] : source.material;
      const material = new THREE.ShaderMaterial({
        name: `ElementCoating-${element}`, vertexShader, fragmentShader,
        uniforms: {
          boundsMin: { value: bounds.min.clone() }, boundsSize: { value: size },
          normalOffset: { value: scope === 'enemy' ? .005 : .0035 },
          elementKind: { value: elementIndex[element] }, time: { value: 0 }, intensity: { value: intensity }, seed: { value: index * 1.718 + .319 + (options.variant ?? 0) * .37 },
        },
        transparent: true, depthTest: true, depthWrite: false, toneMapped: false,
        side: originalMaterial?.side ?? THREE.FrontSide,
      });
      const overlay = new THREE.Mesh(geometry, material);
      overlay.name = `element-coating-${element}-${source.name || index}`;
      overlay.userData.comicOverlay = true; overlay.userData.elementCoating = true;
      overlay.userData.element = element; overlay.userData.borrowedGeometry = true;
      overlay.raycast = () => {};
      overlay.castShadow = overlay.receiveShadow = false;
      source.add(overlay); this.overlays.push(overlay);
    });
  }

  update(dt: number, time?: number): void {
    if (this.disposed || !Number.isFinite(dt) || dt <= 0) return;
    this.elapsed += dt;
    for (const overlay of this.overlays) (overlay.material as THREE.ShaderMaterial).uniforms.time.value = Number.isFinite(time) ? time! : this.elapsed;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const overlay of this.overlays) { overlay.removeFromParent(); (overlay.material as THREE.Material).dispose(); }
    this.overlays.length = 0;
  }
}
