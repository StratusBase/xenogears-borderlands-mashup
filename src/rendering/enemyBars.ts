import * as THREE from 'three';

export interface EnemyBars {
  readonly group: THREE.Group;
  update(health: number, maxHealth: number, shield: number, maxShield: number): void;
  dispose(): void;
}

const TRACK_WIDTH = 1.7;
const FILL_WIDTH = TRACK_WIDTH - 0.06;

function fraction(value: number, maximum: number): number {
  return Number.isFinite(value) && Number.isFinite(maximum) && maximum > 0
    ? THREE.MathUtils.clamp(value / maximum, 0, 1)
    : 0;
}

/** Fixed-size tracks with independent left-anchored fills. Root billboards the group. */
export function createEnemyBars(): EnemyBars {
  const group = new THREE.Group();
  group.name = 'enemy-vitals';
  group.userData.comicOverlay = true;

  const borderGeometry = new THREE.PlaneGeometry(TRACK_WIDTH + 0.06, 0.145);
  const trackGeometry = new THREE.PlaneGeometry(TRACK_WIDTH, 0.105);
  const fillGeometry = new THREE.PlaneGeometry(FILL_WIDTH, 0.075);
  const material = (color: number): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({
    color, toneMapped: false, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
  });
  const borderMaterial = material(0x070b10);
  const trackMaterial = material(0x252b34);
  const healthMaterial = material(0xff3b3b);
  const shieldMaterial = material(0x43c8ff);

  function row(name: 'health' | 'shield', fillMaterial: THREE.MeshBasicMaterial): { row: THREE.Group; fill: THREE.Mesh } {
    const holder = new THREE.Group();
    holder.name = `${name}-row`;
    holder.userData.comicOverlay = true;
    const border = new THREE.Mesh(borderGeometry, borderMaterial);
    border.name = `${name}-border`;
    const track = new THREE.Mesh(trackGeometry, trackMaterial);
    track.name = `${name}-track`;
    track.position.z = 0.001;
    const fill = new THREE.Mesh(fillGeometry, fillMaterial);
    fill.name = `${name}-fill`;
    fill.position.z = 0.002;
    for (const mesh of [border, track, fill]) {
      mesh.userData.comicOverlay = true;
      mesh.frustumCulled = false;
      mesh.raycast = () => {};
    }
    holder.add(border, track, fill);
    group.add(holder);
    return { row: holder, fill };
  }

  const healthBar = row('health', healthMaterial);
  const shieldBar = row('shield', shieldMaterial);
  shieldBar.row.position.y = 0.17;
  shieldBar.row.visible = false;

  function setFill(fill: THREE.Mesh, amount: number): void {
    fill.scale.x = amount;
    // Scaling around a mesh center would empty toward both ends. Shift the
    // center so the left endpoint remains at -FILL_WIDTH / 2 at every value.
    fill.position.x = (amount - 1) * FILL_WIDTH / 2;
    fill.visible = amount > 0;
  }

  let disposed = false;
  return {
    group,
    update(health, maxHealth, shield, maxShield) {
      if (disposed) return;
      setFill(healthBar.fill, fraction(health, maxHealth));
      shieldBar.row.visible = Number.isFinite(maxShield) && maxShield > 0;
      setFill(shieldBar.fill, fraction(shield, maxShield));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      borderGeometry.dispose();
      trackGeometry.dispose();
      fillGeometry.dispose();
      borderMaterial.dispose();
      trackMaterial.dispose();
      healthMaterial.dispose();
      shieldMaterial.dispose();
    },
  };
}
