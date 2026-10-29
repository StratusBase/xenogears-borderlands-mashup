import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';

type Drawable = THREE.Mesh | THREE.Line | THREE.Points | THREE.Sprite;

function isDrawable(object: THREE.Object3D): object is Drawable {
  return object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points || object instanceof THREE.Sprite;
}

/** A tag belongs to the whole attached subtree, including transformed billboards. */
function isOverlay(object: Drawable): boolean {
  for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent) {
    if (ancestor.userData.comicOverlay === true) return true;
  }
  if (!(object instanceof THREE.Mesh)) return true;
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  return materials.every(material => material.transparent || !material.depthWrite);
}

/** Initialize a private buffer with ink color and the exact opaque hardware depth. */
class OverlayPass extends Pass {
  private readonly target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthBuffer: true,
    stencilBuffer: false,
  });
  private readonly depthCopy = new THREE.ShaderMaterial({
    name: 'ComicInkColorAndOpaqueDepthCopy',
    uniforms: { tDiffuse: { value: null }, tOpaqueDepth: { value: null } },
    vertexShader: CopyShader.vertexShader,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform sampler2D tOpaqueDepth;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(tDiffuse, vUv);
        gl_FragDepth = texture2D(tOpaqueDepth, vUv).r;
      }
    `,
    blending: THREE.NoBlending,
    depthTest: true,
    depthFunc: THREE.AlwaysDepth,
    depthWrite: true,
    toneMapped: false,
  });
  private readonly colorCopy = new THREE.ShaderMaterial({
    name: 'ComicOverlayLinearColorCopy',
    uniforms: { tDiffuse: { value: null }, opacity: { value: 1 } },
    vertexShader: CopyShader.vertexShader,
    fragmentShader: CopyShader.fragmentShader,
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly quad = new FullScreenQuad(this.depthCopy);

  constructor(depth: THREE.DepthTexture, private readonly drawOverlays: () => void) {
    super();
    this.target.texture.name = 'comic-ink-with-depth-tested-overlays';
    this.depthCopy.uniforms.tOpaqueDepth.value = depth;
  }

  override setSize(width: number, height: number): void {
    this.target.setSize(width, height);
  }

  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    const oldAutoClear = renderer.autoClear;
    const oldTarget = renderer.getRenderTarget();
    try {
      renderer.autoClear = false;
      renderer.setRenderTarget(this.target);
      this.depthCopy.uniforms.tDiffuse.value = readBuffer.texture;
      this.quad.material = this.depthCopy;
      // This full-screen initialization writes every color/depth pixel. The
      // following FX draw preserves both and uses normal hardware depth tests.
      this.quad.render(renderer);
      this.drawOverlays();

      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      this.colorCopy.uniforms.tDiffuse.value = this.target.texture;
      this.quad.material = this.colorCopy;
      this.quad.render(renderer);
    } finally {
      renderer.autoClear = oldAutoClear;
      renderer.setRenderTarget(oldTarget);
    }
  }

  override dispose(): void {
    this.target.dispose();
    this.depthCopy.dispose();
    this.colorCopy.dispose();
    this.quad.dispose();
  }
}

const inkShader = {
  name: 'ComicDepthNormalInk',
  uniforms: {
    tDiffuse: { value: null },
    tNormals: { value: null },
    tDepth: { value: null },
    cssPixel: { value: new THREE.Vector2(1, 1) },
    outlineWidth: { value: 3.0 },
    creaseWidth: { value: 1.35 },
    inkColor: { value: new THREE.Color(0x17131b) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tNormals;
    uniform sampler2D tDepth;
    uniform vec2 cssPixel;
    uniform float outlineWidth;
    uniform float creaseWidth;
    uniform vec3 inkColor;
    varying vec2 vUv;

    float depthAt(vec2 offset) {
      return texture2D(tDepth, clamp(vUv + offset, vec2(0.0), vec2(1.0))).x;
    }

    float crease(vec4 center, vec2 offset) {
      vec4 neighbor = texture2D(tNormals, clamp(vUv + offset, vec2(0.0), vec2(1.0)));
      vec3 a = normalize(center.rgb * 2.0 - 1.0);
      vec3 b = normalize(neighbor.rgb * 2.0 - 1.0);
      return (1.0 - dot(a, b)) * step(0.5, center.a) * step(0.5, neighbor.a);
    }

    void main() {
      vec4 beauty = texture2D(tDiffuse, vUv);
      vec2 outer = cssPixel * outlineWidth * 0.5;
      float centerDepth = depthAt(vec2(0.0));
      float east = depthAt(vec2(outer.x, 0.0));
      float west = depthAt(vec2(-outer.x, 0.0));
      float north = depthAt(vec2(0.0, outer.y));
      float south = depthAt(vec2(0.0, -outer.y));
      float northeast = depthAt(outer * 0.7071);
      float southwest = depthAt(-outer * 0.7071);
      float northwest = depthAt(vec2(-outer.x, outer.y) * 0.7071);
      float southeast = depthAt(vec2(outer.x, -outer.y) * 0.7071);

      // Hardware depth is affine over a plane. Second differences reject the
      // ground's perspective slope but retain silhouettes and occlusion edges.
      float curvature = max(
        max(abs(east + west - 2.0 * centerDepth), abs(north + south - 2.0 * centerDepth)),
        max(abs(northeast + southwest - 2.0 * centerDepth), abs(northwest + southeast - 2.0 * centerDepth))
      ) * 0.5 / max(1.0 - centerDepth, 0.000001);
      float silhouette = smoothstep(0.018, 0.055, curvature);

      vec4 centerNormal = texture2D(tNormals, vUv);
      vec2 inner = cssPixel * creaseWidth * 0.5;
      float normalChange = max(
        max(crease(centerNormal, vec2(inner.x, 0.0)), crease(centerNormal, vec2(-inner.x, 0.0))),
        max(crease(centerNormal, vec2(0.0, inner.y)), crease(centerNormal, vec2(0.0, -inner.y)))
      );
      float interior = smoothstep(0.20, 0.43, normalChange) * 0.82;
      float edge = max(silhouette, interior);

      // Ink is applied in linear color, then OutputPass performs the renderer's
      // existing tone mapping and sRGB conversion exactly once.
      gl_FragColor = vec4(mix(beauty.rgb, inkColor, edge * 0.97), beauty.a);
    }
  `,
};

/** Depth silhouettes use a real screen-space width, independent of WebGL line support. */
export class ComicRenderer {
  private readonly composer: EffectComposer;
  private readonly normalTarget: THREE.WebGLRenderTarget;
  private readonly normalMaterial = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide, flatShading: true });
  private readonly inkPass: ShaderPass;
  private readonly overlayPass: OverlayPass;
  private readonly outputPass = new OutputPass();
  private readonly antialiasPass = new FXAAPass();
  private readonly clearColor = new THREE.Color();
  private readonly drawableMasks = new Map<Drawable, number>();
  private readonly overlays = new Set<Drawable>();
  private disposed = false;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
  ) {
    this.normalMaterial.toneMapped = false;
    this.normalTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.normalTarget.texture.name = 'comic-view-normals';
    this.normalTarget.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    this.normalTarget.depthTexture.name = 'comic-scene-depth';
    this.normalTarget.depthTexture.minFilter = THREE.NearestFilter;
    this.normalTarget.depthTexture.magFilter = THREE.NearestFilter;

    const beautyTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: Math.min(4, renderer.capabilities.maxSamples),
    });
    this.composer = new EffectComposer(renderer, beautyTarget);
    // All render targets share integer drawing-buffer dimensions. Keeping the
    // composer at ratio 1 avoids rounding one target up and another down at a
    // fractional device pixel ratio; CSS-space ink width stays separate below.
    this.composer.setPixelRatio(1);
    this.inkPass = new ShaderPass(inkShader);
    this.inkPass.uniforms.tNormals.value = this.normalTarget.texture;
    this.inkPass.uniforms.tDepth.value = this.normalTarget.depthTexture;
    this.overlayPass = new OverlayPass(this.normalTarget.depthTexture, () => this.renderOverlays());
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(this.inkPass);
    this.composer.addPass(this.overlayPass);
    this.composer.addPass(this.outputPass);
    // FXAA needs display-referred (sRGB) input, so it follows OutputPass. It
    // smooths the new ink edges as well as geometry, instead of blurring the
    // normal/depth buffers used to detect those edges.
    this.composer.addPass(this.antialiasPass);
    const size = renderer.getSize(new THREE.Vector2());
    this.resize(size.x, size.y, renderer.getPixelRatio());
  }

  /** Full silhouette width, in CSS pixels; interior creases stay finer. */
  get outlineWidth(): number { return this.inkPass.uniforms.outlineWidth.value as number; }
  set outlineWidth(value: number) {
    if (Number.isFinite(value)) this.inkPass.uniforms.outlineWidth.value = THREE.MathUtils.clamp(value, 0.5, 6);
  }

  resize(width: number, height: number, pixelRatio: number): void {
    const cssWidth = Math.max(1, width);
    const cssHeight = Math.max(1, height);
    const ratio = Math.max(0.5, pixelRatio);
    // Match WebGLRenderer.setSize/getDrawingBufferSize, which floor each axis.
    const physicalWidth = Math.max(1, Math.floor(cssWidth * ratio));
    const physicalHeight = Math.max(1, Math.floor(cssHeight * ratio));
    this.normalTarget.setSize(physicalWidth, physicalHeight);
    // EffectComposer also calls FXAAPass.setSize here, updating its inverse
    // physical-pixel resolution after every viewport or density change.
    this.composer.setSize(physicalWidth, physicalHeight);
    this.inkPass.uniforms.cssPixel.value.set(1 / cssWidth, 1 / cssHeight);
  }

  render(): void {
    if (this.disposed) return;
    this.drawableMasks.clear();
    this.overlays.clear();
    const oldOverride = this.scene.overrideMaterial;
    const oldBackground = this.scene.background;
    const oldTarget = this.renderer.getRenderTarget();
    const oldAlpha = this.renderer.getClearAlpha();
    const oldAutoClear = this.renderer.autoClear;
    const oldShadowUpdate = this.renderer.shadowMap.autoUpdate;
    this.renderer.getClearColor(this.clearColor);

    // Opaque beauty and normals share the same selection. FX stay attached to
    // their parents, but are temporarily removed from both stages via layers.
    this.scene.traverseVisible((object) => {
      if (!isDrawable(object)) return;
      this.drawableMasks.set(object, object.layers.mask);
      if (isOverlay(object)) { this.overlays.add(object); object.layers.mask = 0; }
    });
    this.overlayPass.enabled = this.overlays.size > 0;

    try {
      this.scene.background = null;
      this.scene.overrideMaterial = this.normalMaterial;
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.autoClear = true;
      this.renderer.setClearColor(0x8080ff, 0);
      this.renderer.setRenderTarget(this.normalTarget);
      this.renderer.clear(true, true, false);
      this.renderer.render(this.scene, this.camera);
      this.scene.overrideMaterial = oldOverride;
      this.scene.background = oldBackground;
      this.renderer.shadowMap.autoUpdate = oldShadowUpdate;
      this.renderer.autoClear = oldAutoClear;
      this.renderer.setClearColor(this.clearColor, oldAlpha);
      this.renderer.setRenderTarget(oldTarget);
      this.composer.render();
    } finally {
      this.drawableMasks.forEach((mask, object) => { object.layers.mask = mask; });
      this.scene.overrideMaterial = oldOverride;
      this.scene.background = oldBackground;
      this.renderer.shadowMap.autoUpdate = oldShadowUpdate;
      this.renderer.autoClear = oldAutoClear;
      this.renderer.setClearColor(this.clearColor, oldAlpha);
      this.renderer.setRenderTarget(oldTarget);
    }
  }

  private renderOverlays(): void {
    const oldBackground = this.scene.background;
    const oldOverride = this.scene.overrideMaterial;
    const oldShadowUpdate = this.renderer.shadowMap.autoUpdate;
    const materialDepth = new Map<THREE.Material, { test: boolean; write: boolean }>();
    this.drawableMasks.forEach((mask, object) => {
      const overlay = this.overlays.has(object);
      object.layers.mask = overlay ? mask : 0;
      if (!overlay) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {
        if (materialDepth.has(material)) return;
        materialDepth.set(material, { test: material.depthTest, write: material.depthWrite });
        material.depthTest = true;
        material.depthWrite = false;
      });
    });
    try {
      this.scene.background = null;
      this.scene.overrideMaterial = null;
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.render(this.scene, this.camera);
    } finally {
      materialDepth.forEach((state, material) => { material.depthTest = state.test; material.depthWrite = state.write; });
      this.drawableMasks.forEach((mask, object) => { object.layers.mask = this.overlays.has(object) ? 0 : mask; });
      this.scene.background = oldBackground;
      this.scene.overrideMaterial = oldOverride;
      this.renderer.shadowMap.autoUpdate = oldShadowUpdate;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.normalMaterial.dispose();
    this.normalTarget.depthTexture?.dispose();
    this.normalTarget.dispose();
    this.inkPass.dispose();
    this.overlayPass.dispose();
    this.outputPass.dispose();
    this.antialiasPass.dispose();
    this.composer.dispose();
  }
}
