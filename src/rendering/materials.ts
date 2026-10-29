import * as THREE from 'three';

export type PaintFinish = 'armor' | 'rock' | 'ground';

/** Banded direct light applies to sun-facing surfaces; hemisphere light supplies shadow fill. */
export function createComicToonMaterial(options: THREE.MeshToonMaterialParameters): THREE.MeshToonMaterial {
  const material = new THREE.MeshToonMaterial(options);
  material.customProgramCacheKey = () => 'front-facing-comic-light-v1';
  material.onBeforeCompile = shader => {
    const directLightChunk = THREE.ShaderChunk.lights_toon_pars_fragment.replace(
      'getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color',
      'getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color * step( 0.0, dot( geometryNormal, directLight.direction ) )',
    );
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_toon_pars_fragment>', directLightChunk);
  };
  return material;
}

export function createBandTexture(): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array([
    27, 27, 27, 255,
    105, 105, 105, 255,
    255, 255, 255, 255,
  ]), 3, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Seeded dry-brush, paint chips and hatch marks; no external art or random shimmer. */
export function createPaintTexture(finish: PaintFinish, seed = 73): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  ctx.fillStyle = finish === 'ground' ? '#eee1c3' : '#f6e9cf';
  ctx.fillRect(0, 0, 256, 256);

  // Broad unequal strokes keep the surface painted rather than smooth plastic.
  for (let i = 0; i < (finish === 'ground' ? 260 : 125); i++) {
    const x = random() * 256;
    const y = random() * 256;
    const value = random();
    ctx.fillStyle = value < 0.5 ? 'rgba(53,39,35,0.09)' : 'rgba(255,252,228,0.17)';
    ctx.fillRect(x, y, 5 + random() * (finish === 'rock' ? 75 : 35), 1 + random() * 5);
  }

  if (finish === 'armor') {
    // Inked panel rims and rubbed edges are part of the paint, not a 1px GL line.
    ctx.fillStyle = 'rgba(32,25,28,0.73)';
    ctx.fillRect(3, 4, 249, 3);
    ctx.fillRect(4, 4, 3, 247);
    ctx.fillRect(4, 249, 247, 3);
    ctx.fillRect(249, 4, 3, 248);
    for (let i = 0; i < 100; i++) {
      const x = random() * 250;
      const edge = random() > 0.5 ? 8 + random() * 8 : 238 + random() * 10;
      ctx.fillStyle = i % 3 === 0 ? '#fdf1d6' : 'rgba(40,30,29,0.55)';
      ctx.fillRect(x, edge, 2 + random() * 13, 1 + random() * 3);
    }
    for (let line = 0; line < 13; line++) {
      for (let step = 0; step < 38; step++) {
        const x = 15 + line * 5 + step;
        const y = 166 + step;
        ctx.fillStyle = 'rgba(38,28,30,0.29)';
        ctx.fillRect(x, y, 1.4, 2);
      }
    }
    ctx.fillStyle = 'rgba(40,27,26,0.30)';
    ctx.fillRect(177, 36, 40, 3);
    ctx.fillRect(187, 42, 30, 2);
    ctx.fillRect(195, 48, 22, 2);
  } else if (finish === 'rock') {
    // Interrupted sediment lines, imperfect angles, and brushy shaded cracks.
    for (let layer = 0; layer < 9; layer++) {
      const y = 13 + layer * 29 + random() * 8;
      for (let step = 0; step < 42; step++) {
        if (random() > 0.78) continue;
        ctx.fillStyle = layer % 3 === 0 ? 'rgba(50,28,29,0.46)' : 'rgba(74,40,26,0.24)';
        ctx.fillRect(step * 6, y + Math.sin(step * 0.24 + layer) * 3, 7, layer % 3 === 0 ? 2 : 1);
      }
    }
    for (let i = 0; i < 16; i++) {
      const x = random() * 256;
      const y = random() * 256;
      const length = 13 + random() * 25;
      for (let step = 0; step < length; step++) {
        ctx.fillStyle = 'rgba(55,32,31,0.25)';
        ctx.fillRect(x + step * 0.47, y + step, 1.5, 2);
      }
    }
  } else {
    // Sparse sandy specks stay quiet enough that silhouettes carry the image.
    for (let i = 0; i < 230; i++) {
      ctx.fillStyle = i % 3 ? 'rgba(75,48,26,0.10)' : 'rgba(255,249,217,0.28)';
      ctx.fillRect(random() * 256, random() * 256, 1 + random() * 3, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

let sharedBands: THREE.DataTexture | undefined;
const sharedPaint = new Map<PaintFinish, THREE.CanvasTexture>();

/** For weapons and robots: the same banded paint treatment as the environment. */
export function createComicMaterial(color: THREE.ColorRepresentation, finish: PaintFinish = 'armor'): THREE.MeshToonMaterial {
  sharedBands ??= createBandTexture();
  if (!sharedPaint.has(finish)) sharedPaint.set(finish, createPaintTexture(finish));
  return createComicToonMaterial({ color, gradientMap: sharedBands, map: sharedPaint.get(finish)! });
}
