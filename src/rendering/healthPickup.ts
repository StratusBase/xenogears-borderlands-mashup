import * as THREE from 'three';
import { createComicMaterial } from './materials';
import { createLootEffects } from './lootEffects';

function medicalCross(): THREE.ExtrudeGeometry {
  const arm = 0.035;
  const span = 0.12;
  const shape = new THREE.Shape();
  shape.moveTo(-arm, span);
  shape.lineTo(arm, span);
  shape.lineTo(arm, arm);
  shape.lineTo(span, arm);
  shape.lineTo(span, -arm);
  shape.lineTo(arm, -arm);
  shape.lineTo(arm, -span);
  shape.lineTo(-arm, -span);
  shape.lineTo(-arm, -arm);
  shape.lineTo(-span, -arm);
  shape.lineTo(-span, arm);
  shape.lineTo(-arm, arm);
  shape.closePath();
  // One solid cross avoids intersecting bars and coincident front faces.
  return new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: false, steps: 1, curveSegments: 1 });
}

/** Body is child zero so the game's usual pickup bob/spin works without special handling. */
export function createHealthPickup(): THREE.Group {
  const pickup = new THREE.Group();
  pickup.name = 'health-pickup';

  const body = new THREE.Group();
  body.name = 'medical-supply-body';
  body.position.y = 0.4;
  const white = createComicMaterial(0xf6eee1);
  const red = createComicMaterial(0xe93f40);
  const dark = createComicMaterial(0x34333a);
  // Solid red symbols stay readable rather than inheriting panel-edge paint UVs.
  const symbol = createComicMaterial(0xf1373e);
  symbol.map = null;

  const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.36), white);
  pouch.name = 'medical-case';
  body.add(pouch);

  // The cap overlaps inside the case, with its exterior faces offset from it.
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.06, 0.38), red);
  cap.name = 'medical-cap';
  cap.position.y = 0.22;
  body.add(cap);

  const front = new THREE.Mesh(medicalCross(), symbol);
  front.name = 'medical-cross-front';
  front.position.z = 0.181;
  const back = new THREE.Mesh(medicalCross(), symbol);
  back.name = 'medical-cross-back';
  back.position.z = -0.181;
  back.rotation.y = Math.PI;
  body.add(front, back);

  for (const side of [-1, 1]) {
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.15, 0.39), dark);
    latch.name = `medical-latch-${side < 0 ? 'left' : 'right'}`;
    latch.position.set(side * 0.265, 0.04, 0);
    body.add(latch);
  }
  body.traverse(object => {
    if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; }
  });

  const glow = createLootEffects(0xff424a);
  glow.name = 'medical-supply-glow';
  glow.scale.set(0.8, 0.35, 0.8);
  pickup.add(body, glow);
  return pickup;
}
