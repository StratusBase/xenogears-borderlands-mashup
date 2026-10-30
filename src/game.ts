import * as THREE from 'three';
import { createProgression, deserializeProgression, serializeProgression, getStats, equipItem, sellItem, sellJunk, setItemMark, rollItem, seededRandom, rarityColors, checkZoneAccess, INVENTORY_CAPACITY, type Mode, type Item, type Progression } from './core/index';
import { createWorld, getZone, isWalkable } from './world';
import { GameUI, type HUDData } from './ui';
import { GamepadInput, type GamepadFrame } from './input/gamepad';
import { MouseLook } from './input/mouse';
import { ComicRenderer } from './rendering/ComicRenderer';
import { GamePresentation } from './rendering/quality/GamePresentation';
import type {ConfirmedElementPulse} from './rendering/quality/shared/confirmedPulse';
import type { DamageFeedbackQuality, DamageHead } from './ui/damageNumbers';
import { cacheDamageAnchors, primaryDamageAnchor, sampleDamageAnchor, type DamageAnchors } from './ui/damageAnchors';
import { createComicMaterial } from './rendering/materials';
import { createEnemyBars, type EnemyBars } from './rendering/enemyBars';
import { applyEnemyDamage, shieldAdjustedDamage, type EnemyDamageResult, type EnemyVitals } from './core/combat';
import { creditWallet, spendCredits, getSupplyPrices, purchaseSupply, rollCashValue, type SupplyKind } from './core/economy';
import { createLootEffects } from './rendering/lootEffects';
import { SimulationWeaponPose } from './rendering/SimulationWeaponPose';
import { HEAL_COOLDOWN, HEALTH_PICKUP_FRACTION, getHealCooldownRemaining, healHealth, rollEnemySupplies, trySelfHeal } from './core/recovery';
import { createHealthPickup } from './rendering/healthPickup';
import { getCheckpoint, nearestCheckpoint, normalizeCheckpoint } from './core/checkpoints';
import { resolveEquipmentAppearance } from './core/appearance';
import { HealingAction } from './core/healingAction';
import { createEquipmentWeapon, createEquipmentCharacter, disposeEquipmentModel, type WeaponRig } from './rendering/equipmentModels';
import { createHealingVisual, type HealingVisual } from './rendering/healingVisual';
import { getWeaponSpec, getWeaponElements, getHitStatusChance, getHitStatusPower, elementColors, type ElementType } from './core/arsenal';
import { createStatusState, applyStatus, advanceStatuses, getStatusDps, getStatusModifiers, activeStatusElements, type StatusState, type StatusElement } from './core/statusEffects';
import { PlayerBallistics, type BallisticHit } from './rendering/PlayerBallistics';
import type { DamageEffect } from './core/feedback';
import { JumpMotion } from './core/jump';
import { findLedgeGrab, sampleLedgeClimb, pilotBodyClear, pilotSupportHeight, pilotCeilingHeight,
  PILOT_TRAVERSAL, LEDGE_CLIMB_DURATION, type LedgeGrab } from './core/ledgeClimb';
import { createClimbVisual, type ClimbVisual } from './rendering/climbVisual';
import { ammoReserveCapacity, fitMagazine, reloadAmmo } from './core/ammo';
import { getVendingOffers, getVendingServicePrices, purchaseVendingItem, type VendingType } from './core/vending';
import { createDroppedItemModel } from './rendering/dropModels';
import { ElementEffects } from './rendering/ElementEffects';
import { ElementCoating } from './rendering/ElementCoating';
import { updateEquipmentEffects, disposeEquipmentEffects } from './rendering/equipmentEffects';
import { focusedStation } from './rendering/focusedInteraction';
import { createTestDummy, type TestDummyVisual } from './rendering/testDummy';
import { TestDummyMeter } from './core/testDummy';
import { DEFAULT_WEAPON_BALANCE, effectiveProjectileDamage, heatPerShot, heatRecoveryFraction, type WeaponBalanceRules } from './core/weaponBalance';
import { EncounterDirector, ENCOUNTER, type EnemySpawn } from './encounter/encounter';
import { createEncounterReward } from './encounter/rewards';
import { createEnemyBrain, updateEnemyBrain, staggerEnemy, type EnemyBrain } from './encounter/enemyBehavior';
import { createNavigationState, navigateEnemy, segmentClear, type NavigationState } from './encounter/navigation';
import { createEncounterEnemy, type EncounterEnemyVisual } from './rendering/encounterEnemy';
import type { EnemyRole, EnemyPhase, EncounterEvent, EncounterEventListener, CombatMeasurementEvent, CombatMeasurementPayload } from './encounter/contracts';

const SAVE_KEY = 'dust-steel.mechanics.v1';
type Screen = 'start' | 'pause' | 'inventory' | 'vending' | 'workbench' | 'none';
type LootAction = 'take' | 'equip' | 'junk';
type VendingService = 'pilot-ammo' | 'mech-ammo' | 'medical' | 'mech-repair';
interface Body { health: number; shield: number; ammo: number; reserve: number; heat: number; lastDamage: number; overheated: boolean }
interface StatusVisual { update(dt: number, time?: number): void; dispose(): void; setIntensity?(value: number): void }
interface CombatTarget {
  id: number; mesh: THREE.Group; heavy: boolean; shield: number;
  statuses: StatusState; statusEffects: Map<StatusElement, StatusVisual>; statusCoatings: Map<StatusElement, ElementCoating>;
}
interface Enemy extends CombatTarget, EnemyVitals {
  bars: EnemyBars; home: THREE.Vector3; gravityPoint: THREE.Vector3 | null;
  role: EnemyRole; boss: boolean; spawnId?: string; brain: EnemyBrain; navigation: NavigationState;
  visual: EncounterEnemyVisual; lastPhase: EnemyPhase;
}
interface Drop { item: Item; mesh: THREE.Group; time: number }
interface CashDrop { amount: number; mesh: THREE.Group; time: number }
interface HealthDrop { mesh: THREE.Group; time: number }
interface Effect { object: THREE.Object3D; life: number; maxLife: number }
interface Projectile { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; damage: number }

/** Optional isolated harness inputs; the normal game entrypoint uses browser saves. */
export interface GameOptions {
  /** Normal gameplay uses quality presentation; legacy remains an explicit reversible option. */
  presentation?: 'quality' | 'legacy';
  /** Same-build diagnostic selector; ordinary gameplay uses bounded crowd feedback. */
  feedbackQuality?: DamageFeedbackQuality;
  /** Evaluation harnesses start muted; normal gameplay starts with sound enabled. */
  soundEnabled?: boolean;
  initialProgression?: Progression;
  saveKey?: string;
  startingHealthFraction?: number;
  autoEncounters?: boolean;
  trainingTargets?: boolean;
  startingDrops?: readonly { item: Item; x: number; z: number }[];
  encounterSeed?: number;
  onEncounterEvent?: EncounterEventListener;
  onMeasurement?: (event: CombatMeasurementEvent) => void;
  /** Enables scripted inputs and stepping only for an explicitly created development harness. */
  evaluationDriver?: boolean;
  /** Isolated diagnostic comparisons only; ordinary gameplay uses both approved changes. */
  evaluationBalanceRules?: WeaponBalanceRules;
  /** Driver-owned clock from construction; RAF may draw but cannot step gameplay. */
  manualEvaluation?: boolean;
  onEvaluationShot?: (shot: EvaluationShot) => void;
  onEvaluationProc?: (proc: EvaluationProc) => void;
}
export interface EvaluationProc {
  at: number; mode: Mode; targetId: number; element: ElementType;
  projectile: ReturnType<typeof getWeaponSpec>['projectile']; chance: number; power: number;
}
export interface EvaluationShot {
  at: number; sequence: number; mode: Mode;
  origin: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
  aimPoint: { x: number; y: number; z: number };
  spec: ReturnType<typeof getWeaponSpec>;
}
export interface EvaluationInput {
  moveX?: number; moveY?: number; yaw?: number; pitch?: number; sprint?: boolean; fire?: boolean;
  interact?: boolean; switchMode?: boolean; ability?: boolean; heal?: boolean; reload?: boolean; jump?: boolean;
}

/** Presentation/orchestration only. Equipment and progression have no renderer or story dependency. */
export class Game {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 350);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly comicRenderer: ComicRenderer;
  private presentation?: GamePresentation;
  private presentationTime = 0;
  private readonly presentationPosition = new THREE.Vector3();
  private presentationYaw = 0;
  private presentationGrounded = true;
  private reloadFoleyStage = 0;
  private readonly damagePoint = new THREE.Vector3();
  private readonly damageHead = new THREE.Vector3();
  private readonly damageHeads: DamageHead[] = [];
  private readonly damageAnchors = new WeakMap<THREE.Group, DamageAnchors>();
  private readonly mouse: MouseLook;
  private readonly ui: GameUI;
  private readonly world: ReturnType<typeof createWorld>;
  private readonly testDummy: CombatTarget;
  private readonly dummyVisual: TestDummyVisual;
  private readonly dummyMeter = new TestDummyMeter();
  private readonly clock = new THREE.Clock();
  private readonly keys = new Set<string>();
  private readonly ray = new THREE.Raycaster();
  private readonly weapon = new THREE.Group();
  private readonly gamepadInput = new GamepadInput();
  private gamepad: GamepadFrame = { connected: false, label: '', moveX: 0, moveY: 0, lookX: 0, lookY: 0, fire: false, aim: false, sprint: false, pressed: new Set() };
  private readonly pilotGun = new THREE.Group();
  private readonly mechGuns = new THREE.Group();
  private pilotRig!: WeaponRig;
  private mechRig!: WeaponRig;
  private healingVisual!: HealingVisual;
  private readonly recoveryAction = new HealingAction();
  private readonly visualKeys: Record<Mode, string> = { pilot: '', mech: '' };
  private lastMuzzleIndex = 0;
  private readonly muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.09, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffed8c }));
  private readonly enemies: Enemy[] = [];
  private readonly drops: Drop[] = [];
  private readonly cashDrops: CashDrop[] = [];
  private readonly healthDrops: HealthDrop[] = [];
  private readonly effects: Effect[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly ballistics: PlayerBallistics;
  private progression: Progression;
  private bodies: Record<Mode, Body>;
  private mode: Mode = 'pilot';
  private screen: Screen = 'start';
  private yaw = 0;
  private pitch = 0;
  private readonly jumpMotion = new JumpMotion();
  private ledgeClimb?: { grab: LedgeGrab; startedAt: number; pitch: number; yaw: number };
  private climbVisual?: ClimbVisual;
  private climbIntentUntil = -Infinity;
  private activeVending: VendingType | null = null;
  private lastVendingView = '';
  private shooting = false;
  private mouseAiming = false;
  private mouseCaptureBlocked = false;
  private lastMouseUnlockAt = -Infinity;
  private activeInput: 'mouse' | 'gamepad' = 'mouse';
  private controllerMenuActivation = false;
  private reloadUntil = 0;
  private reloadStartedAt = 0;
  private emptyAt = -10;
  private lastDryClickAt = -10;
  private lastAmmoWarning = -10;
  private lastWalletWarning = -10;
  private nextShot = 0;
  private lastFiredAt = -Infinity;
  private abilityUntil: Record<Mode, number> = { pilot: 0, mech: 0 };
  private healReadyAt = 0;
  private healingUntil = 0;
  private lastHealingAmount = 0;
  private checkpointPersisted = false;
  private respawnUntil = 0;
  private dashUntil = 0;
  private readonly weaponPose = new SimulationWeaponPose();
  private shotSequence = 0;
  private readonly onEvaluationShot?: (shot: EvaluationShot) => void;
  private readonly onEvaluationProc?: (proc: EvaluationProc) => void;
  private time = 0;
  private frames = 0;
  private hudTime = 0;
  private fps = 60;
  private lastZoneWarning = -10;
  private waveActive = false;
  private nextEnemyId = 1;
  private soundEnabled = true;
  private audioContext: AudioContext | null = null;
  private saveWarningShown = false;
  private hasStarted = false;
  private lastPadLabel = '';
  private readonly saveKey: string;
  private readonly autoEncounters: boolean;
  private trainingTargets: boolean;
  private workbenchTesting = false;
  private encounter: EncounterDirector;
  private encounterSeed: number;
  private combatRandom: () => number;
  private readonly onEncounterEvent?: EncounterEventListener;
  private readonly onMeasurement?: (event: CombatMeasurementEvent) => void;
  private encounterRewardId: string | null = null;
  private evaluationActive = false;
  private readonly evaluationDriver: boolean;
  private readonly weaponBalance: Readonly<WeaponBalanceRules>;
  private evaluationInput: EvaluationInput | null = null;
  private manualEvaluation = false;

  constructor(private readonly host: HTMLElement, options: GameOptions = {}) {
    this.encounterSeed = options.encounterSeed ?? 731;
    this.encounter = new EncounterDirector(this.encounterSeed);
    this.combatRandom = options.encounterSeed === undefined ? Math.random : seededRandom(this.encounterSeed);
    this.onEncounterEvent = options.onEncounterEvent;
    this.onMeasurement = options.onMeasurement;
    this.evaluationDriver = options.evaluationDriver ?? false;
    this.soundEnabled = options.soundEnabled ?? !this.evaluationDriver;
    this.manualEvaluation = this.evaluationDriver && (options.manualEvaluation ?? false);
    this.onEvaluationShot = this.evaluationDriver ? options.onEvaluationShot : undefined;
    this.onEvaluationProc = this.evaluationDriver ? options.onEvaluationProc : undefined;
    this.weaponBalance = Object.freeze(options.evaluationDriver && options.evaluationBalanceRules
      ? { secondaryElementCost: options.evaluationBalanceRules.secondaryElementCost, mechHeat: options.evaluationBalanceRules.mechHeat }
      : { ...DEFAULT_WEAPON_BALANCE });
    this.saveKey = options.saveKey ?? SAVE_KEY;
    this.autoEncounters = options.autoEncounters ?? false;
    this.trainingTargets = options.trainingTargets ?? false;
    let saved: string | null = null;
    try { saved = localStorage.getItem(this.saveKey); } catch { /* Storage is optional. */ }
    const loaded = options.initialProgression
      ? deserializeProgression(serializeProgression(options.initialProgression)) : deserializeProgression(saved);
    this.progression = loaded ?? createProgression();
    this.progression.checkpoint = normalizeCheckpoint(this.progression.checkpoint);
    this.checkpointPersisted = loaded !== null && !options.initialProgression;
    this.bodies = this.freshBodies();
    const fraction = options.startingHealthFraction;
    if (fraction !== undefined && Number.isFinite(fraction) && fraction > 0 && fraction <= 1) {
      for (const body of Object.values(this.bodies)) { body.health = Math.max(1, body.health * fraction); body.shield = 0; }
    }
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'game-canvas';
    this.renderer.domElement.setAttribute('aria-label', '3D mechanics proving ground. Use WASD to move and mouse or arrow keys to aim.');
    this.renderer.domElement.tabIndex = 0;
    host.append(this.renderer.domElement);
    this.world = createWorld(this.scene);
    this.dummyVisual = createTestDummy(-1);
    this.damageAnchors.set(this.dummyVisual.group, cacheDamageAnchors(this.dummyVisual.group));
    this.dummyVisual.group.position.set(0, 0, -12);
    this.scene.add(this.dummyVisual.group);
    this.testDummy = { id: -1, mesh: this.dummyVisual.group, heavy: false, shield: 0,
      statuses: createStatusState(), statusEffects: new Map(), statusCoatings: new Map() };
    this.dummyVisual.group.updateWorldMatrix(true, true);
    const dummyBounds = new THREE.Box3().setFromObject(this.dummyVisual.group);
    const dummyCollider = { minX: dummyBounds.min.x, maxX: dummyBounds.max.x, minZ: dummyBounds.min.z, maxZ: dummyBounds.max.z };
    this.world.colliders.push(dummyCollider); this.world.traversalColliders.push({ ...dummyCollider });
    this.dummyVisual.group.traverse(object => {
      if (object instanceof THREE.Mesh && object.userData.enemyId !== this.testDummy.id) this.world.occluders.push(object);
    });
    window.addEventListener('pagehide', () => { this.climbVisual?.dispose(); this.presentation?.dispose(); this.resetTestDummy(); this.dummyVisual.dispose(); });
    this.ballistics = new PlayerBallistics(this.scene, {
      targets: () => this.combatTargets.map(target => ({ id: target.id, root: target.mesh, radius: target === this.testDummy ? this.dummyVisual.radius : target.heavy ? 1.6 : 0.85 })),
      occluders: () => this.world.occluders,
      hit: hit => this.onBallisticHit(hit),
    });
    this.camera.rotation.order = 'YXZ';
    this.placeAtCheckpoint();
    this.updateCheckpointStations();
    this.scene.add(this.camera);
    this.climbVisual = createClimbVisual(); this.scene.add(this.climbVisual.group);
    this.makeWeapons();
    this.comicRenderer = new ComicRenderer(this.renderer, this.scene, this.camera);
    this.comicRenderer.resize(innerWidth, innerHeight, this.renderer.getPixelRatio());
    this.presentation = new GamePresentation({ scene: this.scene, camera: this.camera, weaponRoot: this.weapon,
      ballistics: this.ballistics, comicRenderer: this.comicRenderer });
    this.presentation.setEnabled(options.presentation !== 'legacy');
    this.presentation.setSoundEnabled(this.soundEnabled);
    this.syncPresentationEquipment();
    this.resetPresentationMotion();
    this.ui = new GameUI(host, {
      start: () => this.start(true), resume: () => this.resume(true), closeMenu: () => this.resume(true),
      reset: () => this.reset(), equip: id => this.equip(id), sell: id => this.sell(id),
      spawnWave: () => this.startLiveEncounter(), switchMode: () => this.switchMode(),
      openWorkbench: () => this.menu('workbench'),
      testWorkbench: (item, code) => this.testWorkbenchWeapon(item, code),
      workbenchTargets: () => this.resetWorkbenchTargets(),
      captureMouse: () => this.captureMouse(),
      buySupply: kind => this.buySupply(kind),
      markItem: (id, mark) => this.markItem(id, mark),
      sellJunk: () => this.sellMarkedJunk(),
      buyVendingItem: id => this.buyVendingItem(id),
      buyVendingService: kind => this.buyVendingService(kind),
      takeLoot: action => this.takeLoot(action),
      heal: () => this.heal(),
      toggleSound: () => { this.soundEnabled = !this.soundEnabled; this.presentation?.setSoundEnabled(this.soundEnabled); if (this.soundEnabled) void this.presentation?.unlockAudio(); this.updateHUD(); this.ui.toast(`Sound ${this.soundEnabled ? 'on' : 'off'}`); },
      togglePresentation: () => this.setPresentationMode(this.presentationMode === 'quality' ? 'legacy' : 'quality'),
    }, this.weaponBalance, options.feedbackQuality ?? 'crowd');
    this.mouse = new MouseLook(this.renderer.domElement, {
      look: (dx, dy) => {
        if (this.isRespawning || this.ledgeClimb) return;
        this.activeInput = 'mouse';
        const sensitivity = this.mouseAiming && this.mouse.locked ? 0.0012 : 0.0022;
        this.yaw -= dx * sensitivity;
        this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sensitivity, -1.3, 1.3);
      },
      lockedChanged: locked => {
        if (locked) { this.mouseCaptureBlocked = false; this.activeInput = 'mouse'; }
        else {
          this.lastMouseUnlockAt = performance.now();
          this.shooting = false; this.mouseAiming = false;
          if (this.screen === 'none') this.menu('pause');
        }
        this.updateHUD();
      },
      lockFailed: message => {
        this.mouseCaptureBlocked = true;
        this.ui.toast(message);
        console.warn('Mouse capture:', message);
        this.updateHUD();
      },
    });
    this.ui.setScreen('start', this.progression, this.mode);
    for (const drop of options.startingDrops ?? []) this.addDrop(drop.item, new THREE.Vector3(drop.x, 0, drop.z));
    this.bindInputs(); this.applyWeaponPose(); this.updateSimulationPresentation(0); this.scene.updateMatrixWorld(true);
    this.updateHUD();
  }

  run(): void {
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(this.clock.getDelta(), 0.045);
      if (!this.manualEvaluation) { this.pollGamepad(); this.simulate(dt); }
      this.renderFrame(dt);
    });
  }

  /** Drawing never advances poses, recoil, gameplay animations or input. */
  private renderFrame(dt: number, draw = true): void {
    this.frames++; this.hudTime += dt;
    if (this.hudTime > 0.1) {
      this.fps = Math.round(this.frames / this.hudTime);
      this.frames = 0; this.hudTime = 0; this.updateHUD();
    }
    if (draw) {
      let count = 0;
      if (this.ui.feedbackQuality === 'crowd') for (const target of this.combatTargets) {
        const anchors = this.damageAnchors.get(target.mesh);
        if (!anchors) continue;
        const primary = primaryDamageAnchor(anchors, this.mode);
        for (const anchor of anchors.all) {
          const point = sampleDamageAnchor(anchor, this.damageHead).project(this.camera);
          if (point.z < -1 || point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1) continue;
          const head = this.damageHeads[count] ?? (this.damageHeads[count] = { targetId: target.mesh.uuid, x: 0, y: 0 });
          head.targetId = target.mesh.uuid; head.x = (point.x + 1) / 2; head.y = (1 - point.y) / 2; head.primary = anchor === primary; count++;
        }
      }
      this.damageHeads.length = count;
      this.ui.updateFeedback(this.time, innerWidth, innerHeight, this.screen !== 'none' || this.isRespawning, this.damageHeads);
      this.comicRenderer.render();
    }
  }

  private updateSimulationPresentation(dt: number): void {
    const grounded = this.playerGrounded;
    const presentationDelta = this.screen === 'none' && !this.isRespawning ? Math.max(0, this.time - this.presentationTime) : 0;
    const item = this.progression.inventory.find(entry => entry.id === this.progression.loadouts[this.mode].weapon);
    this.presentation?.update({ dt: presentationDelta, time: this.time, paused: this.screen !== 'none' || this.isRespawning,
      mode: this.mode, distance: Math.hypot(this.camera.position.x - this.presentationPosition.x, this.camera.position.z - this.presentationPosition.z),
      grounded, landed: grounded && !this.presentationGrounded, turn: this.yaw - this.presentationYaw, spec: getWeaponSpec(item) });
    this.presentationTime = this.time; this.presentationPosition.copy(this.camera.position); this.presentationYaw = this.yaw; this.presentationGrounded = grounded;
    const fxDelta = this.screen === 'none' && !this.isRespawning ? dt : 0;
    updateEquipmentEffects(this.mode === 'pilot' ? this.pilotRig.group : this.mechRig.group, fxDelta, this.time);
    if (this.mode === 'pilot') updateEquipmentEffects(this.world.parkedMech, fxDelta, this.time);
    for (const vendor of this.world.vendingMachines) updateEquipmentEffects(vendor.group, fxDelta, this.time);
    this.healingVisual.update(this.mode, this.recoveryAction.progress(this.time), this.recoveryAction.active);
    this.climbVisual?.update(this.ledgeClimb?.grab, this.climbProgress, this.camera);
    this.muzzle.visible = !this.ledgeClimb && !this.presentation?.enabled && this.screen === 'none' && !this.isRespawning && !this.recoveryAction.active && this.time - this.lastFiredAt < 0.055;
    if (this.muzzle.visible) {
      const rig = this.mode === 'pilot' ? this.pilotRig : this.mechRig;
      const socket = rig.muzzles[this.lastMuzzleIndex % rig.muzzles.length];
      if (socket) this.muzzle.position.copy(this.weapon.worldToLocal(socket.getWorldPosition(new THREE.Vector3())));
      else this.muzzle.visible = false;
    }
    this.pilotGun.visible = this.mode === 'pilot' && (!this.ledgeClimb || this.climbProgress < .14 || this.climbProgress > .88);
    this.mechGuns.visible = this.mode === 'mech';
    this.world.parkedMech.visible = this.mode !== 'mech';
  }

  private simulate(dt: number): void {
    if (this.screen !== 'none') return;
    this.time += dt;
    this.updateReloadFoley();
    if (!this.isRespawning) {
      this.updatePlayer(dt);
      this.measure({ type: 'interval', dt, heatBlocked: (this.shooting || this.gamepad.fire) && this.body.overheated, reloading: this.reloadUntil > 0 });
      this.updateEncounter(dt);
      this.camera.updateWorldMatrix(true, false);
      this.updateEnemies(dt); this.updateTargetEffects(this.testDummy, dt); this.updateProjectiles(dt);
      if (!this.isRespawning) {
        this.ballistics.update(dt); this.updateDrops(dt); this.updateRecoveryAction();
        if (this.shooting || this.gamepad.fire) this.fire();
      }
    }
    this.updateEffects(dt);
    // Preserve ordinary 60 Hz ordering: shots use the preceding simulation pose,
    // then recoil settles and the next socket pose is published at tick end.
    if (!this.isRespawning) { this.weaponPose.advance(dt); this.applyWeaponPose(); }
    this.updateSimulationPresentation(dt);
    this.weapon.updateWorldMatrix(true, true);
  }

  get presentationMode(): 'quality' | 'legacy' { return this.presentation?.enabled ? 'quality' : 'legacy'; }
  get presentationDiagnostics() { return this.presentation?.diagnostics; }
  get feedbackQuality(): DamageFeedbackQuality { return this.ui.feedbackQuality; }
  get feedbackDiagnostics() { return this.ui.feedbackDiagnostics; }

  /** Switches presentation only. Active shots, combat state, equipment and saves remain authoritative. */
  setPresentationMode(mode: 'quality' | 'legacy'): void {
    if (!this.presentation || this.presentationMode === mode) return;
    for (const target of this.combatTargets) {
      for (const effect of target.statusEffects.values()) effect.dispose();
      for (const coating of target.statusCoatings.values()) coating.dispose();
      target.statusEffects.clear(); target.statusCoatings.clear();
    }
    this.presentation.setEnabled(mode === 'quality');
    this.presentation.setSoundEnabled(this.soundEnabled);
    if (this.soundEnabled) void this.presentation.unlockAudio();
    this.syncPresentationEquipment();
    for (const enemy of this.enemies) {
      this.presentation.enemy({ root: enemy.mesh, id: enemy.id, role: enemy.role, heavy: enemy.heavy });
      this.damageAnchors.set(enemy.mesh, cacheDamageAnchors(enemy.mesh));
    }
    this.resetPresentationMotion();
    this.updateHUD();
  }

  private syncPresentationEquipment(): void {
    this.presentation?.equipment({ pilotRig: this.pilotRig, mechRig: this.mechRig,
      pilotLook: resolveEquipmentAppearance(this.progression, 'pilot'), mechLook: resolveEquipmentAppearance(this.progression, 'mech'),
      parkedMech: this.world.parkedMech });
  }

  private resetPresentationMotion(): void {
    this.presentationTime = this.time; this.presentationPosition.copy(this.camera.position);
    this.presentationYaw = this.yaw; this.presentationGrounded = this.playerGrounded;
  }

  private updateReloadFoley(): void {
    if (this.reloadUntil <= 0) { this.reloadFoleyStage = 0; return; }
    const progress = (this.time - this.reloadStartedAt) / this.stats.reload;
    if (this.reloadFoleyStage < 1 && progress >= 0.64) { this.presentation?.reload(this.mode, 'in'); this.reloadFoleyStage = 1; }
    if (this.reloadFoleyStage < 2 && progress >= 0.82) { this.presentation?.reload(this.mode, 'bolt'); this.reloadFoleyStage = 2; }
  }

  private get stats() { return getStats(this.progression, this.mode); }
  private get body() { return this.bodies[this.mode]; }
  private get isRespawning() { return this.time < this.respawnUntil; }
  private get climbProgress(): number {
    return this.ledgeClimb ? THREE.MathUtils.clamp((this.time - this.ledgeClimb.startedAt) / LEDGE_CLIMB_DURATION, 0, 1) : 0;
  }
  private get playerGrounded(): boolean {
    if (this.ledgeClimb) return false;
    const floor = this.mode === 'pilot' ? pilotSupportHeight(this.camera.position.x, this.camera.position.z,
      this.jumpMotion.height, this.world.traversalColliders ?? []) : 0;
    return this.jumpMotion.height <= floor + .001 && !(this.jumpMotion.velocity > 0);
  }

  private resetTraversal(): void {
    this.ledgeClimb = undefined; this.climbIntentUntil = -Infinity;
    this.jumpMotion.reset(); this.climbVisual?.update(undefined, 0, this.camera);
  }

  private nearbyLedge(): LedgeGrab | undefined {
    if (this.mode !== 'pilot' || this.ledgeClimb || this.isRespawning || this.recoveryAction.active) return;
    return findLedgeGrab({ x: this.camera.position.x, y: this.jumpMotion.height, z: this.camera.position.z },
      { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }, this.world.traversalColliders ?? [],
      (x, z) => checkZoneAccess('pilot', getZone(x, z).allowed));
  }

  private tryClimb(): boolean {
    const grab = this.nearbyLedge();
    if (!grab) return false;
    this.ledgeClimb = { grab, startedAt: this.time, pitch: this.pitch, yaw: this.yaw };
    this.jumpMotion.velocity = 0; this.climbIntentUntil = -Infinity;
    this.reloadUntil = 0; this.dashUntil = 0; this.mouseAiming = false;
    return true;
  }

  private advanceClimb(): void {
    const climb = this.ledgeClimb;
    if (!climb) return;
    const progress = this.climbProgress, pose = sampleLedgeClimb(climb.grab, progress);
    this.jumpMotion.height = pose.position.y; this.jumpMotion.velocity = 0;
    this.camera.position.set(pose.position.x, pose.position.y + pose.eyeHeight, pose.position.z);
    const look = THREE.MathUtils.lerp(climb.pitch, 0, THREE.MathUtils.smoothstep(progress, 0, .2));
    const faceYaw = Math.atan2(climb.grab.normal.x, climb.grab.normal.z);
    const turn = Math.atan2(Math.sin(faceYaw - climb.yaw), Math.cos(faceYaw - climb.yaw));
    this.yaw = climb.yaw + turn * THREE.MathUtils.smoothstep(progress, 0, .2);
    this.camera.rotation.set(look + pose.pitch, this.yaw, pose.roll);
    if (progress >= 1) {
      this.pitch = look; this.jumpMotion.used = 0; this.ledgeClimb = undefined;
    }
  }

  private placeAtCheckpoint(): void {
    this.resetTraversal();
    const saved = normalizeCheckpoint(this.progression.checkpoint);
    this.progression.checkpoint = saved;
    const checkpoint = getCheckpoint(saved.id)!;
    this.mode = saved.mode;
    this.yaw = checkpoint.spawn.yaw; this.pitch = 0;
    this.camera.position.set(checkpoint.spawn.x, this.mode === 'mech' ? 4.4 : 1.8, checkpoint.spawn.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.world.parkedMech.position.set(checkpoint.parkedMech.x, 0, checkpoint.parkedMech.z);
    this.resetPresentationMotion();
  }

  private updateCheckpointStations(): void {
    const active = normalizeCheckpoint(this.progression.checkpoint).id;
    this.world.checkpointStations.forEach((station, id) => station.setActive(id === active));
  }

  private activateNearbyCheckpoint(): void {
    const nearby = nearestCheckpoint(this.camera.position, this.mode);
    if (!nearby) return;
    const previous = normalizeCheckpoint(this.progression.checkpoint);
    if (previous.id === nearby.id && previous.mode === this.mode) return;
    this.progression.checkpoint = { id: nearby.id, mode: this.mode };
    const persisted = this.save();
    this.updateCheckpointStations();
    if (previous.id !== nearby.id) {
      this.ui.checkpointActivated(nearby.name, persisted);
      this.tone(710, 0.12);
    }
    this.updateHUD();
  }

  private freshBodies(): Record<Mode, Body> {
    const make = (mode: Mode): Body => {
      const stats = getStats(this.progression, mode);
      return { health: stats.maxHealth, shield: stats.maxShield, ammo: stats.magazine, reserve: ammoReserveCapacity(mode, stats.magazine), heat: 0, lastDamage: -10, overheated: false };
    };
    return { pilot: make('pilot'), mech: make('mech') };
  }

  private start(captureMouse = false): void {
    this.hasStarted = true;
    this.save();
    this.resume(captureMouse);
    if ((this.autoEncounters || this.trainingTargets) && !this.enemies.length && !this.waveActive) this.spawnWave();
    this.ui.toast(this.enemies.length ? 'Clear the drones. Collect drops with E. Open loadout with I.' : 'TEST DUMMY straight ahead · K: workbench · N: live encounter');
  }

  private resume(captureMouse = false): void {
    if (!this.hasStarted) { this.start(captureMouse); return; }
    this.screen = 'none';
    void this.presentation?.unlockAudio();
    this.ui.setScreen('none', this.progression, this.mode);
    this.renderer.domElement.focus();
    this.mouse.setEnabled(true);
    if (captureMouse && !this.controllerMenuActivation) this.captureMouse();
  }

  private captureMouse(): void {
    if (this.screen !== 'none' || this.controllerMenuActivation) return;
    this.activeInput = 'mouse';
    this.mouseCaptureBlocked = false;
    this.mouse.requestLock();
  }

  private menu(screen: 'pause' | 'inventory' | 'vending' | 'workbench'): void {
    this.screen = screen;
    this.shooting = false; this.mouseAiming = false; this.keys.clear();
    this.mouse.setEnabled(false);
    this.ui.setScreen(screen, this.progression, this.mode);
    this.updateSimulationPresentation(0);
  }

  private pollGamepad(): void {
    if (this.evaluationDriver && this.evaluationInput) {
      const input = this.evaluationInput;
      this.gamepad = { connected: false, label: '', moveX: input.moveX ?? 0, moveY: input.moveY ?? 0,
        lookX: 0, lookY: 0, sprint: input.sprint ?? false, fire: input.fire ?? false, aim: false, pressed: new Set() };
      return;
    }
    const wasConnected = this.gamepad.connected;
    try { this.gamepad = this.gamepadInput.poll(navigator.getGamepads?.() ?? []); }
    catch { this.gamepad = this.gamepadInput.poll([]); }
    if (this.gamepad.label && this.gamepad.label !== this.lastPadLabel) {
      this.ui.toast(this.gamepad.connected ? `Controller ready · ${this.gamepad.label}` : this.gamepad.label);
    }
    this.lastPadLabel = this.gamepad.label;
    if (wasConnected && !this.gamepad.connected && this.screen === 'none') {
      this.menu('pause'); this.ui.toast('Controller disconnected. Game paused.');
    }
    if (!this.gamepad.connected || document.hidden || !document.hasFocus()) return;
    const pressed = this.gamepad.pressed;
    if (pressed.size || this.gamepad.fire || this.gamepad.aim || Math.abs(this.gamepad.moveX) + Math.abs(this.gamepad.moveY) + Math.abs(this.gamepad.lookX) + Math.abs(this.gamepad.lookY) > 0) this.activeInput = 'gamepad';
    if (pressed.has('pause')) {
      if (this.screen === 'start') this.start();
      else if (this.screen === 'none') this.menu('pause');
      else this.resume();
      return;
    }
    if (pressed.has('inventory') && this.screen !== 'start' && !(this.screen === 'none' && this.isRespawning)) {
      if (this.screen === 'inventory') this.resume();
      else this.menu('inventory');
      return;
    }
    if (this.screen !== 'none') {
      if (this.screen === 'inventory') {
        const shortcut = pressed.has('reload') ? 'KeyX' : pressed.has('ability') ? 'KeyV' : pressed.has('switchMode') ? 'KeyJ' : null;
        if (shortcut) { this.ui.handleInventoryShortcut(shortcut); return; }
      }
      if (pressed.has('back') && this.screen !== 'start') { this.resume(); return; }
      const controls = this.menuControls();
      const index = controls.indexOf(document.activeElement as HTMLElement);
      const active = controls[index];
      const adjust = pressed.has('right') ? 1 : pressed.has('left') ? -1 : 0;
      if (this.screen === 'workbench' && adjust && (active instanceof HTMLSelectElement || active instanceof HTMLInputElement && active.type === 'number')) {
        if (active instanceof HTMLSelectElement) active.selectedIndex = Math.max(0, Math.min(active.options.length - 1, active.selectedIndex + adjust));
        else if (adjust > 0) active.stepUp(); else active.stepDown();
        active.dispatchEvent(new Event('change', { bubbles: true })); return;
      }
      const step = pressed.has('down') || pressed.has('right') ? 1 : pressed.has('up') || pressed.has('left') ? -1 : 0;
      if (step && controls.length) {
        const next = index < 0 ? (step > 0 ? 0 : controls.length - 1) : (index + step + controls.length) % controls.length;
        controls.forEach(control => control.classList.remove('gamepad-focused'));
        controls[next]!.classList.add('gamepad-focused'); controls[next]!.focus();
      } else if (pressed.has('confirm') && controls.length) {
        const target = index >= 0 ? controls[index]! : controls[0]!;
        this.controllerMenuActivation = true;
        try { target.click(); }
        finally { this.controllerMenuActivation = false; }
        // Item selection replaces the inventory DOM. Keep controller focus at the corresponding control.
        if ((this.screen as Screen) !== 'none') {
          const updated = this.menuControls();
          if (!updated.includes(document.activeElement as HTMLElement)) {
            const replacement = updated[Math.min(Math.max(0, index), updated.length - 1)];
            replacement?.classList.add('gamepad-focused'); replacement?.focus();
          }
        }
      }
      return;
    }
    if (this.isRespawning) return;
    if (pressed.has('jump')) this.jump();
    const loot = this.aimedDrop();
    if (pressed.has('reload')) { if (loot) { this.takeLoot('equip', loot); return; } else this.reload(); }
    if (pressed.has('lootJunk') && loot) { this.takeLoot('junk', loot); return; }
    if (pressed.has('interact')) this.interact();
    if (pressed.has('switchMode')) this.switchMode();
    if (pressed.has('ability')) this.ability();
    if (pressed.has('heal')) this.heal();
    if (pressed.has('nextEncounter')) this.spawnWave();
  }

  private menuControls(): HTMLElement[] {
    const overlay = this.host.querySelector('.screen-overlay');
    return overlay ? [...overlay.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      .filter(element => element.getClientRects().length > 0 && element.tabIndex >= 0) : [];
  }

  private bindInputs(): void {
    window.addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
      this.comicRenderer.resize(innerWidth, innerHeight, this.renderer.getPixelRatio());
    });
    window.addEventListener('keydown', event => {
      this.activeInput = 'mouse';
      if (this.screen === 'none' && ['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      if (event.repeat && ['KeyI', 'KeyF', 'KeyE', 'KeyG', 'KeyQ', 'KeyH', 'KeyN', 'KeyK', 'KeyX', 'KeyV', 'KeyJ', 'Space', 'Escape'].includes(event.code)) return;
      if (event.code === 'Escape') {
        // Browser Escape can dispatch the native unlock before its key event.
        if (performance.now() - this.lastMouseUnlockAt < 250) return;
        if (this.screen === 'none') this.menu('pause');
        else if (this.screen !== 'start') this.resume();
        return;
      }
      if (this.screen === 'none' && this.isRespawning) return;
      if (this.screen === 'workbench') {
        const editing = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement;
        if (event.code === 'KeyK' && !editing) this.resume(true);
        return;
      }
      if (event.code === 'KeyK' && this.screen !== 'start') { this.menu('workbench'); return; }
      if (event.code === 'KeyI' || (event.code === 'Tab' && this.screen === 'none')) {
        if (this.screen === 'none') this.menu('inventory');
        else if (this.screen === 'inventory') this.resume(true);
        return;
      }
      if (this.screen === 'inventory' && this.ui.handleInventoryShortcut(event.code)) { event.preventDefault(); return; }
      if (this.screen !== 'none') return;
      this.keys.add(event.code);
      if (event.code === 'KeyR') this.reload();
      if (event.code === 'KeyF') { const loot = this.aimedDrop(); if (loot) this.takeLoot('equip', loot); else this.switchMode(); }
      if (event.code === 'KeyG') this.takeLoot('junk');
      if (event.code === 'KeyE') this.interact();
      if (event.code === 'KeyQ') this.ability();
      if (event.code === 'KeyH') this.heal();
      if (event.code === 'KeyN') this.spawnWave();
      if (event.code === 'Space') this.jump();
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    window.addEventListener('blur', () => { if (!this.manualEvaluation && this.screen === 'none') this.menu('pause'); });
    document.addEventListener('visibilitychange', () => { if (!this.manualEvaluation && document.hidden && this.screen === 'none') this.menu('pause'); });
    this.renderer.domElement.addEventListener('contextmenu', event => event.preventDefault());
    this.renderer.domElement.addEventListener('mousedown', event => {
      if (this.screen !== 'none') return;
      this.activeInput = 'mouse';
      if (event.button === 0 && !this.mouse.locked && !this.mouseCaptureBlocked) {
        this.captureMouse(); return;
      }
      if (event.button === 0) { this.shooting = true; this.fire(); }
      if (event.button === 2) this.mouseAiming = true;
    });
    window.addEventListener('mouseup', event => { if (event.button === 0) this.shooting = false; if (event.button === 2) this.mouseAiming = false; });
  }

  private updatePlayer(dt: number): void {
    const stats = this.stats;
    const aiming = !this.ledgeClimb && !this.recoveryAction.active && (this.gamepad.aim || (this.mouse.locked && this.mouseAiming));
    if (!this.ledgeClimb) {
      this.yaw -= this.gamepad.lookX * dt * 2.5 * (aiming ? 0.5 : 1);
      this.pitch = THREE.MathUtils.clamp(this.pitch - this.gamepad.lookY * dt * 1.9 * (aiming ? 0.5 : 1), -1.3, 1.3);
      if (this.keys.has('ArrowLeft')) this.yaw += dt * 1.7;
      if (this.keys.has('ArrowRight')) this.yaw -= dt * 1.7;
      if (this.keys.has('ArrowUp')) this.pitch = Math.min(1.3, this.pitch + dt);
      if (this.keys.has('ArrowDown')) this.pitch = Math.max(-1.3, this.pitch - dt);
    }
    const fov = THREE.MathUtils.damp(this.camera.fov, aiming ? 52 : 72, 12, dt);
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    const forward = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
    const right = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    const direction = new THREE.Vector3(right + this.gamepad.moveX, 0, -forward + this.gamepad.moveY);
    if (direction.lengthSq() > 1) direction.normalize();
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const sprint = this.gamepad.sprint || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = stats.moveSpeed * (sprint ? 1.55 : 1) * (this.time < this.dashUntil ? 3 : 1);
    const radius = this.mode === 'mech' ? 1.4 : 0.48;
    const traversal = this.world.traversalColliders ?? this.world.colliders;
    const obstacles = this.mode === 'pilot' ? traversal.filter(bounds => (bounds.maxY ?? Infinity) > this.jumpMotion.height + .0001
      && (bounds.minY ?? -Infinity) < this.jumpMotion.height + PILOT_TRAVERSAL.height - .0001) : this.world.colliders;
    const canMove = (x: number, z: number) => {
      if (this.mode === 'pilot' ? !pilotBodyClear(x, z, this.jumpMotion.height, traversal) : !isWalkable(x, z, radius, obstacles)) return false;
      const zone = getZone(x, z);
      if (!checkZoneAccess(this.mode, zone.allowed)) {
        if (this.time - this.lastZoneWarning > 2) { this.ui.toast(zone.allowed === 'pilot' ? 'Pilot access only. Dismount in the proving ground.' : 'Heavy range: a mech is required.'); this.lastZoneWarning = this.time; }
        return false;
      }
      return true;
    };
    if (this.ledgeClimb) this.advanceClimb();
    else {
      const x = this.camera.position.x + direction.x * speed * dt;
      const worldBounds = { minX: -90, maxX: 90, minZ: -55, maxZ: 55 };
      if (canMove(x, this.camera.position.z) && segmentClear(this.camera.position, { x, z: this.camera.position.z }, radius, obstacles, worldBounds)) this.camera.position.x = x;
      const z = this.camera.position.z + direction.z * speed * dt;
      if (canMove(this.camera.position.x, z) && segmentClear(this.camera.position, { x: this.camera.position.x, z }, radius, obstacles, worldBounds)) this.camera.position.z = z;
      const floor = this.mode === 'pilot' ? pilotSupportHeight(this.camera.position.x, this.camera.position.z, this.jumpMotion.height, traversal) : 0;
      const ceiling = this.mode === 'pilot' ? pilotCeilingHeight(this.camera.position.x, this.camera.position.z, this.jumpMotion.height, traversal) - PILOT_TRAVERSAL.height : Infinity;
      this.jumpMotion.update(dt, floor, ceiling);
      this.camera.position.y = (this.mode === 'mech' ? 4.4 : 1.8) + this.jumpMotion.height;
      const forwardMotion = -direction.x * Math.sin(this.yaw) - direction.z * Math.cos(this.yaw);
      if ((this.time < this.climbIntentUntil || this.keys.has('Space') || this.jumpMotion.used > 0 && forwardMotion > .15)
        && this.tryClimb()) this.advanceClimb();
    }
    for (const mode of ['pilot', 'mech'] as const) {
      const body = this.bodies[mode], modeStats = getStats(this.progression, mode);
      body.heat = Math.max(0, body.heat - modeStats.cooling * dt);
      if (body.overheated && body.heat < modeStats.heatCapacity * heatRecoveryFraction(mode, this.weaponBalance)) body.overheated = false;
      if (this.time - body.lastDamage > 4) body.shield = Math.min(modeStats.maxShield, body.shield + (mode === 'mech' ? 26 : 14) * dt);
    }
    if (this.reloadUntil > 0 && this.time >= this.reloadUntil) {
      const loaded = reloadAmmo(this.body.ammo, this.body.reserve, stats.magazine);
      this.body.ammo = loaded.ammo; this.body.reserve = loaded.reserve;
      this.reloadUntil = 0; this.tone(480, 0.045);
    }
    this.activateNearbyCheckpoint();
  }

  private switchMode(): void {
    if (!this.hasStarted || this.isRespawning) return;
    if (this.ledgeClimb || this.jumpMotion.height > .01) { this.ui.toast('Return to the ground before changing form.'); return; }
    if (this.recoveryAction.active) { this.ui.toast('Finish recovery before changing form.'); return; }
    const next: Mode = this.mode === 'pilot' ? 'mech' : 'pilot';
    if (next === 'mech' && ['infiltration', 'defenses'].includes(this.encounter.snapshot.phase)) {
      this.ui.toast('Disable both defense relays on foot before boarding.'); return;
    }
    const zone = getZone(this.camera.position.x, this.camera.position.z);
    if (!checkZoneAccess(next, zone.allowed)) { this.ui.toast(`Return to the proving ground to ${next === 'pilot' ? 'dismount' : 'mount your mech'}.`); return; }
    if (next === 'mech' && this.world.parkedMech.position.distanceTo(new THREE.Vector3(this.camera.position.x, 0, this.camera.position.z)) > 11) {
      this.ui.toast('Move within 11 m of your parked mech, then press F.'); return;
    }
    if (next === 'pilot') {
      // Leave the chassis at a clear point so a later mount remains possible.
      const p = this.camera.position;
      const candidates = [new THREE.Vector3(p.x + 4, 0, p.z), new THREE.Vector3(p.x - 4, 0, p.z), new THREE.Vector3(p.x, 0, p.z + 4), new THREE.Vector3(p.x, 0, p.z - 4)];
      const spot = candidates.find(c => isWalkable(c.x, c.z, 1.4, this.world.colliders) && getZone(c.x, c.z).allowed === 'both');
      if (!spot) { this.ui.toast('Move into an open area before dismounting.'); return; }
      this.world.parkedMech.position.copy(spot);
    } else if (!isWalkable(this.camera.position.x, this.camera.position.z, 1.4, this.world.colliders)) {
      this.ui.toast('Move clear of the wall before mounting.'); return;
    }
    this.mode = next;
    this.presentation?.mount(next);
    this.resetPresentationMotion();
    if (this.trainingTargets) this.spawnWave();
    this.healingUntil = 0; this.lastHealingAmount = 0;
    this.reloadUntil = 0; this.nextShot = this.time + 0.3; this.lastFiredAt = -Infinity;
    this.resetTraversal();
    this.ui.toast(next === 'mech' ? 'MECH ONLINE · cannon / heat management / Q shockwave' : 'PILOT ACTIVE · rifle / sprint / Q dash');
    if (this.screen !== 'none') this.ui.setScreen(this.screen, this.progression, this.mode);
    this.applyWeaponPose(); this.scene.updateMatrixWorld(true);
    this.updateHUD(); this.tone(next === 'mech' ? 95 : 250, 0.2);
  }

  private reload(): void {
    if (this.ledgeClimb || this.isRespawning || this.recoveryAction.active || this.reloadUntil || this.body.ammo === this.stats.magazine) return;
    if (this.body.reserve <= 0) {
      if (this.time - this.lastAmmoWarning > 3) { this.ui.toast('No reserve ammo. Restock at Weapons & Ammo.'); this.lastAmmoWarning = this.time; }
      return;
    }
    this.reloadStartedAt = this.time;
    this.reloadUntil = this.time + this.stats.reload;
    this.reloadFoleyStage = 0; this.presentation?.reload(this.mode, 'out');
    this.tone(190, 0.1);
  }

  private jump(): void {
    if (this.screen !== 'none' || this.ledgeClimb || this.isRespawning) return;
    this.climbIntentUntil = this.time + .22;
    if (this.tryClimb()) return;
    if (!this.jumpMotion.request(this.mode)) return;
    if (this.jumpMotion.used === 2) {
      this.burst(this.camera.position.clone().add(new THREE.Vector3(0, -1, 0)), this.mode === 'mech' ? 0xffc857 : 0x74e2d5, 8);
      this.tone(this.mode === 'mech' ? 180 : 420, 0.09);
    }
  }

  private fire(): void {
    if (this.ledgeClimb || this.screen !== 'none' || this.isRespawning || this.recoveryAction.active || this.time < this.nextShot || this.reloadUntil || this.body.overheated) return;
    if (this.body.ammo <= 0) {
      if (this.time - this.lastDryClickAt > 0.4) {
        this.lastDryClickAt = this.time; this.emptyAt = this.time;
        this.presentation?.dry(this.mode);
        this.tone(85, 0.055);
      }
      this.reload(); return;
    }
    this.body.ammo--;
    this.measure({ type: 'shot', mode: this.mode, ammo: 1 });
    this.lastFiredAt = this.time;
    if (this.body.ammo === 0) this.emptyAt = this.time;
    this.nextShot = this.time + 1 / this.stats.fireRate;
    this.body.heat += heatPerShot(this.mode, this.stats.fireRate, this.weaponBalance);
    if (this.body.heat >= this.stats.heatCapacity) { this.body.overheated = true; this.ui.toast('OVERHEATED · allow your weapon to cool', '#f8a259'); }
    this.scene.updateMatrixWorld(true);
    this.ray.setFromCamera(new THREE.Vector2(), this.camera);
    const targets = [...this.world.occluders, ...this.combatTargets.map(target => target.mesh)];
    const hit = this.ray.intersectObjects(targets, true)[0];
    const end = hit?.point ?? this.camera.position.clone().add(this.ray.ray.direction.clone().multiplyScalar(120));
    const rig = this.mode === 'pilot' ? this.pilotRig : this.mechRig;
    this.lastMuzzleIndex = this.mode === 'mech' ? this.body.ammo % Math.max(1, rig.muzzles.length) : 0;
    const origin = rig.muzzles[this.lastMuzzleIndex]?.getWorldPosition(new THREE.Vector3()) ?? this.camera.position.clone();
    const item = this.progression.inventory.find(entry => entry.id === this.progression.loadouts[this.mode].weapon);
    const spec = getWeaponSpec(item);
    (this.muzzle.material as THREE.MeshBasicMaterial).color.set(elementColors[spec.element]);
    const direction = end.clone().sub(origin).normalize();
    this.shotSequence++;
    this.onEvaluationShot?.({ at: this.time, sequence: this.shotSequence, mode: this.mode,
      origin: { x: origin.x, y: origin.y, z: origin.z }, direction: { x: direction.x, y: direction.y, z: direction.z },
      aimPoint: { x: end.x, y: end.y, z: end.z }, spec: { ...spec } });
    this.ballistics.fire(origin, direction, spec,
      effectiveProjectileDamage(this.stats.damage, spec, this.weaponBalance), undefined, item?.brand);
    this.weaponPose.kick(this.mode);
    this.presentation?.shot({ mode: this.mode, rig, muzzleIndex: this.lastMuzzleIndex, spec });
    this.pitch = Math.min(1.3, this.pitch + (this.mode === 'mech' ? 0.012 : 0.004));
    this.tone(this.mode === 'mech' ? 65 : 135, this.mode === 'mech' ? 0.16 : 0.055);
    this.updateHUD();
  }

  private onBallisticHit(hit: BallisticHit): void {
    const enemy = this.combatTargets.find(candidate => candidate.id === hit.targetId);
    const movable = this.enemies.find(candidate => candidate === enemy);
    if (!enemy || movable && movable.health <= 0) return;
    const procs = new Set(getWeaponElements(hit.spec).filter(element => element !== 'kinetic' && this.combatRandom() < getHitStatusChance(hit.spec)
      && applyStatus(enemy.statuses, element, this.time, getHitStatusPower(hit.damage, hit.spec))));
    for (const element of procs) this.onEvaluationProc?.({ at: this.time, mode: this.mode, targetId: enemy.id, element,
      projectile: hit.spec.projectile, chance: getHitStatusChance(hit.spec), power: getHitStatusPower(hit.damage, hit.spec) });
    const modifiers = getStatusModifiers(enemy.statuses, this.time);
    const exposed = !movable?.heavy || movable.brain.phase === 'recover' || movable.brain.phase === 'stagger';
    const critical = hit.critical && exposed;
    const front = movable?.heavy && hit.direction.x * Math.sin(movable.mesh.rotation.y) + hit.direction.z * Math.cos(movable.mesh.rotation.y) < -0.25;
    const armor = movable?.heavy && front && movable.shield > 0 && !exposed ? 0.55 : movable?.heavy && exposed ? 1.15 : 1;
    const damage = shieldAdjustedDamage(enemy.shield, hit.damage * (critical ? movable?.heavy ? 2.2 : 1.7 : 1) * armor * modifiers.incomingDamage, modifiers.shieldDamage);
    const result = this.hurtTarget(enemy, damage, undefined, critical);
    this.showEnemyDamage(enemy, result.healthDamage + result.shieldDamage, critical, undefined, hit.point);

    if (movable && hit.spec.element === 'kinetic' && ['slug', 'spike', 'rocket'].includes(hit.spec.projectile)) {
      const force = movable.heavy ? 0.25 : 0.75;
      this.displaceEnemy(movable, hit.direction.x * force, hit.direction.z * force);
    }
    if (procs.has('gravity')) {
      for (const other of this.enemies) {
        const delta = hit.point.clone().sub(other.mesh.position); delta.y = 0;
        const distance = delta.length();
        if (distance > 6 || !this.clearLine(hit.point, other.mesh.position.clone().setY(other.heavy ? 2.6 : 1.5))) continue;
        applyStatus(other.statuses, 'gravity', this.time, getHitStatusPower(hit.damage, hit.spec));
        other.gravityPoint = hit.point.clone();
        if (distance > 0.05) {
          delta.multiplyScalar(Math.min(1.4, distance * 0.3) / distance);
          this.displaceEnemy(other, delta.x, delta.z);
        }
      }
      this.burst(hit.point, Number.parseInt(elementColors.gravity.slice(1), 16), 6);
    }
    if (procs.has('shock') && modifiers.chain) {
      const next = this.combatTargets.filter(other => other !== enemy && other.mesh.position.distanceTo(enemy.mesh.position) < 6)
        .sort((a, b) => a.mesh.position.distanceToSquared(enemy.mesh.position) - b.mesh.position.distanceToSquared(enemy.mesh.position))
        .find(other => this.clearLine(hit.point, other.mesh.position.clone().setY(other.heavy ? 2.6 : 1.5)));
      if (next) {
        const end = next.mesh.position.clone().setY(next.heavy ? 2.6 : 1.5);
        this.tracer(hit.point, end, Number.parseInt(elementColors.shock.slice(1), 16));
        const chained = this.hurtTarget(next, shieldAdjustedDamage(next.shield, hit.damage * 0.35, 1.6), 'shock');
        this.showEnemyDamage(next, chained.healthDamage + chained.shieldDamage, false, 'shock');
      }
    }
  }

  private clearLine(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const direction = to.clone().sub(from), distance = direction.length();
    if (distance < 0.05) return true;
    direction.normalize();
    // Start just beyond the impact surface, so it cannot hide every splash/chain.
    this.ray.set(from.clone().addScaledVector(direction, 0.035), direction);
    const obstruction = this.ray.intersectObjects(this.world.occluders, true)[0];
    return !obstruction || obstruction.distance >= distance - 0.07;
  }

  private get combatTargets(): CombatTarget[] { return [...this.enemies, this.testDummy]; }

  private showEnemyDamage(enemy: CombatTarget, amount: number, critical = false, effect?: DamageEffect, impact?: THREE.Vector3,
    kind: 'direct' | 'status' = 'direct'): void {
    if (amount <= 0) return;
    const point = this.damagePoint;
    if (impact) { point.copy(impact); point.y += .2; }
    else if (enemy === this.testDummy) enemy.mesh.localToWorld(point.copy(this.dummyVisual.damageAnchor));
    else point.copy(enemy.mesh.position).setY(enemy.heavy ? 5.1 : 2.75);
    this.camera.updateMatrixWorld();
    const projected = point.project(this.camera);
    if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) return;
    const x = (projected.x + 1) / 2, y = (1 - projected.y) / 2;
    const anchors = this.damageAnchors.get(enemy.mesh);
    // A killing hit disposes actor art before this callback. Detached art can
    // no longer supply a world anchor; retain the actual impact/damage point.
    const anchor = enemy.mesh.parent && anchors ? primaryDamageAnchor(anchors, this.mode) : undefined;
    const head = anchor ? sampleDamageAnchor(anchor, this.damageHead).project(this.camera) : undefined;
    this.ui.hit(amount, critical, effect, { x, y }, { targetId: enemy.mesh.uuid, kind, at: this.time,
      head: head && head.z >= -1 && head.z <= 1 ? { x: (head.x + 1) / 2, y: (1 - head.y) / 2 } : undefined });
  }

  private displaceEnemy(enemy: Enemy, dx: number, dz: number): void {
    if (!this.enemies.includes(enemy)) return;
    const p = enemy.mesh.position, x = p.x + dx, z = p.z + dz;
    if (isWalkable(x, z, enemy.heavy ? 1.4 : 0.6, this.world.colliders)
      && getZone(x, z).id === getZone(enemy.home.x, enemy.home.z).id) p.set(x, p.y, z);
  }

  private spawnWave(): void {
    if (!this.hasStarted || this.isRespawning) return;
    this.workbenchTesting = false;
    if (this.trainingTargets) {
      this.clearCombat();
      const heavy = this.mode === 'mech';
      const equipped = this.progression.inventory.find(item => item.id === this.progression.loadouts[this.mode].weapon);
      const spec = getWeaponSpec(equipped);
      const directDps = effectiveProjectileDamage(this.stats.damage, spec, this.weaponBalance) * spec.pellets * this.stats.fireRate;
      for (const [index, x] of [0, -3.2, 3.2].entries()) {
        const enemy = this.makeEnemy(x, index === 0 ? -4 : -6, heavy);
        enemy.maxHealth = enemy.health = Math.min(100_000_000, Math.max(heavy ? 1800 : 900, directDps * 12));
        enemy.maxShield = enemy.shield = index === 0 ? (heavy ? 350 : 180) : 0;
        enemy.bars.update(enemy.health, enemy.maxHealth, enemy.shield, enemy.maxShield);
        this.enemies.push(enemy); this.scene.add(enemy.mesh);
      }
      this.ui.toast('TEST TARGETS READY · N resets targets · I changes equipment');
      this.updateHUD(); return;
    }
    this.startEncounter();
  }

  private makeEnemy(x: number, z: number, heavy: boolean, role: EnemyRole = heavy ? 'heavy' : 'flanker', boss = false): Enemy {
    const id = this.nextEnemyId++;
    const visual = createEncounterEnemy(id, role, boss);
    const group = visual.group;
    const bars = createEnemyBars();
    bars.group.position.set(0, heavy ? boss ? 6 : 5.2 : 3.1, 0); group.add(bars.group);
    group.position.set(x, 0, z);
    this.presentation?.enemy({ root: group, id, role, heavy });
    this.damageAnchors.set(group, cacheDamageAnchors(group));
    const health = heavy ? 260 : 100, shield = heavy ? 180 : 0;
    bars.update(health, health, shield, shield);
    return { id, mesh: group, health, maxHealth: health, shield, maxShield: shield, heavy, bars, home: group.position.clone(),
      role, boss, brain: createEnemyBrain(role, boss, id), navigation: createNavigationState(), visual, lastPhase: 'advance',
      statuses: createStatusState(), statusEffects: new Map(), statusCoatings: new Map(), gravityPoint: null };
  }

  /** Explicit harness entrypoint; normal keyboard/controller start uses the same path. */
  public startEncounter(seed?: number): void {
    if (!['idle', 'complete'].includes(this.encounter.snapshot.phase)) {
      this.ui.toast('Finish this run or use the workbench to leave it before replaying.'); return;
    }
    this.clearCombat();
    if (seed !== undefined && Number.isFinite(seed) && seed !== this.encounterSeed) {
      this.encounterSeed = seed; this.encounter = new EncounterDirector(seed);
    }
    this.combatRandom = seededRandom(this.encounterSeed + this.encounter.snapshot.run);
    this.encounterRewardId = null;
    this.trainingTargets = false; this.workbenchTesting = false; this.hasStarted = true;
    this.bodies = this.freshBodies(); this.mode = 'pilot';
    this.weaponPose.reset(); this.shotSequence = 0;
    this.reloadUntil = 0; this.nextShot = this.time + 0.3; this.respawnUntil = 0;
    this.recoveryAction.cancel(); this.resetTraversal(); this.dashUntil = 0;
    this.abilityUntil = { pilot: 0, mech: 0 }; this.healReadyAt = this.time;
    this.camera.position.set(0, 1.8, 0); this.yaw = Math.PI / 2; this.pitch = 0;
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.resetPresentationMotion(); this.applyWeaponPose(); this.scene.updateMatrixWorld(true);
    this.world.parkedMech.position.set(ENCOUNTER.boarding.x, 0, ENCOUNTER.boarding.z);
    this.encounter.start(); this.evaluationActive = true;
    this.processEncounterActions(); this.resume();
    this.ui.toast('RELAY BREAK · 3–5 min · Follow the beacon to PILOT ACCESS. Q dodges rushers.');
    this.updateHUD();
  }

  public startDummyEvaluation(mode?: Mode): void {
    if (mode) this.mode = mode;
    this.hasStarted = true; this.resetWorkbenchTargets(); this.evaluationActive = true;
  }

  public resetEvaluation(): void {
    this.finishMeasurement('aborted'); this.clearCombat(); this.encounter.reset(); this.encounterRewardId = null;
    this.resetTestDummy(); this.weaponPose.reset(); this.shotSequence = 0;
    this.applyWeaponPose(); this.scene.updateMatrixWorld(true); this.updateHUD();
  }

  public getEncounterSnapshot() {
    return { ...this.encounter.snapshot, time: this.time, screen: this.screen, paused: this.screen !== 'none', mode: this.mode,
      weaponBalance: { ...this.weaponBalance },
      simulationPose: { recoil: this.weaponPose.recoil, shotSequence: this.shotSequence,
        weaponPosition: { x: this.weapon.position.x, y: this.weapon.position.y, z: this.weapon.position.z },
        weaponRotation: { x: this.weapon.rotation.x, y: this.weapon.rotation.y, z: this.weapon.rotation.z } },
      yaw: this.yaw, pitch: this.pitch, parkedMech: { x: this.world.parkedMech.position.x, z: this.world.parkedMech.position.z },
      traversal: { climbing: !!this.ledgeClimb, progress: this.climbProgress, feet: this.jumpMotion.height, grounded: this.playerGrounded,
        phase: this.ledgeClimb ? sampleLedgeClimb(this.ledgeClimb.grab, this.climbProgress).phase : undefined,
        landing: this.ledgeClimb?.grab.landing },
      navigation: this.evaluationDriver ? this.world.colliders.map(bounds => ({ ...bounds })) : undefined,
      position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      enemies: this.enemies.map(e => ({ id: e.id, position: { x: e.mesh.position.x, z: e.mesh.position.z },
        health: e.health, shield: e.shield, role: e.role, boss: e.boss, weakPointOpen: e.brain.phase === 'recover' || e.brain.phase === 'stagger',
        conditions: this.evaluationDriver ? { frozen: getStatusModifiers(e.statuses, this.time).frozen, moveSpeed: getStatusModifiers(e.statuses, this.time).moveSpeed } : undefined,
        brainPhase: this.evaluationDriver ? e.brain.phase : undefined })),
      defenses: ENCOUNTER.relays.map(r => ({ ...r, disabled: this.encounter.snapshot.disabledRelays.includes(r.id) })),
      body: { ...this.body }, progression: deserializeProgression(serializeProgression(this.progression))! };
  }

  public driveEvaluation(input: EvaluationInput): void {
    if (!this.evaluationDriver) throw new Error('Evaluation driver is disabled.');
    this.evaluationInput = { ...input };
    this.shooting = false; this.keys.clear();
    if (input.yaw !== undefined && Number.isFinite(input.yaw)) this.yaw = input.yaw;
    if (input.pitch !== undefined && Number.isFinite(input.pitch)) this.pitch = THREE.MathUtils.clamp(input.pitch, -1.3, 1.3);
    if (input.interact) this.interact();
    if (input.switchMode) this.switchMode();
    if (input.ability) this.ability();
    if (input.heal) this.heal();
    if (input.reload) this.reload();
    if (input.jump) this.jump();
  }

  public stepEvaluation(dt = 1 / 60): void {
    if (!this.evaluationDriver) throw new Error('Evaluation driver is disabled.');
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.25) throw new Error('Evaluation step must be in (0, 0.25].');
    this.manualEvaluation = true; this.pollGamepad();
    const count = Math.ceil(dt * 60);
    for (let i = 0; i < count; i++) this.simulate(dt / count);
    this.updateHUD();
  }

  public renderEvaluation(renderDelta = 1 / 60, draw = false): void {
    if (!this.evaluationDriver) throw new Error('Evaluation driver is disabled.');
    if (!Number.isFinite(renderDelta) || renderDelta < 0 || renderDelta > 0.25) throw new Error('Render delta must be in [0, 0.25].');
    this.manualEvaluation = true;
    this.renderFrame(renderDelta, draw);
  }

  private emitEncounter(event: EncounterEvent): void { this.onEncounterEvent?.(event); }
  private measure(event: CombatMeasurementPayload): void {
    if (this.evaluationActive) this.onMeasurement?.({ ...event, at: this.time } as CombatMeasurementEvent);
  }
  private finishMeasurement(outcome: 'complete' | 'failed' | 'timeout' | 'aborted'): void {
    if (!this.evaluationActive) return;
    this.measure({ type: 'finish', outcome }); this.evaluationActive = false;
  }

  private processEncounterActions(): void {
    for (const action of this.encounter.drainActions()) {
      if (action.type === 'spawn') {
        if (this.mode === 'mech' && ['battle', 'boss'].includes(this.encounter.snapshot.phase)) {
          this.bodies.mech.reserve = ammoReserveCapacity('mech', getStats(this.progression, 'mech').magazine);
          const wave = this.encounter.snapshot;
          this.ui.toast(`${wave.phase === 'boss' ? 'MINI-BOSS' : `SQUAD ${wave.wave} / ${ENCOUNTER.battleGroups}`} · reserve ammo restocked`);
        }
        for (const spawn of action.enemies) this.spawnEncounterEnemy(spawn);
      }
      if (action.type === 'event') this.emitEncounter(action.event);
      if (action.type === 'phase') {
        this.ui.toast(this.encounter.snapshot.objective, '#79d3be');
        if (action.phase === 'boarding') {
          // The existing checkpoint remains authoritative for reconstruction.
          this.world.parkedMech.position.set(ENCOUNTER.boarding.x, 0, ENCOUNTER.boarding.z);
          this.bodies.mech = this.freshBodies().mech;
        }
        if (action.phase === 'battle' || action.phase === 'boss') {
          const body = this.bodies.mech, stats = getStats(this.progression, 'mech');
          body.reserve = Math.max(body.reserve, ammoReserveCapacity('mech', stats.magazine));
        }
      }
      if (action.type === 'reward') {
        const item = createEncounterReward(this.progression, this.encounter.snapshot.run, this.encounterSeed);
        this.encounterRewardId = item.id;
        this.addDrop(item, new THREE.Vector3(ENCOUNTER.reward.x, 0, ENCOUNTER.reward.z));
        this.addCashDrop(100 + this.progression.wave * 15, new THREE.Vector3(ENCOUNTER.reward.x + 2, 0, ENCOUNTER.reward.z));
        this.save();
      }
    }
  }

  private spawnEncounterEnemy(spawn: EnemySpawn): void {
    if (!isWalkable(spawn.x, spawn.z, spawn.role === 'heavy' ? 1.4 : 0.6, this.world.colliders)) {
      throw new Error(`Encounter spawn is obstructed: ${spawn.id}`);
    }
    const enemy = this.makeEnemy(spawn.x, spawn.z, spawn.role === 'heavy', spawn.role, spawn.boss);
    enemy.spawnId = spawn.id; enemy.health = enemy.maxHealth = spawn.health; enemy.shield = enemy.maxShield = spawn.shield;
    enemy.bars.update(enemy.health, enemy.maxHealth, enemy.shield, enemy.maxShield);
    this.enemies.push(enemy); this.scene.add(enemy.mesh);
    this.measure({ type: 'target-spawn', targetId: String(enemy.id), health: enemy.health, shield: enemy.shield });
  }

  private updateEncounter(dt: number): void {
    this.encounter.update(dt, { mode: this.mode, position: this.camera.position });
    this.processEncounterActions();
    const snapshot = this.encounter.snapshot;
    for (const objective of this.world.encounterObjectives) {
      const complete = snapshot.disabledRelays.includes(objective.id);
      const active = objective.kind === 'relay' ? snapshot.activeRelayIds.includes(objective.id) : snapshot.phase === 'loot';
      objective.visual.update(active, complete, this.time);
    }
  }

  private updateTargetEffects(enemy: CombatTarget, dt: number): void {
    for (const tick of advanceStatuses(enemy.statuses, this.time)) {
      const modifiers = getStatusModifiers(enemy.statuses, this.time);
      const result = this.hurtTarget(enemy, shieldAdjustedDamage(enemy.shield, tick.damage * modifiers.incomingDamage, modifiers.shieldDamage), tick.effect);
      this.showEnemyDamage(enemy, result.healthDamage + result.shieldDamage, false, tick.effect as DamageEffect, undefined, 'status');
      if (enemy !== this.testDummy && !this.enemies.some(candidate => candidate === enemy)) return;
    }
    const active = activeStatusElements(enemy.statuses, this.time);
    for (const [element, effect] of enemy.statusEffects) {
      if (!active.includes(element)) {
        effect.dispose(); enemy.statusEffects.delete(element);
        enemy.statusCoatings.get(element)?.dispose(); enemy.statusCoatings.delete(element);
      }
    }
    for (const element of active) {
      let effect = enemy.statusEffects.get(element);
      if (!effect) {
        effect = this.presentation?.status(enemy.mesh, element);
        if (!effect) {
          const legacy = new ElementEffects(enemy.mesh, element, { style: 'status', scale: enemy === this.testDummy ? 1.45 : 1 });
          legacy.group.position.y = enemy === this.testDummy ? 2.3 : 1.2;
          effect = legacy;
          enemy.statusCoatings.set(element, new ElementCoating(enemy.mesh, element, { scope: 'enemy' }));
        }
        enemy.statusEffects.set(element, effect);
      }
      effect.setIntensity?.(Math.min(1, Math.max(0, (enemy.statuses[element]!.expiresAt - this.time) / 0.2)));
      effect.update(dt, this.time);
      enemy.statusCoatings.get(element)?.update(dt, this.time);
    }
  }

  private updateEnemies(dt: number): void {
    for (const enemy of [...this.enemies]) {
      if (!this.enemies.includes(enemy)) continue;
      this.updateTargetEffects(enemy, dt);
      if (!this.enemies.includes(enemy)) continue;
      const p = enemy.mesh.position;
      const modifiers = getStatusModifiers(enemy.statuses, this.time);
      const origin = p.clone().setY(enemy.heavy ? 3.1 : 1.7);
      const visible = this.clearLine(origin, this.camera.position);
      const decision = updateEnemyBrain(enemy.brain, { dt: this.trainingTargets || modifiers.frozen ? 0 : dt,
        position: p, player: this.camera.position, hasLineOfSight: visible, moveSpeedScale: modifiers.moveSpeed });
      if (!this.trainingTargets && !modifiers.frozen) {
        const next = navigateEnemy(p, decision.destination, Math.hypot(decision.move.x, decision.move.z), dt,
          enemy.heavy ? 1.4 : 0.6, this.world.colliders, getZone(enemy.home.x, enemy.home.z).bounds, enemy.navigation);
        p.x = next.x; p.z = next.z;
        if (modifiers.pull && enemy.gravityPoint) {
          const delta = enemy.gravityPoint.clone().sub(p); delta.y = 0;
          if (delta.length() > 0.3) { delta.setLength(Math.min(delta.length(), 3 * dt)); this.displaceEnemy(enemy, delta.x, delta.z); }
        } else enemy.gravityPoint = null;
        const attack = decision.attack;
        if (attack && visible) {
          if (attack.kind !== 'melee') this.presentation?.enemyAttack(enemy.mesh, enemy.heavy ? 'mech' : 'pilot');
          if (attack.kind === 'melee') {
            if (Math.hypot(p.x - this.camera.position.x, p.z - this.camera.position.z) <= attack.range
              && Math.hypot(attack.target.x - this.camera.position.x, attack.target.z - this.camera.position.z) < 3) this.hurtPlayer(attack.damage);
          } else {
            for (let shot = 0; shot < attack.shots; shot++) {
              const mesh = new THREE.Mesh(new THREE.SphereGeometry(enemy.heavy ? 0.22 : 0.13, 6, 4),
                new THREE.MeshBasicMaterial({ color: enemy.heavy ? 0xffb33f : 0xff553f }));
              mesh.userData.comicOverlay = true; mesh.position.copy(origin); this.scene.add(mesh);
              const aim = new THREE.Vector3(attack.target.x + (shot - (attack.shots - 1) / 2) * 1.8,
                this.camera.position.y - (this.mode === 'mech' ? 1 : 0.4), attack.target.z).sub(origin).normalize();
              this.projectiles.push({ mesh, velocity: aim.multiplyScalar(attack.speed), life: 3.5, damage: attack.damage });
            }
          }
        }
      }
      if (this.isRespawning) return;
      enemy.mesh.rotation.y = decision.facing;
      enemy.bars.group.quaternion.copy(this.camera.quaternion).premultiply(enemy.mesh.quaternion.clone().invert());
      enemy.visual.update(this.trainingTargets || modifiers.frozen ? 0 : dt, this.time,
        { ...decision.presentation, moving: decision.presentation.moving && !this.trainingTargets && !modifiers.frozen,
          shieldFraction: enemy.maxShield > 0 ? enemy.shield / enemy.maxShield : 0 });
      if (enemy.lastPhase !== enemy.brain.phase) {
        enemy.lastPhase = enemy.brain.phase;
        this.emitEncounter({ type: 'enemy-phase', id: enemy.id, role: enemy.role, phase: enemy.brain.phase, position: { x: p.x, z: p.z } });
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i]!;
      const prior = projectile.mesh.position.clone();
      const travel = projectile.velocity.length() * dt;
      this.ray.set(prior, projectile.velocity.clone().normalize());
      const obstruction = this.ray.intersectObjects(this.world.occluders, true)[0];
      projectile.mesh.position.addScaledVector(projectile.velocity, dt);
      projectile.life -= dt;
      const player = this.camera.position.clone(); player.y -= this.mode === 'mech' ? 1 : 0.4;
      const line = new THREE.Line3(prior, projectile.mesh.position);
      const nearest = line.closestPointToPoint(player, true, new THREE.Vector3());
      const hit = nearest.distanceTo(player) < (this.mode === 'mech' ? 1.9 : 0.85);
      const blocked = !!obstruction && obstruction.distance <= travel;
      if (hit && !blocked) {
        this.hurtPlayer(projectile.damage);
        // Defeat clears the collection; stop before touching disposed entries.
        if (this.screen !== 'none' || this.isRespawning) return;
      }
      if (hit || blocked || projectile.life <= 0) { this.disposeObject(projectile.mesh); this.projectiles.splice(i, 1); }
    }
  }

  private hurtTarget(target: CombatTarget, damage: number, cause?: DamageEffect, critical = false, source: 'direct' | 'status' | 'ability' = cause ? 'status' : 'direct'): EnemyDamageResult {
    if (target === this.testDummy) {
      const recorded = this.dummyMeter.record(damage, this.time, critical, cause);
      const result = { healthDamage: recorded ? damage : 0, shieldDamage: 0, killed: false };
      this.measure({ type: 'damage', targetId: 'dummy', target: 'dummy', health: result.healthDamage, shield: 0, source, critical });
      return result;
    }
    const enemy = this.enemies.find(candidate => candidate === target);
    return enemy ? this.hurtEnemy(enemy, damage, cause, critical, source) : { healthDamage: 0, shieldDamage: 0, killed: false };
  }

  private hurtEnemy(enemy: Enemy, damage: number, cause?: DamageEffect, critical = false, source: 'direct' | 'status' | 'ability' = cause ? 'status' : 'direct'): EnemyDamageResult {
    const result = applyEnemyDamage(enemy, damage);
    this.measure({ type: 'damage', targetId: String(enemy.id), target: 'enemy', health: result.healthDamage, shield: result.shieldDamage, source, critical });
    if (result.healthDamage + result.shieldDamage > 0) {
      this.presentation?.enemyHit(enemy.mesh);
      staggerEnemy(enemy.brain, critical || result.shieldDamage > 0 && enemy.shield === 0);
      this.emitEncounter({ type: 'enemy-hit', id: enemy.id, role: enemy.role, weakPoint: critical, shieldBroken: result.shieldDamage > 0 && enemy.shield === 0 });
    }
    enemy.bars.update(enemy.health, enemy.maxHealth, enemy.shield, enemy.maxShield);
    if (!result.killed) return result;
    const irradiated = cause === 'radiation' || getStatusModifiers(enemy.statuses, this.time).radiationPulse;
    const at = enemy.mesh.position.clone();
    this.burst(at.clone().add(new THREE.Vector3(0, 1.4, 0)), 0xffb054, 7);
    enemy.bars.dispose();
    for (const effect of enemy.statusEffects.values()) effect.dispose();
    enemy.statusEffects.clear();
    for (const coating of enemy.statusCoatings.values()) coating.dispose();
    enemy.statusCoatings.clear();
    this.presentation?.release(enemy.mesh);
    enemy.visual.dispose();
    this.enemies.splice(this.enemies.indexOf(enemy), 1);
    this.progression.kills++;
    this.emitEncounter({ type: 'enemy-killed', id: enemy.id, role: enemy.role, boss: enemy.boss });
    this.measure({ type: 'target-killed', targetId: String(enemy.id) });
    if (enemy.spawnId) this.encounter.enemyKilled(enemy.spawnId);
    const supplies = rollEnemySupplies(this.combatRandom);
    if (supplies.cash) this.addCashDrop(rollCashValue(this.progression.wave, enemy.heavy, this.combatRandom), at.clone().add(new THREE.Vector3(0.8, 0, 0.5)));
    if (supplies.health) this.addHealthDrop(at.clone().add(new THREE.Vector3(-0.8, 0, 0.5)));
    const target: Mode = enemy.heavy || this.progression.kills % 2 === 0 ? 'mech' : 'pilot';
    this.addDrop(rollItem(target, Math.min(100, this.progression.wave), this.combatRandom), at);
    if (irradiated) {
      const center = at.clone().setY(enemy.heavy ? 2.6 : 1.5);
      const presented = this.presentation?.handlesPulse('radiation') ?? false;
      if (!presented) this.burst(center, Number.parseInt(elementColors.radiation.slice(1), 16), 14);
      const recipients: ConfirmedElementPulse['recipients'][number][] = [];
      for (const other of this.combatTargets) {
        if (other.mesh.position.distanceTo(at) > 5) continue;
        const point = other.mesh.position.clone().setY(other.heavy ? 2.6 : 1.5);
        if (!this.clearLine(center, point)) continue;
        const pulse = this.hurtTarget(other, enemy.maxHealth * 0.18, other === this.testDummy ? 'radiation' : undefined, false, 'status');
        this.showEnemyDamage(other, pulse.healthDamage + pulse.shieldDamage, false, 'radiation');
        if (presented && pulse.healthDamage + pulse.shieldDamage > 0) recipients.push({ target: other.mesh, point, normal: center.clone().sub(point).normalize(), exposure: 1 });
      }
      if (presented) this.presentation?.confirmedPulse({ element: 'radiation', point: center, energy: enemy.maxHealth * 0.18, radius: 5, recipients });
    }
    if (this.waveActive && !this.enemies.length) {
      this.waveActive = false;
      this.progression.wave++;
      this.ui.toast('ENCOUNTER CLEAR · Collect your drops. Press N for the next encounter.', '#79d3be');
    }
    this.save();
    return result;
  }

  private hurtPlayer(damage: number): void {
    if (this.screen !== 'none') return;
    const absorbed = Math.min(this.body.shield, damage);
    this.body.shield -= absorbed;
    this.body.health -= damage - absorbed;
    this.measure({ type: 'received', shield: absorbed, health: Math.min(Math.max(0, this.body.health + damage - absorbed), damage - absorbed) });
    this.body.lastDamage = this.time;
    this.ui.damage();
    if (this.body.health <= 0) {
      this.finishMeasurement('failed'); this.encounter.reset(); this.encounterRewardId = null;
      this.clearCombat();
      this.placeAtCheckpoint();
      this.bodies = this.freshBodies(); this.reloadUntil = 0; this.jumpMotion.reset();
      this.healingUntil = 0; this.lastHealingAmount = 0;
      this.recoveryAction.cancel();
      this.shooting = false; this.mouseAiming = false; this.keys.clear(); this.dashUntil = 0;
      this.weaponPose.reset(); this.emptyAt = -10; this.applyWeaponPose(); this.nextShot = this.time + 1.25; this.lastFiredAt = -Infinity;
      this.respawnUntil = this.time + 1.25;
      const checkpoint = getCheckpoint(this.progression.checkpoint!.id)!;
      this.save();
      this.ui.toast(`RECONSTRUCTING · ${checkpoint.name} · equipment retained · N to retry`, '#a4d8b1');
      this.updateHUD();
    }
  }

  private ability(): void {
    if (this.ledgeClimb || this.isRespawning || this.recoveryAction.active) return;
    const remaining = this.abilityUntil[this.mode] - this.time;
    if (remaining > 0) { this.ui.toast(`Ability ready in ${Math.ceil(remaining)} s`); return; }
    this.abilityUntil[this.mode] = this.time + (this.mode === 'mech' ? 9 : 4);
    if (this.mode === 'pilot') {
      this.dashUntil = this.time + 0.24;
      this.ui.toast('DASH · 4 s cooldown');
    } else {
      this.burst(this.camera.position.clone().setY(0.4), 0x6bddd4, 18);
      this.body.heat = Math.max(0, this.body.heat - 40);
      let hits = 0;
      for (const enemy of this.combatTargets) {
        if (enemy.mesh.position.distanceTo(this.camera.position) < 14 && this.clearLine(this.camera.position, enemy.mesh.position.clone().setY(enemy.heavy ? 2.6 : 1.5))) {
          const movable = this.enemies.find(candidate => candidate === enemy);
          if (movable) staggerEnemy(movable.brain, true);
          const hit = this.hurtTarget(enemy, this.stats.damage * 1.6, undefined, false, 'ability');
          this.showEnemyDamage(enemy, hit.healthDamage + hit.shieldDamage); hits++;
        }
      }
      this.ui.toast(`SHOCKWAVE · ${hits} targets staggered · vented 40 heat · 9 s cooldown`);
      this.tone(45, 0.35);
    }
  }

  private heal(): void {
    if (this.ledgeClimb || this.screen !== 'none' || this.isRespawning || this.recoveryAction.active) return;
    const target = { health: this.body.health, maxHealth: this.stats.maxHealth };
    const result = trySelfHeal(target, this.time, this.healReadyAt);
    if (result.healed <= 0) {
      this.ui.toast(result.reason === 'cooldown'
        ? `Recovery ready in ${Math.ceil(getHealCooldownRemaining(this.time, this.healReadyAt))} s`
        : this.mode === 'mech' ? 'Hull is already fully repaired.' : 'Health is already full.');
      return;
    }
    // Validate on a copy. Health and cooldown commit when the injector/repair
    // driver reaches its contact pose, rather than before the animation starts.
    if (!this.recoveryAction.begin(this.mode, this.time)) return;
    this.reloadUntil = 0; this.mouseAiming = false;
    this.tone(190, 0.08); this.updateHUD();
  }

  private updateRecoveryAction(): void {
    const step = this.recoveryAction.update(this.time);
    if (!step.apply || step.apply !== this.mode || this.isRespawning) return;
    const target = { health: this.body.health, maxHealth: this.stats.maxHealth };
    const result = trySelfHeal(target, this.time, this.healReadyAt);
    if (result.healed > 0) {
      this.body.health = target.health;
      this.healReadyAt = result.readyAt;
      this.showHealing(result.healed, this.mode === 'mech' ? 'FIELD REPAIR' : 'MED INJECTOR');
    }
  }

  private showHealing(amount: number, label: string): void {
    this.healingUntil = this.time + 0.75;
    this.lastHealingAmount = Math.ceil(amount);
    this.ui.toast(`${label} · +${Math.ceil(amount)} ${this.mode === 'mech' ? 'HULL' : 'HEALTH'}`, '#8be1b7');
    this.tone(580, 0.14);
    this.updateHUD();
  }

  private addHealthDrop(position: THREE.Vector3): void {
    if (this.healthDrops.length >= 40) this.disposeObject(this.healthDrops.shift()!.mesh);
    const mesh = createHealthPickup(); mesh.position.copy(position);
    this.scene.add(mesh); this.healthDrops.push({ mesh, time: Math.random() * 6 });
  }

  private nearestHealth(): HealthDrop | undefined {
    let nearest: HealthDrop | undefined, distance = this.mode === 'mech' ? 7 : 4;
    for (const drop of this.healthDrops) {
      const d = Math.hypot(this.camera.position.x - drop.mesh.position.x, this.camera.position.z - drop.mesh.position.z);
      if (d < distance) { nearest = drop; distance = d; }
    }
    return nearest;
  }

  private collectHealth(drop: HealthDrop): boolean {
    const index = this.healthDrops.indexOf(drop);
    if (index < 0) return false;
    const target = { health: this.body.health, maxHealth: this.stats.maxHealth };
    const amount = healHealth(target, HEALTH_PICKUP_FRACTION);
    if (amount <= 0) return false;
    this.body.health = target.health;
    this.healthDrops.splice(index, 1); this.disposeObject(drop.mesh);
    this.showHealing(amount, 'HEALTH PICKUP');
    return true;
  }

  private addCashDrop(amount: number, position: THREE.Vector3): void {
    if (this.cashDrops.length >= 120) { this.cashDrops[0]!.amount += amount; return; }
    const mesh = new THREE.Group(), coins = new THREE.Group();
    const gold = createComicMaterial(0xffcf52), darkGold = createComicMaterial(0x9b641d);
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.09, 8), gold);
    coin.rotation.x = Math.PI / 2; coins.add(coin);
    const inset = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.095, 8), darkGold);
    inset.rotation.x = Math.PI / 2; coins.add(inset);
    const glyphMaterial = new THREE.MeshBasicMaterial({ color: 0xffed9a });
    for (const [x, y, w, h] of [[-0.08, 0, 0.04, 0.22], [0, 0.09, 0.18, 0.04], [0, -0.09, 0.18, 0.04]]) {
      const segment = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.018), glyphMaterial);
      segment.position.set(x, y, 0.06); coins.add(segment);
    }
    coins.position.y = 0.35;
    const glow = createLootEffects(0xffce4b); glow.scale.set(0.7, 0.35, 0.7);
    mesh.add(coins, glow); mesh.position.copy(position); this.scene.add(mesh);
    this.cashDrops.push({ amount, mesh, time: Math.random() * 6 });
  }

  private nearestCash(): CashDrop | undefined {
    let nearest: CashDrop | undefined, distance = this.mode === 'mech' ? 7 : 4;
    for (const cash of this.cashDrops) {
      const d = Math.hypot(this.camera.position.x - cash.mesh.position.x, this.camera.position.z - cash.mesh.position.z);
      if (d < distance) { nearest = cash; distance = d; }
    }
    return nearest;
  }

  private collectCash(cash: CashDrop): void {
    const index = this.cashDrops.indexOf(cash);
    if (index < 0) return;
    if (!creditWallet(this.progression, cash.amount)) {
      if (this.time - this.lastWalletWarning > 3) { this.ui.toast('Wallet limit reached. Spend credits at the service pad.'); this.lastWalletWarning = this.time; }
      return;
    }
    this.cashDrops.splice(index, 1); this.disposeObject(cash.mesh);
    this.ui.toast(`+ ${cash.amount} CR`, '#ffcf52'); this.tone(820, 0.06);
    this.save(); this.updateHUD();
  }

  private shopAvailable(): boolean {
    return !this.isRespawning && Math.hypot(this.camera.position.x, this.camera.position.z - 16) < 5
      && !this.enemies.some(enemy => enemy.mesh.position.distanceTo(this.camera.position) < 18);
  }

  private buySupply(kind: SupplyKind): void {
    if (!this.shopAvailable()) { this.ui.toast('Return to the service pad and clear nearby targets to trade.'); return; }
    if (kind === 'repair' && (['pilot', 'mech'] as const).every(mode => {
      const stats = getStats(this.progression, mode), body = this.bodies[mode];
      return body.health >= stats.maxHealth && body.shield >= stats.maxShield && body.ammo >= stats.magazine
        && body.reserve >= ammoReserveCapacity(mode, stats.magazine) && body.heat === 0;
    })) { this.ui.toast('Both loadouts are already fully serviced. No credits spent.'); return; }
    const purchase = purchaseSupply(this.progression, kind);
    if (!purchase.ok) { this.ui.toast(purchase.reason ?? 'Purchase unavailable.'); return; }
    if (kind === 'repair') {
      const previous = this.bodies;
      this.bodies = this.freshBodies();
      for (const mode of ['pilot', 'mech'] as const) this.bodies[mode].reserve = Math.max(this.bodies[mode].reserve, previous[mode].reserve);
      this.reloadUntil = 0;
      this.healingUntil = 0; this.lastHealingAmount = 0;
      this.recoveryAction.cancel();
      this.ui.toast(`Both loadouts serviced · ${purchase.spent} CR`);
    } else if (purchase.item) {
      this.ui.toast(`Purchased ${purchase.item.name} · ${purchase.spent} CR · equip with I`, rarityColors[purchase.item.rarity]);
    }
    this.save(); this.updateHUD();
  }

  private nearbyVending() {
    return this.vendingForStation(this.focusedStation());
  }

  private vendingForStation(station: ReturnType<typeof focusedStation>) {
    return station?.kind === 'vending' ? this.world.vendingMachines.find(vendor => vendor.id === station.vendor) : undefined;
  }

  private focusedStation() {
    this.scene.updateMatrixWorld(true);
    this.ray.setFromCamera(new THREE.Vector2(), this.camera);
    return focusedStation(this.ray.intersectObjects(this.world.occluders, true), this.mode === 'mech' ? 7 : 4);
  }

  private vendingAvailable(type: VendingType): boolean {
    const vendor = this.world.vendingMachines.find(entry => entry.id === type);
    return !!vendor && !this.isRespawning
      && Math.hypot(vendor.position.x - this.camera.position.x, vendor.position.z - this.camera.position.z) <= (this.mode === 'mech' ? 7 : 4)
      && !this.enemies.some(enemy => enemy.mesh.position.distanceTo(this.camera.position) < 18);
  }

  private updateVending(): void {
    if (!this.activeVending) return;
    const names = { weapons: 'Weapons & Ammo', medical: 'Health & Shields', mech: 'Mech Parts' };
    const pilotStats = getStats(this.progression, 'pilot'), mechStats = getStats(this.progression, 'mech');
    const pilot = this.bodies.pilot, mech = this.bodies.mech;
    const data = {
      type: this.activeVending, name: names[this.activeVending],
      offers: getVendingOffers(this.progression, this.activeVending),
      servicePrices: getVendingServicePrices(this.progression.wave),
      canBuy: this.vendingAvailable(this.activeVending),
      serviceEnabled: {
        pilotAmmo: pilot.ammo < pilotStats.magazine || pilot.reserve < ammoReserveCapacity('pilot', pilotStats.magazine),
        mechAmmo: mech.ammo < mechStats.magazine || mech.reserve < ammoReserveCapacity('mech', mechStats.magazine),
        medical: pilot.health < pilotStats.maxHealth || pilot.shield < pilotStats.maxShield,
        mechRepair: mech.health < mechStats.maxHealth || mech.shield < mechStats.maxShield || mech.heat > 0,
      },
    };
    const signature = JSON.stringify([data, this.progression.credits, this.progression.inventory.map(item => [item.id, item.mark])]);
    if (signature === this.lastVendingView) return;
    this.lastVendingView = signature;
    this.ui.setVending(data);
  }

  private buyVendingItem(id: string): void {
    if (this.screen !== 'vending' || !this.activeVending || !this.vendingAvailable(this.activeVending)) return;
    const purchase = purchaseVendingItem(this.progression, this.activeVending, id);
    if (!purchase.ok) { this.ui.toast(purchase.reason ?? 'Purchase unavailable.'); return; }
    this.ui.toast(`Purchased ${purchase.item!.name} · ${purchase.spent} CR`, rarityColors[purchase.item!.rarity]);
    this.save(); this.updateVending(); this.updateHUD();
  }

  private buyVendingService(kind: VendingService): void {
    if (this.screen !== 'vending' || !this.activeVending || !this.vendingAvailable(this.activeVending)) return;
    const allowed: Record<VendingService, VendingType> = { 'pilot-ammo': 'weapons', 'mech-ammo': 'weapons', medical: 'medical', 'mech-repair': 'mech' };
    if (allowed[kind] !== this.activeVending) return;
    const mode: Mode = kind === 'mech-ammo' || kind === 'mech-repair' ? 'mech' : 'pilot';
    const body = this.bodies[mode], stats = getStats(this.progression, mode);
    const ammo = kind === 'pilot-ammo' || kind === 'mech-ammo';
    const capacity = ammoReserveCapacity(mode, stats.magazine);
    const needed = ammo ? body.ammo < stats.magazine || body.reserve < capacity
      : body.health < stats.maxHealth || body.shield < stats.maxShield || (kind === 'mech-repair' && body.heat > 0);
    if (!needed) { this.ui.toast('Already full. No credits spent.'); return; }
    const prices = getVendingServicePrices(this.progression.wave);
    const cost = kind === 'pilot-ammo' ? prices.pilotAmmo : kind === 'mech-ammo' ? prices.mechAmmo : kind === 'medical' ? prices.medical : prices.mechRepair;
    if (!spendCredits(this.progression, cost)) { this.ui.toast('Not enough credits.'); return; }
    if (ammo) {
      body.ammo = stats.magazine; body.reserve = Math.max(body.reserve, capacity);
      if (mode === this.mode) { this.reloadUntil = 0; this.emptyAt = -10; }
    } else {
      body.health = stats.maxHealth; body.shield = stats.maxShield;
      if (kind === 'mech-repair') { body.heat = 0; body.overheated = false; }
    }
    this.ui.toast(`${ammo ? `${mode.toUpperCase()} AMMO RESTOCKED` : mode === 'pilot' ? 'PILOT HEALTH + SHIELD RESTORED' : 'MECH HULL + SHIELD RESTORED'} · ${cost} CR`, '#a4e3bc');
    this.save(); this.updateVending(); this.updateHUD();
  }

  private sellMarkedJunk(): void {
    if (this.screen !== 'vending' || !this.activeVending || !this.vendingAvailable(this.activeVending)) return;
    const result = sellJunk(this.progression);
    this.ui.toast(result.sold ? `SOLD ${result.sold} JUNK · +${result.earned} CR` : 'No sellable junk. Favorites and equipped items stay protected.', '#ffcf52');
    this.save(); this.updateVending(); this.updateHUD();
  }

  private addDrop(item: Item, position: THREE.Vector3): void {
    if (this.drops.length >= 60) this.disposeObject(this.drops.shift()!.mesh);
    const mesh = new THREE.Group();
    const color = new THREE.Color(rarityColors[item.rarity]);
    const model = createDroppedItemModel(item);
    model.position.y = 0.12; model.rotation.y = Math.PI / 6;
    mesh.name = `loot-${item.id}`;
    mesh.add(model, createLootEffects(color)); mesh.position.copy(position); mesh.position.y = 0;
    this.scene.add(mesh);
    this.drops.push({ item, mesh, time: Math.random() * 6 });
  }

  private updateDrops(dt: number): void {
    for (const drop of this.drops) {
      drop.time += dt; drop.mesh.children[0]!.rotation.y += dt * 0.6; drop.mesh.children[0]!.position.y = 0.12 + Math.sin(drop.time * 2) * 0.035;
      updateEquipmentEffects(drop.mesh, dt, this.time);
    }
    for (const cash of [...this.cashDrops]) {
      cash.time += dt;
      cash.mesh.children[0]!.rotation.y += dt * 1.5;
      cash.mesh.children[0]!.position.y = 0.35 + Math.sin(cash.time * 2) * 0.06;
      if (Math.hypot(cash.mesh.position.x - this.camera.position.x, cash.mesh.position.z - this.camera.position.z) < (this.mode === 'mech' ? 3.5 : 2.25)) this.collectCash(cash);
    }
    const maxHealth = this.stats.maxHealth;
    for (const drop of [...this.healthDrops]) {
      drop.time += dt;
      drop.mesh.children[0]!.rotation.y += dt * 0.9;
      drop.mesh.children[0]!.position.y = 0.4 + Math.sin(drop.time * 2) * 0.06;
      if (this.body.health < maxHealth && Math.hypot(drop.mesh.position.x - this.camera.position.x, drop.mesh.position.z - this.camera.position.z) < (this.mode === 'mech' ? 3.5 : 2.25)) this.collectHealth(drop);
    }
  }

  private nearestDrop(): Drop | undefined {
    let nearest: Drop | undefined, distance = this.mode === 'mech' ? 7 : 4;
    for (const drop of this.drops) {
      const d = Math.hypot(this.camera.position.x - drop.mesh.position.x, this.camera.position.z - drop.mesh.position.z);
      if (d < distance && this.clearLine(this.camera.position, drop.mesh.position.clone().setY(0.9))) { nearest = drop; distance = d; }
    }
    return nearest;
  }

  /** The center of the item/beam gets a modest aim cone for both mouse and stick input. */
  private aimedDrop(): Drop | undefined {
    if (this.screen !== 'none' || this.isRespawning) return;
    const forward = this.camera.getWorldDirection(new THREE.Vector3());
    let nearest: Drop | undefined, best = -Infinity;
    const range = this.mode === 'mech' ? 7 : 4;
    for (const drop of this.drops) {
      const point = drop.mesh.position.clone().setY(0.95);
      if (Math.hypot(point.x - this.camera.position.x, point.z - this.camera.position.z) > range) continue;
      const towards = point.clone().sub(this.camera.position);
      const dot = forward.dot(towards.clone().normalize());
      if (dot < Math.cos(20 * Math.PI / 180) || !this.clearLine(this.camera.position, point)) continue;
      const score = dot - towards.length() * 0.002;
      if (score > best) { best = score; nearest = drop; }
    }
    return nearest;
  }

  private targetedEnemy(): CombatTarget | undefined {
    this.ray.setFromCamera(new THREE.Vector2(), this.camera);
    const hit = this.ray.intersectObjects([...this.world.occluders, ...this.combatTargets.map(enemy => enemy.mesh)], true)
      .find(hit => hit.object.userData.comicOverlay !== true);
    if (hit) {
      const direct = this.combatTargets.find(enemy => enemy.id === hit.object.userData.enemyId);
      if (direct) return direct;
    }
    const forward = this.camera.getWorldDirection(new THREE.Vector3());
    let target: CombatTarget | undefined, best = Math.cos(10 * Math.PI / 180);
    for (const enemy of this.combatTargets) {
      const point = enemy === this.testDummy ? enemy.mesh.localToWorld(this.dummyVisual.aimPoint.clone()) : enemy.mesh.position.clone().setY(enemy.heavy ? 2.6 : 1.3);
      const towards = point.clone().sub(this.camera.position);
      if (towards.length() > 80) continue;
      const score = forward.dot(towards.normalize());
      if (score > best && this.clearLine(this.camera.position, point)) { best = score; target = enemy; }
    }
    return target;
  }

  private takeLoot(action: LootAction, drop = this.aimedDrop()): void {
    if (this.screen !== 'none' || this.isRespawning || !drop || !this.drops.includes(drop)) return;
    if (this.progression.inventory.length >= INVENTORY_CAPACITY) { this.ui.toast('Backpack full. Sell unused gear or junk first.'); return; }
    this.progression.inventory.push(drop.item);
    if (drop.item.id === this.encounterRewardId && this.encounter.collectReward(drop.item.id)) {
      this.encounterRewardId = null; this.progression.wave++;
      this.processEncounterActions(); this.finishMeasurement('complete');
    }
    if (action === 'junk') setItemMark(this.progression, drop.item.id, 'junk');
    this.disposeObject(drop.mesh); this.drops.splice(this.drops.indexOf(drop), 1);
    if (action === 'equip') this.equip(drop.item.id);
    else this.ui.toast(`+ ${drop.item.name}${action === 'junk' ? ' · MARKED JUNK' : ''}`, rarityColors[drop.item.rarity]);
    this.save(); this.tone(680, 0.08); this.updateHUD();
  }

  private interact(): void {
    if (this.ledgeClimb || this.screen !== 'none' || this.isRespawning) return;
    const relay = ENCOUNTER.relays.find(r => Math.hypot(r.x - this.camera.position.x, r.z - this.camera.position.z) <= r.radius
      && this.encounter.snapshot.activeRelayIds.includes(r.id));
    if (relay && this.clearLine(this.camera.position, new THREE.Vector3(relay.x, 3.2, relay.z))
      && this.encounter.disableRelay(relay.id, this.mode, this.camera.position)) {
      this.processEncounterActions(); this.ui.toast(`${relay.name} disabled`, '#79d3be'); this.tone(560, 0.12); this.updateHUD(); return;
    }
    const aimed = this.aimedDrop();
    if (aimed) { this.takeLoot('take', aimed); return; }
    const station = this.focusedStation();
    if (station?.kind === 'workbench') { this.menu('workbench'); return; }
    if (station?.kind === 'service') {
      if (this.enemies.some(enemy => enemy.mesh.position.distanceTo(this.camera.position) < 18)) { this.ui.toast('Service terminal unavailable while targets are nearby.'); return; }
      this.menu('pause'); return;
    }
    const vendor = station?.kind === 'vending' ? this.world.vendingMachines.find(entry => entry.id === station.vendor) : undefined;
    if (vendor) {
      if (!this.vendingAvailable(vendor.id)) { this.ui.toast('Clear nearby hostiles before using this machine.'); return; }
      this.activeVending = vendor.id;
      this.updateVending(); this.menu('vending'); return;
    }
    const health = this.nearestHealth();
    if (health && this.collectHealth(health)) return;
    const cash = this.nearestCash();
    if (cash) { this.collectCash(cash); return; }
    // An empty crosshair has no fallback menu action.
  }

  private testWorkbenchWeapon(item: Item, _code: string): void {
    if (this.screen !== 'workbench' || item.slot !== 'weapon' || item.value !== 0 || item.id !== `sandbox-workbench-${item.target}`) return;
    const index = this.progression.inventory.findIndex(entry => entry.id === item.id);
    if (index < 0 && this.progression.inventory.length >= INVENTORY_CAPACITY) { this.ui.toast('Backpack full. Free one slot for the reusable test weapon.'); return; }
    if (index >= 0) this.progression.inventory[index] = item;
    else this.progression.inventory.push(item);
    this.mode = item.target;
    this.equip(item.id);
    this.resetWorkbenchTargets();
    this.ui.toast('FIXED TEST DUMMY · K: edit this build · N: optional live encounter');
  }

  private resetWorkbenchTargets(): void {
    if (!this.hasStarted || this.isRespawning) return;
    this.trainingTargets = false;
    this.clearCombat(); this.resetTestDummy(); this.workbenchTesting = true;
    this.resetTraversal();
    this.camera.position.set(0, this.mode === 'mech' ? 4.4 : 1.8, 7);
    this.yaw = 0; this.pitch = 0;
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.reloadUntil = 0; this.nextShot = this.time;
    this.body.ammo = this.stats.magazine; this.body.reserve = ammoReserveCapacity(this.mode, this.stats.magazine);
    this.body.heat = 0; this.body.overheated = false;
    this.recoveryAction.cancel(); this.weaponPose.reset(); this.shotSequence = 0; this.emptyAt = -10;
    this.applyWeaponPose(); this.scene.updateMatrixWorld(true); this.resetPresentationMotion();
    this.resume(true); this.updateHUD();
  }

  private resetTestDummy(): void {
    this.ui?.clearFeedback?.('test-dummy-reset');
    for (const effect of this.testDummy.statusEffects.values()) effect.dispose();
    for (const coating of this.testDummy.statusCoatings.values()) coating.dispose();
    this.testDummy.statusEffects.clear(); this.testDummy.statusCoatings.clear();
    this.testDummy.statuses = createStatusState(); this.dummyMeter.clear();
  }

  private startLiveEncounter(): void {
    this.workbenchTesting = false;
    if (this.trainingTargets) { this.trainingTargets = false; this.clearCombat(); this.waveActive = false; }
    this.spawnWave(); this.resume(true);
  }

  private equip(id: string): void {
    const item = this.progression.inventory.find(candidate => candidate.id === id);
    if (!item) return;
    const old = getStats(this.progression, item.target);
    if (!equipItem(this.progression, id)) return;
    const stats = getStats(this.progression, item.target), body = this.bodies[item.target];
    body.health = Math.min(stats.maxHealth, body.health / old.maxHealth * stats.maxHealth);
    body.shield = Math.min(stats.maxShield, body.shield);
    const ammunition = fitMagazine(body.ammo, body.reserve, stats.magazine);
    body.ammo = ammunition.ammo; body.reserve = ammunition.reserve;
    if (item.target === this.mode) {
      this.reloadUntil = 0;
      if (item.slot === 'weapon') this.lastFiredAt = -Infinity;
    }
    this.refreshEquipmentVisuals();
    this.save(); this.ui.setScreen(this.screen, this.progression, this.mode);
    this.ui.toast(`Equipped ${item.name}`); this.updateHUD();
  }

  private sell(id: string): void {
    if (!sellItem(this.progression, id)) { this.ui.toast('Equipped and favorite items are protected from selling.'); return; }
    this.save(); this.ui.setScreen(this.screen, this.progression, this.mode); this.updateHUD();
  }

  private markItem(id: string, mark: 'favorite' | 'junk' | null): void {
    if (!setItemMark(this.progression, id, mark)) return;
    this.save(); this.ui.setScreen(this.screen, this.progression, this.mode); this.updateHUD();
  }

  private reset(): void {
    this.resetTestDummy(); this.workbenchTesting = false;
    this.activeVending = null; this.lastVendingView = '';
    this.clearCombat();
    for (const drop of this.drops) this.disposeObject(drop.mesh);
    this.drops.length = 0;
    for (const cash of this.cashDrops) this.disposeObject(cash.mesh);
    this.cashDrops.length = 0;
    for (const drop of this.healthDrops) this.disposeObject(drop.mesh);
    this.healthDrops.length = 0;
    this.progression = createProgression(); this.bodies = this.freshBodies(); this.mode = 'pilot';
    this.weaponPose.reset(); this.shotSequence = 0;
    this.recoveryAction.cancel(); this.refreshEquipmentVisuals();
    this.placeAtCheckpoint(); this.updateCheckpointStations(); this.respawnUntil = 0;
    this.reloadUntil = 0; this.nextShot = 0; this.lastFiredAt = -Infinity; this.abilityUntil = { pilot: 0, mech: 0 };
    this.healReadyAt = 0; this.healingUntil = 0; this.lastHealingAmount = 0;
    this.resetTraversal(); this.save(); this.resume(); this.spawnWave();
  }

  private clearCombat(): void {
    this.ui?.clearFeedback?.('combat-cleared');
    this.finishMeasurement('aborted');
    if (this.encounter.snapshot.phase !== 'complete') this.encounter.reset();
    this.ballistics.clear();
    for (const enemy of this.enemies) {
      enemy.bars.dispose();
      for (const effect of enemy.statusEffects.values()) effect.dispose();
      for (const coating of enemy.statusCoatings.values()) coating.dispose();
      enemy.statusEffects.clear(); enemy.statusCoatings.clear(); this.presentation?.release(enemy.mesh); enemy.visual.dispose();
    }
    for (const projectile of this.projectiles) this.disposeObject(projectile.mesh);
    this.enemies.length = 0; this.projectiles.length = 0; this.waveActive = false;
  }

  private save(): boolean {
    try {
      localStorage.setItem(this.saveKey, serializeProgression(this.progression));
      this.checkpointPersisted = true;
      return true;
    } catch {
      this.checkpointPersisted = false;
      if (!this.saveWarningShown) { this.ui.toast('Browser storage unavailable. Progress will last for this session.'); this.saveWarningShown = true; }
      return false;
    }
  }

  private encounterHUD(): HUDData['encounter'] {
    const snapshot = this.encounter.snapshot;
    if (snapshot.phase === 'idle' || this.workbenchTesting || this.trainingTargets) return undefined;
    let point: { x: number; z: number } | undefined, label = '';
    if (snapshot.phase === 'infiltration') {
      point = this.camera.position.x > -35 ? { x: -35, z: 0 } : this.enemies[0]?.mesh.position; label = 'Vault sentries';
    } else if (snapshot.phase === 'defenses') {
      point = [...ENCOUNTER.relays].filter(r => snapshot.activeRelayIds.includes(r.id))
        .sort((a, b) => Math.hypot(a.x - this.camera.position.x, a.z - this.camera.position.z) - Math.hypot(b.x - this.camera.position.x, b.z - this.camera.position.z))[0]; label = 'Defense relay';
    } else if (snapshot.phase === 'boarding') {
      point = this.mode === 'pilot' ? ENCOUNTER.boarding : this.camera.position.x < 35 ? { x: 35, z: 0 } : ENCOUNTER.battleEntry;
      label = this.mode === 'pilot' ? 'Parked frame' : 'Heavy range';
    } else if (snapshot.phase === 'loot') { point = ENCOUNTER.reward; label = 'Guaranteed upgrade'; }
    else if (snapshot.phase === 'battle' || snapshot.phase === 'boss') {
      point = this.enemies.find(e => e.boss)?.mesh.position ?? this.enemies[0]?.mesh.position; label = snapshot.phase === 'boss' ? 'Mini-boss' : 'Hostiles';
    }
    let waypoint = '';
    if (point) {
      const dx = point.x - this.camera.position.x, dz = point.z - this.camera.position.z;
      const angle = Math.atan2(Math.sin(Math.atan2(-dx, -dz) - this.yaw), Math.cos(Math.atan2(-dx, -dz) - this.yaw));
      const arrow = Math.abs(angle) < 0.35 ? '↑' : Math.abs(angle) > 2.6 ? '↓' : angle > 0 ? '←' : '→';
      waypoint = `${arrow} ${label} · ${Math.round(Math.hypot(dx, dz))} m`;
    }
    const target = this.targetedEnemy();
    const enemy = this.enemies.find(e => e === target);
    const tactic = enemy ? enemy.brain.phase === 'windup' ? `${enemy.boss ? 'BOSS' : enemy.role.toUpperCase()} WINDUP · move off the attack lane`
      : enemy.role === 'heavy' ? enemy.brain.phase === 'recover' || enemy.brain.phase === 'stagger' ? 'CORE EXPOSED · circle behind and hit the glow' : 'FRONT SHIELD · flank it or wait for recovery'
        : enemy.role === 'rusher' ? 'RUSHER · sidestep the lunge · Q dash' : 'FLANKER · use cover to break its firing lane'
      : this.mode === 'pilot' ? 'PILOT · sprint / double jump / Q dash · H recover' : 'MECH · use cover for shields · Q staggers and vents 40 heat';
    if (snapshot.phase === 'battle') waypoint = `SQUAD ${snapshot.wave} / ${ENCOUNTER.battleGroups} · ${waypoint}`;
    return { phase: snapshot.phase, elapsed: snapshot.elapsed, waypoint, tactic };
  }

  private updateHUD(): void {
    const stats = this.stats;
    const zone = getZone(this.camera.position.x, this.camera.position.z);
    const weapon = this.progression.inventory.find(item => item.id === this.progression.loadouts[this.mode].weapon);
    const focusedLoot = this.aimedDrop();
    const station = this.focusedStation();
    // These adjacent reads have no intervening scene/mode/input mutation.
    // Reuse this HUD call's result only; interactions still perform fresh queries.
    const vendor = this.feedbackQuality === 'crowd' ? this.vendingForStation(station) : this.nearbyVending();
    const cash = this.nearestCash();
    const health = this.nearestHealth();
    let interaction = '';
    if (focusedLoot) interaction = '';
    else if (station?.kind === 'workbench') interaction = '[E] Weapon workbench · build / preview / test';
    else if (station?.kind === 'service') interaction = '[E] Service terminal · repair and equipment caches';
    else if (vendor) interaction = `[E] ${vendor.id === 'weapons' ? 'Weapons & Ammo' : vendor.id === 'medical' ? 'Health & Shields' : 'Mech Parts'} · browse / sell junk`;
    else if (health && this.body.health < stats.maxHealth) interaction = `[E] Health pickup · restore 25% ${this.mode === 'mech' ? 'hull' : 'health'}`;
    else if (cash) interaction = `[E] Collect ${cash.amount} CR · walk close to collect automatically`;
    else if (this.mode === 'pilot' && this.world.parkedMech.position.distanceTo(new THREE.Vector3(this.camera.position.x, 0, this.camera.position.z)) < 11 && zone.allowed === 'both') interaction = '[F] Mount mech';
    else if (health) interaction = 'Health full · pickup saved for when you need it';
    const nearbyRelay = ENCOUNTER.relays.find(r => this.encounter.snapshot.activeRelayIds.includes(r.id)
      && Math.hypot(r.x - this.camera.position.x, r.z - this.camera.position.z) <= r.radius);
    if (nearbyRelay && !focusedLoot) interaction = `[E] Disable ${nearbyRelay.name}`;
    if (this.ledgeClimb) interaction = 'CLIMBING';
    else if (this.screen === 'none' && this.nearbyLedge()) interaction = '[SPACE] Climb ledge';
    const usingGamepad = this.activeInput === 'gamepad' && this.gamepad.connected;
    if (usingGamepad) interaction = interaction.replace('[E]', '[Y]').replace('[F]', '[LB]').replace('[SPACE]', '[A]');
    const data: HUDData = {
      mode: this.mode, soundEnabled: this.soundEnabled, presentationMode: this.presentationMode, health: Math.max(0, this.body.health), maxHealth: stats.maxHealth,
      shield: this.body.shield, maxShield: stats.maxShield, ammo: this.body.ammo, magazine: stats.magazine, ammoReserve: this.body.reserve,
      heat: this.body.heat, heatCapacity: stats.heatCapacity, zoneName: zone.name, zoneRestriction: zone.allowed,
      wave: this.progression.wave, enemies: this.enemies.length, kills: this.progression.kills,
      credits: this.progression.credits, weaponName: weapon?.name ?? 'Field weapon', interaction,
      weaponBrand: weapon?.brand, weaponSpec: getWeaponSpec(weapon),
      reloading: this.reloadUntil > 0, overheated: this.body.overheated, fps: this.fps,
      objective: this.encounter.snapshot.phase !== 'idle' ? this.encounter.snapshot.objective : this.workbenchTesting ? usingGamepad ? 'Fixed test dummy · pause: workbench / live encounter' : 'Fixed test dummy · K: edit build · N: live encounter'
        : this.trainingTargets ? usingGamepad ? 'Test build · pause: workbench / live encounter' : 'Test build · K: workbench · N: fresh targets'
        : this.enemies.length ? 'Clear targets · salvage their equipment' : usingGamepad ? 'D-pad ↑: 3–5 minute encounter · Back: loadout' : 'N: 3–5 minute encounter · I: loadout · K: workbench',
      encounter: this.encounterHUD(),
      inputDevice: usingGamepad ? `GAMEPAD · ${this.gamepad.label}` : 'MOUSE + KEYBOARD',
      mouseCaptured: this.mouse.locked,
      mouseCaptureBlocked: this.mouseCaptureBlocked,
      reloadProgress: this.reloadUntil > 0 ? THREE.MathUtils.clamp((this.time - this.reloadStartedAt) / this.stats.reload, 0, 1) : 0,
      ammoEmpty: this.body.ammo === 0,
      healCooldownRemaining: getHealCooldownRemaining(this.time, this.healReadyAt),
      healCooldownDuration: HEAL_COOLDOWN,
      healEnabled: this.screen === 'none' && !this.ledgeClimb,
      healingActive: this.time < this.healingUntil,
      healingAmount: this.lastHealingAmount,
      healingInProgress: this.recoveryAction.active,
      healingProgress: this.recoveryAction.progress(this.time),
      checkpointName: getCheckpoint(normalizeCheckpoint(this.progression.checkpoint).id)!.name,
      checkpointSaved: this.checkpointPersisted,
      respawning: this.isRespawning,
    };
    this.ui.update(data);
    this.ui.setShop(getSupplyPrices(this.progression.wave), this.shopAvailable());
    this.ui.setLootComparison(this.screen === 'none' && !this.isRespawning ? focusedLoot?.item ?? null : null, this.progression, usingGamepad);
    const statusTarget = this.screen === 'none' && !this.isRespawning ? this.targetedEnemy() : undefined;
    this.ui.setTestDummy(statusTarget === this.testDummy ? this.dummyMeter.snapshot(this.time) : null);
    const statusModifiers = statusTarget ? getStatusModifiers(statusTarget.statuses, this.time) : null;
    this.ui.setTargetStatuses(statusTarget ? activeStatusElements(statusTarget.statuses, this.time).map(element => ({
      element, dps: getStatusDps(element, statusTarget.statuses[element]!.power) * statusModifiers!.incomingDamage
        * (statusTarget.shield > 0 ? statusModifiers!.shieldDamage : 1),
      remaining: Math.max(0, statusTarget.statuses[element]!.expiresAt - this.time),
    })) : []);
    if (this.screen === 'vending') this.updateVending();
  }

  private applyWeaponPose(): void {
    if (!this.pilotRig || !this.mechRig) return;
    const moving = this.screen === 'none' && !this.isRespawning && !this.ledgeClimb && ([...this.keys].some(key => ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(key))
      || Math.abs(this.gamepad.moveX) + Math.abs(this.gamepad.moveY) > 0);
    this.weaponPose.apply({ mode: this.mode, time: this.time, moving,
      reloadProgress: this.reloadUntil > 0 ? (this.time - this.reloadStartedAt) / this.stats.reload : 0,
      reloading: this.reloadUntil > 0, recoveryProgress: this.recoveryAction.progress(this.time), recoveryActive: this.recoveryAction.active,
      pilotAmmo: this.bodies.pilot.ammo, mechAmmo: this.bodies.mech.ammo, emptyAge: this.time - this.emptyAt,
    }, this.weapon, this.pilotRig, this.mechRig);
    if (this.ledgeClimb) {
      const progress = this.climbProgress;
      const lower = THREE.MathUtils.smoothstep(progress, 0, .14) * (1 - THREE.MathUtils.smoothstep(progress, .88, 1));
      this.weapon.position.y -= lower * 1.05;
      this.weapon.rotation.x -= lower * .4;
      this.weapon.rotation.z += lower * .08;
    }
  }

  private makeWeapons(): void {
    this.muzzle.userData.comicOverlay = true;
    this.weapon.add(this.pilotGun, this.mechGuns, this.muzzle);
    this.camera.add(this.weapon);
    this.refreshEquipmentVisuals();
  }

  private refreshEquipmentVisuals(): void {
    const pilot = resolveEquipmentAppearance(this.progression, 'pilot');
    const mech = resolveEquipmentAppearance(this.progression, 'mech');
    let changed = false;
    for (const mode of ['pilot', 'mech'] as const) {
      const look = mode === 'pilot' ? pilot : mech;
      const key = Object.values(look).map(part => part.key).join('|');
      if (this.visualKeys[mode] === key) continue;
      this.visualKeys[mode] = key; changed = true;
      const previousRig = mode === 'pilot' ? this.pilotRig : this.mechRig;
      if (previousRig) { this.presentation?.release(previousRig.group); disposeEquipmentModel(previousRig.group); }
      const rig = createEquipmentWeapon(mode, look.weapon, look);
      // Give the long/heavy variants room in the same first-person frustum;
      // receiver backs must not fill the camera or conceal their barrel shape.
      if (mode === 'pilot') { rig.group.position.z -= 0.30; rig.group.scale.setScalar(0.75); }
      else rig.group.position.z -= 0.40;
      (mode === 'pilot' ? this.pilotGun : this.mechGuns).add(rig.group);
      if (mode === 'pilot') this.pilotRig = rig;
      else {
        this.mechRig = rig;
        this.presentation?.release(this.world.parkedMech);
        const oldParts = new THREE.Group(); oldParts.add(...this.world.parkedMech.children);
        disposeEquipmentModel(oldParts);
        const body = createEquipmentCharacter('mech', look);
        this.world.parkedMech.add(...body.children);
        this.world.parkedMech.userData.appearanceKey = key;
      }
    }
    if (changed) {
      if (this.healingVisual) disposeEquipmentModel(this.healingVisual.group);
      this.healingVisual = createHealingVisual(pilot, mech);
      this.camera.add(this.healingVisual.group);
    }
    this.syncPresentationEquipment(); this.applyWeaponPose(); this.scene.updateMatrixWorld(true);
  }

  private tracer(start: THREE.Vector3, end: THREE.Vector3, color: number): void {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([start, end]), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    this.scene.add(line); this.effects.push({ object: line, life: 0.08, maxLife: 0.08 });
  }

  private burst(position: THREE.Vector3, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color }));
      mesh.userData.comicOverlay = true;
      mesh.position.copy(position);
      mesh.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 6, (Math.random() - 0.5) * 8);
      this.scene.add(mesh); this.effects.push({ object: mesh, life: 0.4 + Math.random() * 0.35, maxLife: 0.75 });
    }
  }

  private updateEffects(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i]!;
      effect.life -= dt;
      const velocity = effect.object.userData.velocity as THREE.Vector3 | undefined;
      if (velocity) { effect.object.position.addScaledVector(velocity, dt); velocity.y -= dt * 12; }
      if (effect.life <= 0) { this.disposeObject(effect.object); this.effects.splice(i, 1); }
    }
  }

  private disposeObject(object: THREE.Object3D): void {
    disposeEquipmentEffects(object);
    object.removeFromParent();
    const materials = new Set<THREE.Material>();
    object.traverse(child => {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    });
    materials.forEach(material => material.dispose());
  }

  private tone(frequency: number, duration: number): void {
    if (!this.soundEnabled || this.presentation?.enabled) return;
    try {
      this.audioContext ??= new AudioContext();
      const ctx = this.audioContext;
      if (ctx.state === 'suspended') void ctx.resume();
      const oscillator = ctx.createOscillator(), gain = ctx.createGain();
      oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(25, frequency / 3), ctx.currentTime + duration);
      gain.gain.setValueAtTime(0.035, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + duration);
    } catch { this.soundEnabled = false; }
  }
}
