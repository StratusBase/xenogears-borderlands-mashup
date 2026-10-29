import * as THREE from 'three';
import { updateEquipmentEffects } from './equipmentEffects';
import type { Item, Mode, Progression } from '../core/index';
import { resolveEquipmentAppearance } from '../core/appearance';
import { ComicRenderer } from './ComicRenderer';
import { createEquipmentCharacter, disposeEquipmentModel } from './equipmentModels';
import { isWeaponPreviewMesh, weaponPreviewFrame } from './previewFraming';

// Keep the body at the same on-screen scale while comparing any supported gear.
// These volumes cover a complete turn of the pilot and mech, including heavy barrels.
export const equipmentPreviewFrames = Object.freeze({
  pilot: Object.freeze({ centerY: 0.95, radius: 1.3 }),
  mech: Object.freeze({ centerY: 3.1, radius: 3.6 }),
});

/** One cached, isolated renderer for the inventory's actual equipment models. */
export class LoadoutPreview {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 1, 0.04, 100);
  private readonly comic: ComicRenderer;
  private readonly platformGeometry = new THREE.CircleGeometry(2, 48);
  private readonly platformMaterial = new THREE.MeshBasicMaterial({ color: 0x2b4334 });
  private readonly platform = new THREE.Mesh(this.platformGeometry, this.platformMaterial);
  private readonly observer: ResizeObserver;
  private readonly center = new THREE.Vector3();
  private readonly viewDirection = new THREE.Vector3(0.4, 0.15, 1).normalize();
  private readonly weaponViewDirection = new THREE.Vector3(0.95, 0.22, 0.6).normalize();
  private focus: 'weapon' | 'loadout' = 'loadout';
  private weaponFrame: ReturnType<typeof weaponPreviewFrame> = null;
  private originalVisibility = new Map<THREE.Object3D, boolean>();
  private model: THREE.Group | null = null;
  private modelKey = '';
  private modelMode: Mode | null = null;
  private autoRotate = true;
  private radius = 1;
  private host: HTMLElement | null = null;
  private visible = false;
  private disposed = false;
  private frame = 0;
  private lastTime = 0;
  private width = 0;
  private height = 0;
  private density = 0;
  private draggingPointer: number | null = null;
  private pointerX = 0;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    this.renderer.setSize(1, 1, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'loadout-preview-canvas';
    this.canvas.style.touchAction = 'none';
    this.canvas.style.cursor = 'grab';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Rotating 3D equipment loadout');
    this.canvas.addEventListener('pointerdown', this.pointerDown);
    this.canvas.addEventListener('pointermove', this.pointerMove);
    this.canvas.addEventListener('pointerup', this.pointerUp);
    this.canvas.addEventListener('pointercancel', this.pointerUp);
    this.canvas.addEventListener('lostpointercapture', this.endDrag);
    this.scene.background = new THREE.Color(0x1b2d24);
    this.scene.add(new THREE.HemisphereLight(0xffe5bb, 0x273d35, 0.75));
    const key = new THREE.DirectionalLight(0xffe1a3, 1.9);
    key.position.set(-4, 8, 5);
    this.scene.add(key);
    this.platform.rotation.x = -Math.PI / 2;
    this.platform.position.y = -0.015;
    this.scene.add(this.platform);
    this.comic = new ComicRenderer(this.renderer, this.scene, this.camera);
    this.observer = new ResizeObserver(this.resize);
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.syncLoop);
  }

  mount(host: HTMLElement): void {
    if (this.disposed) return;
    if (host !== this.host) {
      this.endDrag();
      this.observer.disconnect();
      this.host = host;
      host.append(this.canvas);
      this.observer.observe(host);
    }
    this.resize();
  }

  setLoadout(state: Progression, mode: Mode, previewItem?: Item): void {
    if (this.disposed) return;
    const appearance = resolveEquipmentAppearance(state, mode, previewItem);
    const key = `${mode}:${Object.values(appearance).map(slot => slot.key).join('|')}`;
    if (key === this.modelKey) return;
    const comparing = this.modelMode === mode && this.model !== null;
    const rotation = comparing ? this.model!.rotation.y : -0.45;
    this.autoRotate = !comparing;
    const model = createEquipmentCharacter(mode, appearance);
    this.weaponFrame = weaponPreviewFrame(model);
    this.originalVisibility.clear();
    model.traverse(object => { if (object instanceof THREE.Mesh) this.originalVisibility.set(object, object.visible); });
    // Models own their geometry/materials; their shared painted textures stay
    // owned by the common material module when a preview is replaced.
    if (this.model) disposeEquipmentModel(this.model);
    this.model = model;
    this.modelKey = key;
    this.modelMode = mode;
    this.scene.add(model);
    model.rotation.y = rotation;
    this.platform.scale.setScalar(mode === 'mech' ? 1.5 : 0.5);
    this.applyFocus();
  }

  /** Inventory keeps full-loadout framing; the workbench can inspect the actual weapon up close. */
  setFocus(focus: 'weapon' | 'loadout'): void {
    if (this.focus === focus || this.disposed) return;
    this.focus = focus;
    this.applyFocus();
  }

  private applyFocus(): void {
    if (!this.model || !this.modelMode) return;
    const weaponOnly = this.focus === 'weapon' && this.weaponFrame !== null;
    for (const [object, visible] of this.originalVisibility) object.visible = visible && (!weaponOnly || isWeaponPreviewMesh(object));
    this.platform.visible = !weaponOnly;
    if (weaponOnly) {
      this.model.updateWorldMatrix(true, false);
      this.center.copy(this.weaponFrame!.center).applyMatrix4(this.model.matrixWorld);
      this.radius = this.weaponFrame!.radius;
    } else {
      this.center.set(0, equipmentPreviewFrames[this.modelMode].centerY, 0);
      this.radius = equipmentPreviewFrames[this.modelMode].radius;
    }
    this.canvas.setAttribute('aria-label', weaponOnly
      ? `${this.modelMode} weapon close-up. Drag to rotate; effects and other equipment do not change its framing.`
      : `Full-body ${this.modelMode} equipment preview: weapon, shield, reactor, and legs. Drag to rotate; comparisons keep the same view.`);
    this.frameModel();
  }

  setVisible(visible: boolean): void {
    if (this.disposed) return;
    this.visible = visible;
    this.syncLoop();
  }

  private resize = (): void => {
    if (this.disposed || !this.host?.isConnected) return;
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (!width || !height) return;
    const density = Math.min(devicePixelRatio || 1, 1.75);
    if (width === this.width && height === this.height && density === this.density) return;
    this.width = width;
    this.height = height;
    this.density = density;
    this.renderer.setPixelRatio(density);
    this.renderer.setSize(width, height, false);
    this.comic.resize(width, height, density);
    this.camera.aspect = width / height;
    this.frameModel();
  };

  private frameModel(): void {
    const vertical = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const horizontal = Math.atan(Math.tan(vertical) * this.camera.aspect);
    const distance = this.radius / Math.sin(Math.min(vertical, horizontal)) * 1.08;
    this.camera.position.copy(this.center).addScaledVector(this.focus === 'weapon' && this.weaponFrame ? this.weaponViewDirection : this.viewDirection, distance);
    this.camera.near = Math.max(0.025, distance / 500);
    this.camera.far = distance + this.radius * 5;
    this.camera.lookAt(this.center);
    this.camera.updateProjectionMatrix();
  }

  private syncLoop = (): void => {
    if (this.disposed) return;
    if (!this.visible || document.hidden) {
      this.endDrag();
      if (this.frame) cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.lastTime = 0;
      return;
    }
    if (!this.frame) this.frame = requestAnimationFrame(this.render);
  };

  private render = (time: number): void => {
    this.frame = 0;
    if (this.disposed || !this.visible || document.hidden) return;
    if (this.host?.isConnected) {
      this.resize();
      const delta = this.lastTime ? Math.min((time - this.lastTime) / 1000, 0.05) : 0;
      if (this.model && this.autoRotate && this.draggingPointer === null) this.model.rotation.y += delta * 0.2;
      if (this.model && this.focus === 'weapon' && this.weaponFrame) {
        this.model.updateWorldMatrix(true, false);
        this.center.copy(this.weaponFrame.center).applyMatrix4(this.model.matrixWorld);
        this.frameModel();
      }
      this.lastTime = time;
      if (this.model) updateEquipmentEffects(this.model, delta, time / 1000);
      if (this.width && this.height) this.comic.render();
    }
    this.frame = requestAnimationFrame(this.render);
  };

  private pointerDown = (event: PointerEvent): void => {
    if (!this.visible || !this.model || event.button !== 0) return;
    this.autoRotate = false;
    this.draggingPointer = event.pointerId;
    this.pointerX = event.clientX;
    this.canvas.style.cursor = 'grabbing';
    this.canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };

  private pointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.draggingPointer || !this.model) return;
    this.model.rotation.y += (event.clientX - this.pointerX) * 0.01;
    this.pointerX = event.clientX;
    event.preventDefault();
  };

  private pointerUp = (event: PointerEvent): void => {
    if (event.pointerId === this.draggingPointer) this.endDrag();
  };

  private endDrag = (): void => {
    const pointer = this.draggingPointer;
    this.draggingPointer = null;
    this.canvas.style.cursor = 'grab';
    if (pointer !== null && this.canvas.hasPointerCapture(pointer)) this.canvas.releasePointerCapture(pointer);
  };

  dispose(): void {
    if (this.disposed) return;
    this.setVisible(false);
    this.disposed = true;
    this.observer.disconnect();
    this.canvas.removeEventListener('pointerdown', this.pointerDown);
    this.canvas.removeEventListener('pointermove', this.pointerMove);
    this.canvas.removeEventListener('pointerup', this.pointerUp);
    this.canvas.removeEventListener('pointercancel', this.pointerUp);
    this.canvas.removeEventListener('lostpointercapture', this.endDrag);
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.syncLoop);
    if (this.model) disposeEquipmentModel(this.model);
    this.originalVisibility.clear();
    this.platformGeometry.dispose();
    this.platformMaterial.dispose();
    this.comic.dispose();
    this.renderer.dispose();
    this.canvas.remove();
    this.host = null;
  }
}
