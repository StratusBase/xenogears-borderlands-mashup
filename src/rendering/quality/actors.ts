import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addBox, addCylinder, createQualityMaterial } from './primitives';

/** Presentation never moves the simulation root, the gameplay hitboxes, or equipment. */
export interface ActorPresentation {
  readonly group: THREE.Group;
  update(time: number, dt: number, speed?: number, fireAge?: number, hitAge?: number): void;
  dispose(): void;
}

const noRaycast: THREE.Mesh['raycast'] = () => {};

function rigid(parent: THREE.Object3D, name: string, y = 0): THREE.Group {
  const result = new THREE.Group(); result.name = name; result.position.y = y;
  result.userData.visualOwner = 'body'; parent.add(result); return result;
}

/** One draw per material per rigid assembly, retaining articulated joints. */
function batch(group: THREE.Group): void {
  const batches = new Map<THREE.Material, THREE.Mesh[]>();
  for (const object of [...group.children]) {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) continue;
    const meshes = batches.get(object.material) ?? []; meshes.push(object); batches.set(object.material, meshes);
  }
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) { meshes[0].raycast = noRaycast; continue; }
    const copies = meshes.map(mesh => {
      mesh.updateMatrix();
      const copy = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      return copy.applyMatrix4(mesh.matrix);
    });
    const merged = mergeGeometries(copies, false);
    copies.forEach(geometry => geometry.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material); mesh.name = `${group.name}-${material.name || 'rigid-surfaces'}`;
    mesh.castShadow = mesh.receiveShadow = true; mesh.raycast = noRaycast;
    mesh.userData.authoredParts = meshes.map(source => source.name);
    meshes.forEach(source => { source.geometry.dispose(); source.removeFromParent(); });
    group.add(mesh);
  }
  for (const child of group.children) if (child instanceof THREE.Group) batch(child);
}

function disposeOwned(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
  });
  geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
  group.removeFromParent();
}

function line(parent: THREE.Object3D, name: string, from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material): THREE.Mesh {
  const length = from.distanceTo(to), center = from.clone().add(to).multiplyScalar(.5);
  const mesh = addCylinder(parent, name, radius, length, [center.x, center.y, center.z], material, 'y', 8);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()); return mesh;
}

/** A chamfered extrusion gives load-bearing armor a real tapered profile. */
function tapered(parent: THREE.Object3D, name: string, widths: readonly [number, number], height: number, depth: number, position: readonly [number, number, number], material: THREE.Material, bevel = .035): THREE.Mesh {
  const [top,bottom] = widths, h=height*.5, chamfer=Math.min(height*.16,Math.min(top,bottom)*.16);
  const shape = new THREE.Shape();
  shape.moveTo(-bottom*.5+chamfer,-h); shape.lineTo(bottom*.5-chamfer,-h);
  shape.lineTo(bottom*.5,-h+chamfer); shape.lineTo(top*.5,h-chamfer);
  shape.lineTo(top*.5-chamfer,h); shape.lineTo(-top*.5+chamfer,h);
  shape.lineTo(-top*.5,h-chamfer); shape.lineTo(-bottom*.5,-h+chamfer); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape,{depth:Math.max(.005,depth-2*bevel),bevelEnabled:bevel>0,bevelSegments:1,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:1});
  geometry.translate(0,0,-depth*.5+bevel);
  const mesh=new THREE.Mesh(geometry,material); mesh.name=name; mesh.position.set(...position); mesh.castShadow=mesh.receiveShadow=true; parent.add(mesh); return mesh;
}

function nearestSlot(object: THREE.Object3D, root: THREE.Object3D): unknown {
  for (let node: THREE.Object3D | null = object; node && node !== root; node = node.parent) {
    if (node.userData.equipmentSlot || (node.userData.visualOwner && node.userData.visualOwner !== 'body')) return node.userData.equipmentSlot ?? node.userData.visualOwner;
  }
  return undefined;
}

/**
 * Original industrial sentry. Rendering is replaced; all seven original combat
 * meshes retain exact geometry, matrices, enemyId, critical tags and raycasts.
 * The transparent proxy material suppresses color/depth/shadow only. It does
 * not use visible=false, which would remove the proxy from swept collision.
 */
export function decorateEnemy(root: THREE.Group, id: number, heavy = false): ActorPresentation {
  const existing = root.getObjectByName('reference-sentry');
  if (existing) throw new Error('Enemy presentation already attached. Dispose it before replacing.');
  const proxies: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[]; cast: boolean; receive: boolean }[] = [];
  const proxyMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, opacity: 0 });
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object.userData.enemyId !== id) return;
    proxies.push({ mesh: object, material: object.material, cast: object.castShadow, receive: object.receiveShadow });
    object.material = proxyMaterial; object.castShadow = object.receiveShadow = false;
  });
  const model = rigid(root, 'reference-sentry'); model.userData.referenceAsset = 'sentry';
  const armor = createQualityMaterial(heavy ? 0xae4938 : 0xd6b887, 'paint');
  const trim = createQualityMaterial(0xa0aaa3, 'metal');
  const steel = createQualityMaterial(0xc0c9c0, 'metal');
  const dark = createQualityMaterial(0x222b30, 'rubber');
  const red = createQualityMaterial(0xff4a24, 'light');
  const black = createQualityMaterial(0x121a20, 'rubber');
  const ochre = createQualityMaterial(0xe7a746, 'paint');
  const body = rigid(model, 'sentry-upper-suspension', 1.05);
  addBox(body, 'sentry-load-bearing-spine', [.31, .92, .38], [0, .42, -.20], dark, .055);
  tapered(body, 'sentry-tapered-receiver', [.95,.61], .85, .61, [0, .43, 0], armor, .045);
  tapered(body, 'sentry-front-breastplate', [.71,.50], .40, .11, [0, .57, .34], armor, .023).rotation.x = -.14;
  addBox(body, 'sentry-abdominal-bellows', [.47, .19, .43], [0, -.04, .02], black, .035);
  for (let i = 0; i < 3; i++) addBox(body, 'sentry-cooling-louver', [.38, .035, .027], [0, .31 + i * .09, .345], dark, .007);
  addBox(body, 'sentry-warning-bar', [.34, .045, .03], [0, .78, .35], ochre, .008);
  // A protected, single red optic is the only critical cue.
  addCylinder(body, 'sentry-neck-bearing', .14, .20, [0, .95, -.01], steel);
  tapered(body, 'sentry-optic-cowl', [.61,.43], .40, .55, [0, 1.20, .005], dark, .035);
  tapered(body, 'sentry-brow', [.66,.58], .105, .58, [0, 1.40, .045], armor, .015).rotation.x = -.12;
  addBox(body, 'sentry-weakpoint-recess', [.49, .16, .05], [0, 1.22, .312], black, .025);
  addBox(body, 'sentry-critical-optic', [.43, .095, .025], [0, 1.22, .344], red, .022);
  addBox(body, 'sentry-optic-glint', [.11, .018, .008], [-.105, 1.245, .36], createQualityMaterial(0xffb48b, 'light'), .004);
  for (const side of [-1, 1]) {
    addCylinder(body, 'sentry-shoulder-bearing', .19, .22, [side * .48, .59, 0], dark, 'x');
    tapered(body, 'sentry-shoulder-armor', [.35,.25], .26, .54, [side * .57, .76, -.025], armor, .025).rotation.z = side * -.17;
  }
  addBox(body, 'sentry-left-arm-clevis', [.23, .24, .31], [-.66, .51, .035], dark, .04);
  addCylinder(body, 'sentry-left-forearm-actuator', .085, .34, [-.66, .20, .035], trim);
  addCylinder(body, 'sentry-left-actuator-rod', .036, .27, [-.66, .04, .035], steel);
  addBox(body, 'sentry-left-arm-guard', [.13, .40, .21], [-.76, .25, .035], armor, .025);
  addBox(body, 'sentry-left-claw', [.24, .17, .27], [-.66, -.06, .09], dark, .04);
  addBox(body, 'sentry-gun-receiver', [.29, .31, .42], [.66, .51, .11], armor, .055);
  addCylinder(body, 'sentry-barrel-jacket', .13, .42, [.66, .53, .43], dark, 'z');
  addCylinder(body, 'sentry-machined-muzzle', .101, .12, [.66, .53, .68], steel, 'z');
  addCylinder(body, 'sentry-muzzle-bore', .064, .009, [.66, .53, .746], black, 'z');
  for (let i = 0; i < 3; i++) addBox(body, 'sentry-gun-vent', [.027, .095, .025], [.796, .53, .32 + i * .10], steel, .004);
  addBox(body, 'sentry-gun-feed-block', [.10, .27, .27], [.84, .39, -.035], dark, .025);
  addBox(body, 'sentry-serial-panel', [.14, .20, .018], [-.24, .58, .346], dark, .018);
  for (let i = 0; i < 2; i++) addBox(body, 'sentry-serial-stripe', [.018, .12, .008], [-.265 + i * .05, .58, .36], ochre, .003);
  const legs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = rigid(model, side < 0 ? 'sentry-left-leg' : 'sentry-right-leg', .98);
    leg.position.x = side * .32; legs.push(leg);
    addCylinder(leg, 'sentry-hip-pin', .13, .34, [0, -.03, 0], steel, 'x');
    addBox(leg, 'sentry-thigh-clevis', [.28, .42, .33], [0, -.23, -.015], dark, .045);
    addCylinder(leg, 'sentry-knee-actuator', .13, .34, [0, -.43, .06], steel, 'x');
    tapered(leg, 'sentry-shin-armor', [.27,.19], .40, .15, [0, -.64, .20], armor, .02).rotation.x = -.12;
    addBox(leg, 'sentry-calf-strut', [.17, .35, .22], [0, -.65, -.015], dark, .035);
    line(leg, 'sentry-exposed-piston', new THREE.Vector3(side * .12, -.4, .08), new THREE.Vector3(side * .12, -.82, .02), .024, steel);
    addBox(leg, 'sentry-grounded-heel', [.29, .14, .20], [0, -.91, -.08], dark, .025);
    for (const toe of [-1,1]) tapered(leg, 'sentry-split-toe', [.13,.12], .11, .30, [toe*.085, -.925, .185], trim, .015);
  }
  const flash = addCylinder(model, 'sentry-muzzle-flash', .16, .18, [.66, 1.58, .82], red, 'z', 6);
  flash.visible = false; flash.castShadow = flash.receiveShadow = false;
  flash.userData.comicOverlay = true; flash.raycast = noRaycast;
  batch(body); legs.forEach(batch);
  let phase = 0, disposed = false;
  return {
    group: model,
    update(time, dt, speed = 0, fireAge = Infinity, hitAge = Infinity) {
      if (disposed || !Number.isFinite(time) || !Number.isFinite(dt) || dt <= 0) return;
      const moving = THREE.MathUtils.clamp((Number.isFinite(speed) ? speed : 0) / (heavy ? 2 : 2.6), 0, 1);
      phase += Math.max(0, dt) * moving * (heavy ? 4.5 : 7.3);
      body.position.y = 1.05 + Math.abs(Math.sin(phase * 2)) * .019 * moving;
      body.rotation.z = Math.sin(phase) * .025 * moving;
      body.rotation.x = -.045 * moving + (hitAge >= 0 && hitAge < .22 ? Math.sin(hitAge / .22 * Math.PI) * .055 : 0);
      legs.forEach((leg, index) => {
        const stride = Math.sin(phase + index * Math.PI);
        leg.position.z = stride * .12 * moving;
        leg.position.y = .98 + Math.max(0, stride) * .055 * moving;
        leg.rotation.x = -stride * .09 * moving;
      });
      flash.visible = fireAge >= 0 && fireAge < .06;
      flash.scale.setScalar(.65 + Math.sin(time * 93) * .15);
    },
    dispose() {
      if (disposed) return; disposed = true;
      proxies.forEach(({mesh,material,cast,receive}) => { mesh.material = material; mesh.castShadow = cast; mesh.receiveShadow = receive; });
      proxyMaterial.dispose(); disposeOwned(model);
    },
  };
}

/**
 * A load-bearing six-meter chassis. All replacement surfaces belong to body;
 * weapon/shield/reactor/legs slot roots, meshes, materials and world matrices
 * are untouched. The chassis has no gameplay collision or moving root state.
 */
export function upgradeReferenceMech(root: THREE.Group): ActorPresentation {
  if (root.getObjectByName('reference-mech-body')) throw new Error('Mech presentation already attached.');
  const originals: { object: THREE.Mesh; visible: boolean }[] = [];
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || nearestSlot(object, root)) return;
    originals.push({object,visible:object.visible}); object.visible = false;
  });
  const model = rigid(root, 'reference-mech-body'); model.userData.referenceAsset = 'load-bearing-mech';
  const cream = createQualityMaterial(0xd8c8a8, 'paint');
  const teal = createQualityMaterial(0x327b78, 'paint');
  const steel = createQualityMaterial(0xc0cbc4, 'metal');
  const dark = createQualityMaterial(0x27343a, 'rubber');
  const black = createQualityMaterial(0x121e26, 'rubber');
  const glass = createQualityMaterial(0x3e8f99, 'glass');
  const light = createQualityMaterial(0x92d0d2, 'light');
  const warning = createQualityMaterial(0xe4ac4a, 'paint');
  const hips = rigid(model, 'mech-pelvis');
  addBox(hips, 'mech-pelvis-core', [1.55, .54, .97], [0, 2.65, -.025], dark, .13);
  addBox(hips, 'mech-pelvis-guard', [.72, .45, .20], [0, 2.58, .57], teal, .085);
  addCylinder(hips, 'mech-spine-turntable', .54, .31, [0, 2.99, 0], steel);
  const torso = rigid(model, 'mech-weighted-torso', 3.0);
  tapered(torso, 'mech-chest-core', [2.08,1.54], 1.48, 1.35, [0,.79,-.035], cream, .065);
  tapered(torso, 'mech-sloped-breastplate', [1.68,1.30], .33, .36, [0, .29, .60], teal, .035).rotation.x = .17;
  addBox(torso, 'mech-cockpit-crash-frame', [1.54, .83, .16], [0, .99, .735], dark, .105);
  addBox(torso, 'mech-cockpit-armored-glass', [1.23, .51, .055], [0, 1.055, .841], glass, .075).rotation.x = -.10;
  addBox(torso, 'mech-cockpit-reflection', [.42, .065, .012], [-.26, 1.21, .891], light, .012).rotation.z = -.17;
  tapered(torso, 'mech-glass-reflection-plane', [.21,.10], .36, .009, [.34, 1.075, .889], light, .002).rotation.z = -.32;
  addBox(torso, 'mech-center-window-mullion', [.065, .57, .04], [0, 1.055, .884], dark, .015);
  addBox(torso, 'mech-cockpit-brow', [1.65, .18, .36], [0, 1.45, .62], teal, .055);
  addBox(torso, 'mech-cockpit-lower-sill', [1.40, .14, .24], [0, .57, .79], steel, .04);
  for (const side of [-1, 1]) {
    addBox(torso, 'mech-pectoral-armor', [.26, .76, .16], [side * .91, .90, .695], teal, .055).rotation.z = side * -.12;
    addCylinder(torso, 'mech-shoulder-bearing', .35, .44, [side * 1.12, 1.05, 0], dark, 'x');
    tapered(torso, 'mech-shoulder-shell', [.92,.66], .77, .93, [side * 1.49, 1.08, .015], teal, .055);
    tapered(torso, 'mech-shoulder-cream-cap', [.91,.82], .16, 1.0, [side * 1.49, 1.45, .015], cream, .025);
    addBox(torso, 'mech-shoulder-vent-recess', [.53, .24, .055], [side * 1.49, 1.06, .51], dark, .018);
    for (let vent=0;vent<3;vent++) addBox(torso,'mech-shoulder-angled-vent',[.39,.026,.028],[side*1.49,.98+vent*.071,.547],steel,.004).rotation.z=side*.08;
    for (let bar=0;bar<2;bar++) addBox(torso,'mech-shoulder-unit-mark',[.048,.11,.012],[side*1.49+(bar-.5)*.10,1.38,.546],warning,.005);
    addBox(torso, 'mech-upper-arm-clevis', [.49, .83, .49], [side * 1.68, .31, .0], dark, .075);
    addCylinder(torso, 'mech-elbow-bearing', .25, .66, [side * 1.70, -.17, .09], steel, 'x');
    tapered(torso, 'mech-forearm-shell', [.67,.54], .61, .82, [side * 1.71, -.36, .13], cream, .045);
    line(torso, 'mech-shoulder-ram', new THREE.Vector3(side * 1.40, .77, -.36), new THREE.Vector3(side * 1.77, -.22, -.28), .065, steel);
    addCylinder(torso, 'mech-collar-lift-ram', .065, .72, [side * .81, .17, -.49], steel);
    addBox(torso, 'mech-lift-ram-sleeve', [.19, .31, .21], [side * .81, .0, -.49], dark, .035);
  }
  // Only two broad caution marks; hardware carries the silhouette.
  for (const side of [-1, 1]) addBox(torso, 'mech-recovery-hook', [.15, .17, .12], [side * .57, .21, .77], warning, .035);
  addBox(torso, 'mech-unit-number-plate', [.31, .30, .027], [.58, .86, .793], dark, .025);
  for (let i = 0; i < 2; i++) addBox(torso, 'mech-unit-number-bar', [.037, .18, .013], [.54 + i * .08, .86, .816], cream, .007);
  const head = rigid(model, 'mech-sensor-head', 4.56);
  addCylinder(head, 'mech-neck-turntable', .27, .23, [0, .02, .03], dark);
  tapered(head, 'mech-head-shell', [.96,.69], .61, .84, [0, .39, .08], cream, .045);
  addBox(head, 'mech-visor-sunshade', [1.0, .14, .93], [0, .66, .12], teal, .045);
  addBox(head, 'mech-sensor-recess', [.74, .23, .045], [0, .42, .528], dark, .045);
  addBox(head, 'mech-sensor-optic', [.59, .105, .025], [0, .43, .56], light, .028);
  addCylinder(head, 'mech-antenna-base', .11, .14, [.32, .76, -.06], dark);
  addCylinder(head, 'mech-flexible-antenna', .027, .90, [.32, 1.24, -.06], steel, 'y', 6);
  addCylinder(head, 'mech-antenna-cap', .065, .11, [.32, 1.715, -.06], dark, 'y', 6);
  const legs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = rigid(model, side < 0 ? 'mech-left-load-leg' : 'mech-right-load-leg');
    leg.position.x = side * .72; legs.push(leg);
    addBox(leg, 'mech-foot-heel-sole', [.76, .30, .44], [0, .15, -.22], dark, .045);
    addBox(leg, 'mech-foot-heel-block', [.67, .24, .32], [0, .32, -.25], steel, .045);
    addBox(leg, 'mech-foot-load-bridge', [.64,.23,.41], [0,.22,.15], dark,.04);
    for (const toe of [-1,1]) {
      tapered(leg,'mech-split-load-toe',[.35,.29],.29,.70,[toe*.22,.145,.52],steel,.025);
      addBox(leg,'mech-toe-traction-pad',[.30,.075,.62],[toe*.22,.04,.52],dark,.018);
    }
    addBox(leg, 'mech-shin-clevis', [.48, .97, .49], [0, .99, 0], dark, .075);
    addCylinder(leg, 'mech-ankle-damper', .18, .69, [0, .49, .10], steel, 'x');
    addCylinder(leg, 'mech-knee-bearing', .27, .69, [0, 1.65, 0], dark, 'x');
    addCylinder(leg, 'mech-knee-end-cap', .16, .055, [side * .365, 1.65, 0], steel, 'x');
    addBox(leg, 'mech-thigh-load-strut', [.48, .79, .53], [-side * .09, 2.10, -.045], dark, .08);
    addBox(leg, 'mech-thigh-outer-armor', [.16, .66, .56], [side * .24, 2.1, -.04], teal, .065);
    for (const z of [-.20, .28]) {
      line(leg, 'mech-calf-chrome-rod', new THREE.Vector3(side * .44, .58, z), new THREE.Vector3(side * .37, 1.52, z - .16), .055, steel);
      line(leg, 'mech-calf-cylinder', new THREE.Vector3(side * .44, .55, z), new THREE.Vector3(side * .405, 1.10, z - .08), .09, teal);
      addCylinder(leg,'mech-ankle-ram-pin',.10,.16,[side*.44,.57,z],dark,'x');
    }
    line(leg,'mech-pelvis-thigh-chrome-rod',new THREE.Vector3(-side*.30,2.72,.43),new THREE.Vector3(side*.23,1.90,.45),.065,steel);
    line(leg,'mech-pelvis-thigh-ram-body',new THREE.Vector3(-side*.30,2.72,.43),new THREE.Vector3(-side*.01,2.28,.44),.105,teal);
    addCylinder(leg,'mech-pelvis-ram-top-pin',.15,.24,[-side*.30,2.72,.43],dark,'x');
    addCylinder(leg, 'mech-hip-socket', .24, .62, [-side * .10, 2.49, -.035], steel, 'x');
  }
  batch(hips); batch(torso); batch(head); legs.forEach(batch);
  let phase = 0, disposed = false;
  return {
    group: model,
    update(time, dt, speed = 0, fireAge = Infinity, hitAge = Infinity) {
      if (disposed || !Number.isFinite(time) || !Number.isFinite(dt) || dt <= 0) return;
      const moving = THREE.MathUtils.clamp((Number.isFinite(speed) ? speed : 0) / 5, 0, 1);
      phase += dt * moving * 4.6;
      const heave = Math.abs(Math.sin(phase * 2)) * .026 * moving;
      torso.position.y = 3 - heave + Math.sin(time * 1.7) * .008;
      torso.rotation.z = Math.sin(phase) * .012 * moving;
      torso.rotation.x = -.016 * moving + (fireAge >= 0 && fireAge < .4 ? Math.sin(fireAge / .4 * Math.PI) * .019 : 0);
      head.rotation.y = Math.sin(time * .37) * .035;
      legs.forEach((leg, index) => {
        const stride = Math.sin(phase + index * Math.PI);
        leg.position.z = stride * .09 * moving;
        leg.position.y = Math.max(0, stride) * .025 * moving;
      });
      hips.rotation.z = torso.rotation.z * -.5;
      model.rotation.x = hitAge >= 0 && hitAge < .45 ? Math.sin(hitAge / .45 * Math.PI) * .012 : 0;
    },
    dispose() {
      if (disposed) return; disposed = true;
      originals.forEach(({object,visible}) => { object.visible = visible; }); disposeOwned(model);
    },
  };
}
