import './ui/itemCard.css';
import './ui/trading.css';
import { INVENTORY_CAPACITY, canSellItem, getJunkSaleSummary, isItemEquipped, rarityColors, type Item, type Mode, type Progression, type Slot, type Stats } from './core/index';
import { getDamageColor, type DamageEffect } from './core/feedback';
import { LoadoutPreview } from './rendering/LoadoutPreview';
import { sortInventoryItems } from './core/inventoryOrder';
import { brands, elementColors, elementLabels, getWeaponSpec, isElementType, projectileLabels, type BrandId, type ElementType, type WeaponSpec } from './core/arsenal';
import { buildItemCard, type CardDelta, type CardMetric, type CardStatus } from './core/itemCard';
import { createItemIcon, type ItemIconName } from './ui/itemIcons';
import type { VendingOffer, VendingServicePrices, VendingType } from './core/vending';
import { WeaponWorkbench } from './ui/weaponWorkbench';
import { TestDummyReadout } from './ui/testDummyReadout';
import type { TestDummySnapshot } from './core/testDummy';
import './ui/encounter.css';
import type { EncounterPhase } from './encounter/contracts';
import { DEFAULT_WEAPON_BALANCE, type WeaponBalanceRules } from './core/weaponBalance';

export type SupplyKind = 'repair' | 'pilot-cache' | 'mech-cache';
export interface ShopOffers { repair: number; pilotCache: number; mechCache: number }
export type VendingServiceKind = 'pilot-ammo' | 'mech-ammo' | 'medical' | 'mech-repair';
export interface VendingViewData {
  type: VendingType;
  name: string;
  offers: VendingOffer[];
  servicePrices: VendingServicePrices;
  canBuy: boolean;
  serviceEnabled?: { pilotAmmo: boolean; mechAmmo: boolean; medical: boolean; mechRepair: boolean };
}
/** Current effects on the aimed enemy. DPS is supplied by the combat simulation. */
export interface TargetStatusView { element: ElementType; dps: number; remaining: number }
type ItemCardContext = { kind: 'inventory' } | { kind: 'vending'; offer: VendingOffer } | { kind: 'loot'; usingGamepad: boolean };

export interface UIActions {
  start: () => void;
  resume: () => void;
  reset: () => void;
  equip: (id: string) => void;
  sell: (id: string) => void;
  closeMenu: () => void;
  spawnWave: () => void;
  switchMode: () => void;
  toggleSound: () => void;
  togglePresentation?: () => void;
  captureMouse?: () => void;
  buySupply?: (kind: SupplyKind) => void;
  heal?: () => void;
  markItem?: (id: string, mark: 'favorite' | 'junk' | null) => void;
  sellJunk?: () => void;
  buyVendingItem?: (offerId: string) => void;
  buyVendingService?: (kind: VendingServiceKind) => void;
  takeLoot?: (action: 'take' | 'equip' | 'junk') => void;
  openWorkbench?: () => void;
  testWorkbench?: (item: Item, code: string) => void;
  workbenchTargets?: () => void;
}

export interface HUDData {
  soundEnabled?: boolean;
  presentationMode?: 'quality' | 'legacy';
  mode: Mode;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  ammo: number;
  magazine: number;
  ammoReserve?: number;
  heat: number;
  heatCapacity: number;
  zoneName: string;
  zoneRestriction: 'both' | Mode;
  wave: number;
  enemies: number;
  kills: number;
  credits: number;
  weaponName: string;
  weaponBrand?: BrandId;
  weaponSpec?: WeaponSpec;
  interaction: string;
  reloading: boolean;
  overheated: boolean;
  fps: number;
  objective: string;
  encounter?: { phase: EncounterPhase; elapsed: number; waypoint: string; tactic: string };
  inputDevice?: string;
  mouseCaptured?: boolean;
  mouseCaptureBlocked?: boolean;
  reloadProgress?: number;
  ammoEmpty?: boolean;
  healCooldownRemaining?: number;
  healCooldownDuration?: number;
  healingActive?: boolean;
  healingAmount?: number;
  healEnabled?: boolean;
  healingInProgress?: boolean;
  healingProgress?: number;
  checkpointName?: string;
  checkpointSaved?: boolean;
  checkpointSaving?: boolean;
  respawning?: boolean;
}

export type Screen = 'start' | 'pause' | 'inventory' | 'vending' | 'workbench' | 'none';
const slotNames: Record<Slot, string> = { weapon: 'Primary weapon', shield: 'Shield system', reactor: 'Reactor', legs: 'Locomotion' };
const statNames: Record<keyof Stats, string> = {
  damage: 'Damage', fireRate: 'Fire rate', magazine: 'Magazine', reload: 'Reload', maxHealth: 'Hull / health',
  maxShield: 'Shield capacity', moveSpeed: 'Movement speed', heatCapacity: 'Heat capacity', cooling: 'Cooling rate',
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(label: string, action: () => void, className = ''): HTMLButtonElement {
  const node = el('button', className, label);
  node.type = 'button';
  node.addEventListener('click', (event) => { event.stopPropagation(); action(); });
  return node;
}

function keycap(key: string): HTMLElement { return el('kbd', '', key); }
function fmt(value: number): string { return Number.isInteger(value) ? String(value) : value.toFixed(value >= 10 ? 1 : 2).replace(/\.?0+$/, ''); }
function ratio(value: number, maximum: number): string { return `${Math.min(100, Math.max(0, maximum > 0 ? value / maximum * 100 : 0))}%`; }
const damageEffectIcons: Record<DamageEffect, ItemIconName> = {
  fire: 'fire', shock: 'shock', corrosion: 'corrosive', corrosive: 'corrosive', frost: 'ice', ice: 'ice',
  bleed: 'bleed', radiation: 'radiation', gravity: 'gravity', adhesive: 'adhesive',
};

const metricIcons: Record<CardMetric['key'], ItemIconName> = {
  damage: 'damage', spread: 'spread', reload: 'reload', fireRate: 'fireRate', magazine: 'magazine',
  maxHealth: 'health', maxShield: 'shield', moveSpeed: 'moveSpeed', heatCapacity: 'heatCapacity', cooling: 'cooling',
  burstDps: 'dps', sustainedDps: 'dps',
};

function compactCardNumber(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}M`;
  if (magnitude >= 1_000) return `${Number((value / 1_000).toFixed(1))}k`;
  if (magnitude > 0 && magnitude < 0.01) return Number(value.toPrecision(2)).toString();
  return Number(value.toFixed(magnitude >= 10 ? 1 : 2)).toString();
}

function compactMetricDisplay(metric: CardMetric): string {
  const pellets = metric.key === 'damage' ? /^([0-9.]+)×([0-9]+)$/.exec(metric.display) : null;
  if (pellets) return `${compactCardNumber(Number(pellets[1]))}×${pellets[2]}`;
  return `${metric.display.startsWith('+') ? '+' : ''}${compactCardNumber(metric.value)}${metric.unit}`;
}

function cardDelta(delta: CardDelta | null, label: string): HTMLElement {
  const node = el('span', 'card-delta');
  if (!delta || delta.direction === 'equal') {
    node.classList.add('delta-empty');
    if (delta) node.setAttribute('aria-label', `${label}: unchanged`);
    return node;
  }
  node.classList.add(delta.better === true ? 'delta-better' : delta.better === false ? 'delta-worse' : 'delta-neutral');
  const meaning = `${label}: ${delta.display}, numeric ${delta.direction === 'up' ? 'increase' : 'decrease'}${delta.better === true ? ', improvement' : delta.better === false ? ', worse' : ''}`;
  node.setAttribute('aria-label', meaning);
  node.title = meaning;
  const unit = delta.display.replace(/^[+−-]?[0-9.]+/, '').trim();
  const display = `${delta.amount > 0 ? '+' : '−'}${compactCardNumber(Math.abs(delta.amount))}${unit}`;
  const arrow = delta.better === true ? 'up' : delta.better === false ? 'down' : delta.direction;
  const arrowLabel = delta.better === true ? 'Improvement' : delta.better === false ? 'Worse' : arrow === 'up' ? 'Increased' : 'Decreased';
  node.append(createItemIcon(arrow, arrowLabel), el('span', '', display));
  return node;
}

function cardMetric(metric: CardMetric): HTMLElement {
  const cell = el('div', 'card-metric');
  cell.dataset.metric = metric.key;
  cell.title = `${metric.label}: ${metric.display}${metric.description ? `\n${metric.description}` : ''}`;
  cell.append(createItemIcon(metricIcons[metric.key], metric.label), el('span', 'card-metric-label', metric.label.toUpperCase()),
    el('strong', 'card-metric-value', compactMetricDisplay(metric)), cardDelta(metric.delta, metric.label));
  return cell;
}

function controllerHelp(className = ''): HTMLElement {
  const help = el('div', `controller-help ${className}`);
  help.append(el('span', 'eyebrow', 'CONTROLLER'), el('p', '', 'Left stick move · Right stick aim · RT fire · LT aim · A jump / climb ledge · B heal / menu back · X reload · Y interact · LB mech · RB ability · Back loadout · Start pause · D-pad ↑ next encounter'));
  return help;
}

export class GameUI {
  private root: HTMLDivElement;
  private overlay: HTMLDivElement;
  private toasts: HTMLDivElement;
  private damageLayer: HTMLDivElement;
  private numbers: HTMLDivElement;
  private fields: Record<string, HTMLElement> = {};
  private healthBar: HTMLDivElement;
  private shieldBar: HTMLDivElement;
  private heatBar: HTMLDivElement;
  private screen: Screen = 'start';
  private state: Progression | null = null;
  private mode: Mode = 'pilot';
  private inventoryTab: Mode = 'pilot';
  private inventorySlot: Slot | null = null;
  private inventoryListContext: string | null = null;
  private inventoryListScroll = 0;
  private selectedId: string | null = null;
  private sound = true;
  private presentationMode: 'quality' | 'legacy' = 'quality';
  private controllerActive = false;
  private hitTimeout: ReturnType<typeof setTimeout> | undefined;
  private damageTimeout: ReturnType<typeof setTimeout> | undefined;
  private shopOffers: ShopOffers | null = null;
  private shopAvailable = false;
  private wallet = 0;
  private shopButtons = new Map<SupplyKind, HTMLButtonElement>();
  private shopStatus: HTMLElement | null = null;
  private shopWallet: HTMLElement | null = null;
  private healCanUse = false;
  private checkpointName = 'Service Pad';
  private checkpointPersisted: boolean | undefined;
  private loadoutPreview: LoadoutPreview | null = null;
  private workbench: WeaponWorkbench | null = null;
  private readonly dummyReadout: TestDummyReadout;
  private vendingData: VendingViewData | null = null;
  private vendingKey = '';
  private selectedOfferId: string | null = null;
  private vendingScroll = 0;
  private vendingBuyButton: HTMLButtonElement | null = null;
  private vendingServiceButtons = new Map<VendingServiceKind, HTMLButtonElement>();
  private vendingJunkButton: HTMLButtonElement | null = null;
  private vendingWallet: HTMLElement | null = null;
  private vendingStatus: HTMLElement | null = null;
  private lootPanel: HTMLDivElement;
  private lootItem: Item | null = null;
  private lootState: Progression | null = null;
  private lootUsingGamepad = false;
  private lootKey = '';
  private respawning = false;
  private targetStatusNodes = new Map<ElementType, { chip: HTMLElement; value: HTMLElement; time: HTMLElement }>();

  constructor(host: HTMLElement, private actions: UIActions, private readonly weaponBalance: Readonly<WeaponBalanceRules> = DEFAULT_WEAPON_BALANCE) {
    this.root = el('div', 'game-interface');
    this.root.dataset.screen = 'start';
    this.root.dataset.mode = 'pilot';
    this.root.setAttribute('aria-label', 'Game interface');
    host.append(this.root);

    const top = el('div', 'hud-top');
    const location = el('div', 'location-block');
    location.append(el('span', 'eyebrow', 'FIELD TEST  /  01'));
    const zone = this.field('zone', 'h2', 'zone-name', 'PROVING GROUND');
    const restriction = this.field('restriction', 'span', 'zone-access', 'PILOT + MECH ACCESS');
    const checkpoint = el('div', 'checkpoint-status');
    checkpoint.append(el('span', 'checkpoint-mark', '◇'), el('span', 'checkpoint-prefix', 'RESPAWN /'),
      this.field('checkpointName', 'strong', 'checkpoint-name', this.checkpointName),
      this.field('checkpointSaved', 'span', 'checkpoint-save-state'));
    location.append(zone, restriction, checkpoint);
    const encounter = el('div', 'encounter-block');
    const encounterTitle = el('div', 'encounter-heading');
    encounterTitle.append(el('span', 'status-dot'), el('span', 'eyebrow', 'LIVE FIELD DATA'));
    const stats = el('div', 'encounter-stats');
    stats.append(this.stat('wave', 'WAVE', '00'), this.stat('enemies', 'HOSTILES', '00'), this.stat('kills', 'ELIMINATED', '00'));
    encounter.append(encounterTitle, stats);
    top.append(location, encounter);

    const objective = el('div', 'objective-block');
    objective.append(el('span', 'objective-diamond', '◇'), this.field('objective', 'span', '', 'Explore the proving ground.'));
    const encounterGuide = this.field('encounterGuide', 'div', 'encounter-guide');
    encounterGuide.hidden = true;
    encounterGuide.append(this.field('encounterProgress', 'strong'), this.field('encounterWaypoint', 'div'), this.field('encounterTactic', 'div'));
    objective.append(encounterGuide);

    const center = el('div', 'aim-center');
    const crosshair = this.field('crosshair', 'div', 'crosshair');
    crosshair.append(el('i'), el('i'), el('i'), el('i'), el('b'));
    center.append(crosshair, this.field('interaction', 'div', 'interaction-prompt'));
    const targetStatuses = this.field('targetStatuses', 'div', 'target-status-ribbon');
    targetStatuses.hidden = true;
    targetStatuses.setAttribute('aria-label', 'Active effects on aimed target');
    targetStatuses.append(el('span', 'target-status-caption', 'TARGET EFFECTS'), this.field('targetStatusList', 'div', 'target-status-list'));

    const bottom = el('div', 'hud-bottom');
    const vitals = el('div', 'vitals-block');
    const modeButton = button('', actions.switchMode, 'mode-switch');
    this.fields.modeButton = modeButton;
    modeButton.append(el('span', 'mode-symbol', '◈'), this.field('mode', 'span', 'mode-label', 'PILOT'), keycap('F'));
    const shield = el('div', 'vital-row shield-row');
    const shieldInfo = el('div', 'vital-info');
    shieldInfo.append(el('span', '', 'SHIELD'), this.field('shield', 'strong', '', '100 / 100'));
    const shieldTrack = el('div', 'vital-track');
    this.shieldBar = el('div', 'vital-fill');
    shieldTrack.append(this.shieldBar);
    shield.append(shieldInfo, shieldTrack);
    const health = el('div', 'vital-row health-row');
    const healthInfo = el('div', 'vital-info');
    healthInfo.append(this.field('healthLabel', 'span', '', 'HEALTH'), this.field('health', 'strong', '', '100 / 100'));
    const healthTrack = el('div', 'vital-track');
    this.healthBar = el('div', 'vital-fill');
    healthTrack.append(this.healthBar);
    health.append(healthInfo, healthTrack);
    const recovery = el('div', 'recovery-control');
    const healButton = button('', () => this.actions.heal?.(), 'heal-button');
    this.fields.healButton = healButton;
    healButton.disabled = true;
    const healingLabel = el('span', 'heal-button-label');
    healingLabel.append(this.field('healName', 'strong', '', 'MED INJECTOR'), this.field('healState', 'span', '', 'READY'));
    healButton.append(el('span', 'heal-cross', '+'), healingLabel, keycap('H'));
    const healProgress = this.field('healProgress', 'div', 'heal-progress');
    healProgress.setAttribute('role', 'progressbar');
    healProgress.setAttribute('aria-label', 'Recovery cooldown');
    healProgress.setAttribute('aria-valuemin', '0');
    healProgress.setAttribute('aria-valuemax', '100');
    healProgress.append(this.field('healFill', 'div', 'heal-progress-fill'));
    const healingAmount = this.field('healingAmount', 'div', 'healing-amount');
    healingAmount.setAttribute('role', 'status');
    healingAmount.setAttribute('aria-live', 'polite');
    recovery.append(healButton, healProgress, healingAmount);
    vitals.append(modeButton, shield, health, recovery);

    const ability = el('div', 'ability-block');
    const abilityRow = el('div', 'ability-label');
    abilityRow.append(keycap('Q'), this.field('ability', 'span', '', 'KINETIC DASH'));
    const heatLabel = el('div', 'heat-label');
    heatLabel.append(this.field('heatLabel', 'span', '', 'REACTOR TEMPERATURE'), this.field('heatValue', 'strong', '', '0%'));
    const heatTrack = el('div', 'heat-track');
    this.heatBar = el('div', 'heat-fill');
    heatTrack.append(this.heatBar);
    ability.append(abilityRow, heatLabel, heatTrack);

    const weapon = this.field('weaponPanel', 'div', 'weapon-block');
    weapon.append(this.field('weapon', 'div', 'weapon-name', 'FIELD RIFLE'));
    const weaponProfile = this.field('weaponProfile', 'div', 'weapon-profile-line');
    weaponProfile.hidden = true;
    weapon.append(weaponProfile);
    const ammoLine = el('div', 'ammo-line');
    ammoLine.append(this.field('ammo', 'strong', 'ammo-count', '30'), el('span', 'ammo-divider', '/'), this.field('magazine', 'span', 'ammo-total', '30'));
    const reloadTrack = this.field('reloadTrack', 'div', 'weapon-reload-track');
    reloadTrack.setAttribute('role', 'progressbar');
    reloadTrack.setAttribute('aria-label', 'Reload progress');
    reloadTrack.setAttribute('aria-valuemin', '0');
    reloadTrack.setAttribute('aria-valuemax', '100');
    reloadTrack.hidden = true;
    reloadTrack.append(this.field('reloadFill', 'div', 'weapon-reload-fill'));
    const emptyCue = this.field('emptyCue', 'div', 'empty-ammo-cue', 'EMPTY  /  R TO RELOAD');
    emptyCue.hidden = true;
    weapon.append(ammoLine, this.field('weaponStatus', 'div', 'weapon-status', 'R  RELOAD  ·  AUTO'), reloadTrack, emptyCue);
    const reserve = this.field('ammoReserve', 'div', 'ammo-reserve');
    reserve.hidden = true;
    weapon.append(reserve);
    bottom.append(vitals, ability, weapon);

    const footer = el('div', 'hud-footer');
    const guide = el('div', 'quick-controls');
    [['WASD', 'MOVE'], ['E', 'INTERACT'], ['I', 'LOADOUT'], ['ESC', 'PAUSE']].forEach(([key, label]) => {
      const group = el('span'); group.append(keycap(key), document.createTextNode(` ${label}`)); guide.append(group);
    });
    const telemetry = el('div', 'telemetry');
    const inputDevice = this.field('inputDevice', 'span', 'input-device', 'MOUSE + KEYBOARD');
    inputDevice.setAttribute('role', 'status');
    inputDevice.setAttribute('aria-live', 'polite');
    inputDevice.setAttribute('aria-atomic', 'true');
    telemetry.append(this.field('credits', 'span', 'credits', '0 CR'), inputDevice, this.field('fps', 'span', '', '60 FPS'));
    footer.append(guide, telemetry);

    const captureControl = this.field('captureControl', 'div', 'mouse-capture-control');
    const captureButton = button('CAPTURE MOUSE  ↗', () => this.actions.captureMouse?.(), 'mouse-capture-button');
    captureButton.disabled = !this.actions.captureMouse;
    captureButton.setAttribute('aria-label', 'Capture mouse for first-person aiming');
    captureControl.append(captureButton, this.field('captureMessage', 'span', 'mouse-capture-message', 'Click to enable first-person mouse aim.'));

    const respawnLayer = this.field('respawnLayer', 'div', 'respawn-overlay');
    respawnLayer.hidden = true;
    respawnLayer.setAttribute('role', 'status');
    respawnLayer.setAttribute('aria-live', 'polite');
    const respawnBanner = el('div', 'respawn-banner');
    respawnBanner.append(el('span', 'eyebrow', 'RECOVERY / CHECKPOINT'), this.field('respawnMessage', 'strong', '', `RECONSTRUCTING AT ${this.checkpointName}`));
    respawnLayer.append(respawnBanner);

    this.overlay = el('div', 'screen-overlay');
    this.lootPanel = el('div', 'world-loot-panel');
    this.lootPanel.hidden = true;
    this.lootPanel.setAttribute('aria-label', 'World loot comparison');
    this.toasts = el('div', 'toast-stack');
    this.toasts.setAttribute('role', 'status');
    this.toasts.setAttribute('aria-live', 'polite');
    this.damageLayer = el('div', 'damage-layer');
    const healingLayer = this.field('healingLayer', 'div', 'healing-layer');
    this.numbers = el('div', 'damage-numbers');
    this.root.append(top, objective, center, targetStatuses, bottom, footer, captureControl, respawnLayer, this.lootPanel, this.overlay, this.toasts, this.damageLayer, healingLayer, this.numbers);
    this.dummyReadout = new TestDummyReadout(this.root);
    window.addEventListener('pagehide', () => { this.loadoutPreview?.dispose(); this.workbench?.dispose(); this.dummyReadout.dispose(); });
  }

  setTestDummy(snapshot: TestDummySnapshot | null): void { this.dummyReadout.update(this.screen === 'none' ? snapshot : null); }

  private field<K extends keyof HTMLElementTagNameMap>(id: string, tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
    const node = el(tag, className, text); this.fields[id] = node; return node;
  }

  private stat(id: string, label: string, value: string): HTMLElement {
    const node = el('div', 'encounter-stat');
    node.append(this.field(id, 'strong', '', value), el('span', '', label));
    return node;
  }

  private set(id: string, value: string): void {
    const field = this.fields[id];
    if (field && field.textContent !== value) field.textContent = value;
  }

  update(data: HUDData): void {
    if (data.soundEnabled !== undefined) this.sound = data.soundEnabled;
    if (data.presentationMode) this.presentationMode = data.presentationMode;
    this.set('pauseSound', `SOUND  /  ${this.sound ? 'ON' : 'OFF'}`);
    this.set('pausePresentation', `VISUALS  /  ${this.presentationMode === 'quality' ? 'ENHANCED' : 'LEGACY'}`);
    this.mode = data.mode;
    if (data.checkpointName?.trim()) this.checkpointName = data.checkpointName.trim();
    if (data.checkpointSaved !== undefined) this.checkpointPersisted = data.checkpointSaved;
    this.updateCheckpointFields(!!data.checkpointSaving);
    this.root.classList.toggle('respawning', !!data.respawning);
    this.respawning = !!data.respawning;
    this.updateLootVisibility();
    this.updateTargetStatusVisibility();
    this.fields.respawnLayer.hidden = !data.respawning;
    this.set('respawnMessage', `RECONSTRUCTING AT ${this.checkpointName}`);
    const controller = data.inputDevice?.startsWith('GAMEPAD') ?? false;
    if (controller !== this.controllerActive) {
      this.controllerActive = controller;
      const modeKey = this.fields.modeButton.querySelector('kbd');
      if (modeKey) modeKey.textContent = controller ? 'LB' : 'F';
      const abilityKey = this.root.querySelector('.ability-label kbd');
      if (abilityKey) abilityKey.textContent = controller ? 'RB' : 'Q';
      const healKey = this.fields.healButton.querySelector('kbd');
      if (healKey) healKey.textContent = controller ? 'B' : 'H';
      const hints = controller ? ['LS', 'Y', 'BACK', 'START'] : ['WASD', 'E', 'I', 'ESC'];
      this.root.querySelectorAll('.quick-controls kbd').forEach((key, index) => { key.textContent = hints[index] ?? ''; });
    }
    this.root.dataset.mode = data.mode;
    this.set('zone', data.zoneName);
    this.set('restriction', data.zoneRestriction === 'both' ? 'PILOT + MECH ACCESS' : `${data.zoneRestriction.toUpperCase()} ACCESS ONLY`);
    this.fields.restriction.dataset.restriction = data.zoneRestriction;
    this.set('wave', String(data.wave).padStart(2, '0'));
    this.set('enemies', String(data.enemies).padStart(2, '0'));
    this.set('kills', String(data.kills).padStart(2, '0'));
    this.set('mode', data.mode === 'mech' ? 'MECH ONLINE' : 'PILOT');
    this.set('healthLabel', data.mode === 'mech' ? 'HULL' : 'HEALTH');
    this.set('health', `${Math.ceil(data.health)} / ${Math.round(data.maxHealth)}`);
    this.set('shield', `${Math.ceil(data.shield)} / ${Math.round(data.maxShield)}`);
    this.healthBar.style.width = ratio(data.health, data.maxHealth);
    this.shieldBar.style.width = ratio(data.shield, data.maxShield);
    const healCooldown = Number.isFinite(data.healCooldownRemaining) ? Math.max(0, data.healCooldownRemaining!) : 0;
    const healDuration = Number.isFinite(data.healCooldownDuration) && data.healCooldownDuration! > 0 ? data.healCooldownDuration! : 20;
    const fullHealth = data.maxHealth > 0 && data.health >= data.maxHealth - 0.001;
    const healingName = data.mode === 'mech' ? 'FIELD REPAIR' : 'MED INJECTOR';
    const healingInProgress = !!data.healingInProgress;
    this.root.classList.toggle('recovering', healingInProgress);
    const actionProgress = Number.isFinite(data.healingProgress) ? Math.min(1, Math.max(0, data.healingProgress!)) : 0;
    const healingState = healingInProgress ? data.mode === 'mech' ? 'REPAIRING' : 'INJECTING'
      : healCooldown > 0 ? `COOLDOWN ${Math.ceil(healCooldown)}s` : fullHealth ? 'FULL HEALTH' : 'READY';
    const healProgress = healingInProgress ? actionProgress * 100 : Math.min(100, Math.max(0, (1 - healCooldown / healDuration) * 100));
    this.set('healName', healingName);
    this.set('healState', healingState);
    this.fields.healFill.style.width = `${healProgress}%`;
    this.fields.healProgress.setAttribute('aria-valuenow', String(Math.round(healProgress)));
    this.fields.healProgress.setAttribute('aria-valuetext', healingState);
    this.fields.healProgress.setAttribute('aria-label', healingInProgress ? 'Recovery action progress' : 'Recovery cooldown');
    this.fields.healButton.classList.toggle('recovery-in-progress', healingInProgress);
    this.healCanUse = (data.healEnabled ?? true) && !healingInProgress && healCooldown === 0 && !fullHealth && !!this.actions.heal;
    (this.fields.healButton as HTMLButtonElement).disabled = this.screen !== 'none' || !this.healCanUse;
    this.fields.healButton.classList.toggle('recovery-ready', healCooldown === 0 && !fullHealth);
    this.fields.healButton.setAttribute('aria-label', `${healingName}. ${healingState}. ${controller ? 'B' : 'H'} to recover health.`);
    const healingActive = !!data.healingActive;
    this.fields.healingLayer.classList.toggle('active', healingActive);
    this.fields.healingAmount.classList.toggle('active', healingActive);
    this.set('healingAmount', healingActive
      ? Number.isFinite(data.healingAmount) && data.healingAmount! > 0 ? `+${Math.round(data.healingAmount!)} ${data.mode === 'mech' ? 'HULL' : 'HP'}` : 'RECOVERY APPLIED'
      : '');
    this.set('ability', data.mode === 'mech' ? 'SHOCKWAVE PULSE' : 'KINETIC DASH');
    this.set('heatLabel', data.mode === 'mech' ? 'REACTOR TEMPERATURE' : 'WEAPON TEMPERATURE');
    const heatPercent = Math.round(data.heatCapacity > 0 ? data.heat / data.heatCapacity * 100 : 0);
    this.set('heatValue', `${heatPercent}%`);
    this.heatBar.style.width = ratio(data.heat, data.heatCapacity);
    this.heatBar.classList.toggle('danger', data.overheated || heatPercent > 80);
    this.set('weapon', data.weaponName);
    const weaponProfile = [data.weaponBrand ? brands[data.weaponBrand].name : '',
      data.weaponSpec ? projectileLabels[data.weaponSpec.projectile] : '',
      data.weaponSpec ? [data.weaponSpec.element, data.weaponSpec.secondaryElement].filter((element): element is ElementType => !!element)
        .map(element => elementLabels[element]).join(' + ') : ''].filter(Boolean).join(' / ');
    this.set('weaponProfile', weaponProfile);
    this.fields.weaponProfile.hidden = !weaponProfile;
    this.fields.weaponProfile.style.color = data.weaponSpec ? elementColors[data.weaponSpec.element] : '#bbd0b1';
    this.set('ammo', data.reloading ? '··' : String(Math.max(0, data.ammo)));
    this.set('magazine', String(data.magazine));
    this.fields.ammoReserve.hidden = data.ammoReserve === undefined;
    if (data.ammoReserve !== undefined) this.set('ammoReserve', `${Math.max(0, Math.floor(data.ammoReserve))}  RESERVE`);
    const ammoEmpty = data.ammoEmpty ?? data.ammo <= 0;
    const reloadProgress = Number.isFinite(data.reloadProgress) ? Math.min(1, Math.max(0, data.reloadProgress!)) : 0;
    this.set('weaponStatus', data.overheated ? 'OVERHEATED  /  COOLING' : data.reloading ? `RELOADING  ${Math.round(reloadProgress * 100)}%` : ammoEmpty ? `${controller ? 'X' : 'R'}  RELOAD  /  MAGAZINE EMPTY` : `${controller ? 'X' : 'R'}  RELOAD  ·  ${data.mode === 'mech' ? 'CANNON' : 'AUTO'}`);
    this.fields.weaponStatus.classList.toggle('danger-text', data.overheated);
    this.fields.weaponPanel.classList.toggle('is-reloading', data.reloading);
    this.fields.weaponPanel.classList.toggle('is-empty', ammoEmpty && !data.reloading);
    this.fields.reloadTrack.hidden = !data.reloading;
    this.fields.reloadTrack.setAttribute('aria-valuenow', String(Math.round(reloadProgress * 100)));
    this.fields.reloadFill.style.width = `${reloadProgress * 100}%`;
    this.set('emptyCue', `EMPTY  /  ${controller ? 'X' : 'R'} TO RELOAD`);
    this.fields.emptyCue.hidden = !ammoEmpty || data.reloading;
    this.set('interaction', data.interaction);
    this.fields.interaction.classList.toggle('visible', Boolean(data.interaction));
    this.set('credits', `${data.credits.toLocaleString()} CR`);
    this.wallet = data.credits;
    this.updateShop();
    if (this.screen === 'vending') this.updateVendingControls();
    this.set('fps', `${Math.round(data.fps)} FPS`);
    const inputDevice = controller ? data.inputDevice! : data.mouseCaptured ? 'MOUSE CAPTURED' : data.mouseCaptureBlocked ? 'CAPTURE BLOCKED · RIGHT-DRAG TO LOOK' : 'CLICK FIELD TO CAPTURE';
    if (this.fields.inputDevice.textContent !== inputDevice) {
      this.set('inputDevice', inputDevice);
      this.fields.inputDevice.title = inputDevice;
      this.fields.inputDevice.setAttribute('aria-label', `Active input: ${inputDevice}`);
    }
    this.fields.captureControl.hidden = controller || !!data.mouseCaptured;
    this.fields.captureControl.classList.toggle('capture-blocked', !!data.mouseCaptureBlocked);
    this.set('captureMessage', data.mouseCaptureBlocked
      ? 'Browser denied mouse capture. Right-drag to look; controller aiming still works.'
      : 'Click to capture mouse. Esc releases it.');
    this.set('objective', data.objective);
    this.fields.encounterGuide.hidden = !data.encounter;
    if (data.encounter) {
      const phases: EncounterPhase[] = ['infiltration', 'defenses', 'boarding', 'battle', 'boss', 'loot', 'complete'];
      const elapsed = Math.floor(data.encounter.elapsed);
      this.set('encounterProgress', `${Math.min(6, phases.indexOf(data.encounter.phase) + 1)} / 6 · ${data.encounter.phase.toUpperCase()} · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`);
      this.set('encounterWaypoint', data.encounter.waypoint);
      this.set('encounterTactic', data.encounter.tactic);
    }
  }

  setScreen(screen: Screen, state: Progression, mode: Mode): void {
    this.rememberInventoryScroll();
    const vendorList = this.overlay.querySelector<HTMLElement>('.vending-offer-list');
    if (vendorList && screen === 'vending') this.vendingScroll = vendorList.scrollTop;
    const changed = this.screen !== screen;
    this.screen = screen;
    if (screen !== 'none') this.dummyReadout.update(null);
    this.state = state;
    this.wallet = state.credits;
    this.mode = mode;
    this.root.dataset.screen = screen;
    this.updateLootVisibility();
    this.updateTargetStatusVisibility();
    if (screen !== 'inventory') this.loadoutPreview?.setVisible(false);
    if (screen !== 'workbench') this.workbench?.hide();
    (this.fields.healButton as HTMLButtonElement).disabled = screen !== 'none' || !this.healCanUse;
    this.overlay.replaceChildren();
    this.shopButtons.clear();
    this.shopStatus = null;
    this.shopWallet = null;
    this.overlay.setAttribute('aria-hidden', screen === 'none' ? 'true' : 'false');
    if (screen === 'start') this.renderStart();
    if (screen === 'workbench') {
      this.workbench ??= new WeaponWorkbench(this.overlay, {
        test: (item, code) => this.actions.testWorkbench?.(item, code),
        targets: () => this.actions.workbenchTargets?.(), close: this.actions.closeMenu,
        toast: message => this.toast(message),
      }, this.weaponBalance);
      this.workbench.show(state, mode);
    }
    if (screen === 'pause') this.renderPause();
    if (screen === 'vending') {
      if (changed) { this.selectedOfferId = null; this.vendingScroll = 0; }
      this.renderVending();
    }
    if (screen === 'inventory') {
      if (changed) {
        this.inventoryTab = mode; this.inventorySlot = null; this.selectedId = null;
        this.inventoryListContext = null; this.inventoryListScroll = 0;
      }
      this.renderInventory();
    }
    if (changed && screen !== 'none') {
      requestAnimationFrame(() => this.overlay.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }));
    }
  }

  private renderStart(): void {
    const panel = el('section', 'start-panel');
    const wordmark = el('div', 'wordmark');
    wordmark.append(el('span', 'wordmark-symbol', '◈'), el('span', '', 'DUST / STEEL'), el('span', 'build-number', '0.1'));
    panel.append(wordmark, el('div', 'eyebrow start-kicker', 'A PLAYABLE MECHANICS SANDBOX'));
    const title = el('h1', 'start-title');
    title.append(el('span', '', 'DUST'), el('span', 'title-slash', '//'), el('span', 'steel-title', 'STEEL'));
    const description = el('p', 'start-description', 'Two scales. One battlefield.');
    const detail = el('p', 'start-detail', 'N starts a 3–5 minute run: infiltrate on foot, disable two relays, board your mech, break the mini-boss, and salvage an upgrade. K opens the workbench; the dummy is always available.');
    const tags = el('div', 'feature-tags');
    tags.append(el('span', '', '01 / ON FOOT'), el('span', '', '02 / IN MECH'), el('span', '', '03 / RNG LOOT'));
    const launch = button('', this.actions.start, 'primary-button launch-button');
    launch.append(el('span', '', 'ENTER PROVING GROUND'), el('span', 'button-arrow', '↗'));
    panel.append(title, description, detail, tags, launch, el('p', 'launch-note', 'CLICK TO CAPTURE MOUSE · ESC TO RELEASE'),
      el('p', 'mouse-fallback-note', 'If your browser blocks capture, right-drag to look. Controller aiming works independently.'));
    const controls = el('div', 'start-controls');
    [['WASD / SHIFT', 'Move / sprint'], ['MOUSE', 'Mouse aim / left fire'], ['F', 'Enter / exit mech'], ['E', 'Pick up gear / health'], ['I', 'Loadout'], ['Q', 'Dash / pulse'], ['H', 'Heal / field repair'], ['SPACE', 'Jump / climb ledge']].forEach(([key, label]) => {
      const row = el('div'); row.append(keycap(key), el('span', '', label)); controls.append(row);
    });
    panel.append(controls, el('p', 'sandbox-note', 'MECHANICS FIRST. NO STORY REQUIRED.'));
    const caption = el('div', 'world-caption');
    caption.append(el('span', 'eyebrow', 'TEST ENVIRONMENT / 001'), el('strong', '', 'THE PROVING GROUND'), el('span', '', 'SERVICE VAULT  /  SHARED YARD  /  HEAVY RANGE'),
      this.field('startCheckpoint', 'span', 'start-checkpoint-note'));
    this.updateCheckpointFields();
    this.overlay.append(panel, caption, controllerHelp('start-controller-help'), el('div', 'mobile-note', 'Play with a keyboard and mouse or a connected controller.'));
  }

  private renderPause(): void {
    const panel = el('section', 'pause-panel');
    panel.append(el('span', 'eyebrow', 'DUST // STEEL  /  MECHANICS SANDBOX'), el('h1', 'menu-title', 'FIELD PAUSED'), this.field('pauseCheckpoint', 'p', 'menu-description'));
    this.updateCheckpointFields();
    const resume = button('RESUME FIELD TEST  ↗', this.actions.resume, 'primary-button');
    const encounter = button('START / REPLAY ENCOUNTER · 3–5 MIN', this.actions.spawnWave, 'secondary-button');
    const workbench = button('WEAPON WORKBENCH  /  K', () => this.actions.openWorkbench?.(), 'secondary-button');
    const mode = button(this.mode === 'pilot' ? 'ENTER MECH  /  F' : 'EXIT MECH  /  F', this.actions.switchMode, 'secondary-button');
    const sound = button(`SOUND  /  ${this.sound ? 'ON' : 'OFF'}`, this.actions.toggleSound, 'secondary-button');
    this.fields.pauseSound = sound;
    const presentation = button(`VISUALS  /  ${this.presentationMode === 'quality' ? 'ENHANCED' : 'LEGACY'}`,
      () => this.actions.togglePresentation?.(), 'secondary-button');
    presentation.dataset.presentationToggle = 'true'; presentation.disabled = !this.actions.togglePresentation;
    this.fields.pausePresentation = presentation;
    const reset = button('RESET SANDBOX PROGRESS', () => this.renderResetConfirmation(), 'text-button reset-button');
    panel.append(resume, workbench, encounter, mode, sound, presentation);
    this.renderShop(panel);
    const controls = el('div', 'pause-controls');
    [['WASD', 'Move'], ['SHIFT', 'Sprint'], ['SPACE', 'Jump / double jump / climb'], ['MOUSE', 'Mouse aim / left fire'], ['R', 'Reload'], ['E', 'Interact / loot / health'], ['F', 'Enter / exit mech'], ['I', 'Open loadout'], ['Q', 'Dash / pulse'], ['H', 'Heal / field repair'], ['ESC', 'Pause / release mouse']].forEach(([key, label]) => {
      const row = el('div'); row.append(keycap(key), el('span', '', label)); controls.append(row);
    });
    panel.append(controls, el('p', 'mouse-fallback-note', 'Mouse capture blocked? Right-drag to look. Controllers aim independently.'), controllerHelp('pause-controller-help'), reset);
    this.overlay.append(panel);
  }

  /** Prices and service-pad eligibility come from gameplay rules, not the UI. */
  setShop(offers: ShopOffers, available: boolean): void {
    const valid = [offers.repair, offers.pilotCache, offers.mechCache]
      .every(price => Number.isFinite(price) && price >= 0);
    this.shopOffers = valid ? {
      repair: Math.ceil(offers.repair), pilotCache: Math.ceil(offers.pilotCache), mechCache: Math.ceil(offers.mechCache),
    } : null;
    this.shopAvailable = valid && available;
    this.updateShop();
  }

  private renderShop(host: HTMLElement): void {
    this.shopButtons.clear();
    const shop = el('section', 'supply-shop');
    shop.setAttribute('aria-label', 'Field supplies');
    const heading = el('div', 'supply-heading');
    this.shopWallet = el('strong', 'supply-wallet');
    heading.append(el('span', 'eyebrow', 'FIELD SUPPLIES'), this.shopWallet);
    this.shopStatus = el('p', 'supply-status');
    shop.append(heading, this.shopStatus);
    const offers: SupplyKind[] = ['repair', 'pilot-cache', 'mech-cache'];
    for (const kind of offers) {
      const purchase = button('', () => {
        this.actions.buySupply?.(kind);
        if (this.state) this.wallet = this.state.credits;
        this.updateShop();
      }, 'supply-button');
      purchase.dataset.supplyKind = kind;
      this.shopButtons.set(kind, purchase);
      shop.append(purchase);
    }
    host.append(shop);
    this.updateShop();
  }

  private updateShop(): void {
    if (!this.shopButtons.size) return;
    if (this.shopWallet) this.shopWallet.textContent = `${this.wallet.toLocaleString()} CR`;
    if (this.shopStatus) this.shopStatus.textContent = !this.shopOffers || !this.actions.buySupply
      ? 'SUPPLY TERMINAL OFFLINE'
      : this.shopAvailable ? 'SERVICE PAD LINKED · PAY WITH FIELD CREDITS' : 'SERVICE PAD REQUIRED · CLEAR NEARBY HOSTILES';
    const choices: [SupplyKind, keyof ShopOffers, string][] = [
      ['repair', 'repair', 'REPAIR'], ['pilot-cache', 'pilotCache', 'PILOT GEAR CACHE'], ['mech-cache', 'mechCache', 'MECH GEAR CACHE'],
    ];
    for (const [kind, priceKey, label] of choices) {
      const purchase = this.shopButtons.get(kind);
      if (!purchase) continue;
      const price = this.shopOffers?.[priceKey];
      const enabled = price !== undefined && this.shopAvailable && !!this.actions.buySupply && this.wallet >= price;
      const text = `${label}  /  ${price === undefined ? '—' : price.toLocaleString()} CR`;
      if (purchase.textContent !== text) purchase.textContent = text;
      purchase.disabled = !enabled;
      purchase.title = !this.shopAvailable ? 'Move onto the service pad and clear nearby hostiles.'
        : price !== undefined && this.wallet < price ? `Need ${(price - this.wallet).toLocaleString()} more credits.` : '';
    }
  }

  private updateCheckpointFields(saving = false): void {
    this.set('checkpointName', this.checkpointName);
    this.fields.checkpointName.title = this.checkpointName;
    this.set('checkpointSaved', saving ? 'SAVING…' : this.checkpointPersisted === true ? 'SAVED' : this.checkpointPersisted === false ? 'SESSION ONLY' : '');
    this.fields.checkpointSaved.dataset.persisted = saving ? 'saving' : String(this.checkpointPersisted);
    this.set('startCheckpoint', `${this.checkpointPersisted === false ? 'SESSION RETURN' : 'CONTINUE FROM'} / ${this.checkpointName}`);
    this.set('pauseCheckpoint', this.checkpointPersisted === false
      ? `Respawn: ${this.checkpointName}. Session checkpoint active; browser storage is unavailable.`
      : this.checkpointPersisted === true ? `Respawn: ${this.checkpointName}. Progress saved; reload continues at this station.`
        : `Respawn: ${this.checkpointName}. Nearby checkpoint stations set your return point.`);
  }

  checkpointActivated(name: string, persisted: boolean): void {
    this.checkpointName = name.trim() || 'Service Pad';
    this.checkpointPersisted = persisted;
    this.updateCheckpointFields();
    this.toast(`CHECKPOINT ACTIVATED // ${this.checkpointName}\n${persisted ? 'PROGRESS SAVED' : 'SESSION CHECKPOINT / STORAGE UNAVAILABLE'}`,
      persisted ? '#a4d8b1' : '#edb880');
  }

  private renderResetConfirmation(): void {
    const panel = el('section', 'pause-panel');
    panel.append(el('span', 'eyebrow', 'SAVED PROGRESS'), el('h1', 'menu-title', 'RESET SANDBOX?'),
      el('p', 'menu-description', 'This removes saved equipment, credits, and encounter progress in this browser. This cannot be undone.'));
    const cancel = button('KEEP MY PROGRESS', () => {
      this.overlay.replaceChildren(); this.renderPause();
      this.overlay.querySelector<HTMLButtonElement>('button')?.focus();
    }, 'primary-button');
    panel.append(cancel, button('CONFIRM RESET', this.actions.reset, 'secondary-button'));
    this.overlay.replaceChildren(panel);
    cancel.focus();
  }

  private rememberInventoryScroll(): void {
    const list = this.overlay.querySelector<HTMLElement>('.item-list');
    if (list && this.inventoryListContext !== null) this.inventoryListScroll = list.scrollTop;
  }

  handleInventoryShortcut(code: string): boolean {
    if (this.screen !== 'inventory' || !['KeyX', 'KeyV', 'KeyJ'].includes(code)) return false;
    const item = this.state?.inventory.find(entry => entry.id === this.selectedId);
    if (!item) return true;
    if (code === 'KeyX') this.sellSelectedItem(item.id);
    else this.markSelectedItem(item.id, item.mark === (code === 'KeyV' ? 'favorite' : 'junk') ? null : code === 'KeyV' ? 'favorite' : 'junk');
    return true;
  }

  private sellSelectedItem(id: string): void {
    if (!this.state) return;
    const item = this.state.inventory.find(entry => entry.id === id);
    if (!item || !canSellItem(this.state, id)) {
      this.toast(item?.mark === 'favorite' ? 'Favorite protected. Press V to unmark it before selling.'
        : isItemEquipped(this.state, id) ? 'Equipped equipment cannot be sold.' : 'This item cannot be sold right now.');
      return;
    }
    this.actions.sell(id);
    if (this.screen === 'inventory') this.renderInventory();
  }

  private markSelectedItem(id: string, mark: 'favorite' | 'junk' | null): void {
    if (!this.state || !this.actions.markItem) return;
    if (mark === 'junk' && isItemEquipped(this.state, id)) {
      this.toast('Unequip this item before marking it as junk.'); return;
    }
    this.actions.markItem(id, mark);
    if (this.screen === 'inventory') this.renderInventory();
  }

  private renderItemMarks(item: Item, state: Progression): HTMLElement {
    const marks = el('span', 'card-item-marks');
    for (const [mark, key] of [['favorite', 'V'], ['junk', 'J']] as const) {
      const active = item.mark === mark;
      const control = button('', () => this.markSelectedItem(item.id, active ? null : mark), `item-mark-control mark-${mark}${active ? ' active' : ''}`);
      const label = `${active ? 'Unmark' : 'Mark'} ${mark} [${key}]`;
      control.title = mark === 'junk' && isItemEquipped(state, item.id) ? 'Equipped equipment cannot be marked as junk.' : label;
      control.setAttribute('aria-label', label);
      control.setAttribute('aria-pressed', String(active));
      control.disabled = !this.actions.markItem || mark === 'junk' && isItemEquipped(state, item.id);
      control.append(createItemIcon(mark, mark === 'favorite' ? 'Favorite' : 'Junk'), el('span', '', key));
      marks.append(control);
    }
    return marks;
  }

  setVending(data: VendingViewData): void {
    const key = `${data.type}:${data.name}:${data.offers.map(offer => `${offer.id}/${offer.price}`).join('|')}`;
    const changed = key !== this.vendingKey;
    this.vendingData = data;
    this.vendingKey = key;
    if (this.screen === 'vending') {
      if (changed || !this.overlay.querySelector('.vending-panel')) this.renderVending();
      else this.updateVendingControls();
    }
  }

  private makeJunkSaleButton(state: Progression): HTMLButtonElement {
    const summary = getJunkSaleSummary(state);
    const control = button(`SELL JUNK / ${summary.count} · ${summary.value.toLocaleString()} CR`, () => this.actions.sellJunk?.(), 'vendor-junk-button');
    control.disabled = !summary.canSell || !this.actions.sellJunk;
    control.title = 'Sell marked junk. Favorites and equipped items are protected.';
    return control;
  }

  private renderVending(): void {
    const state = this.state, data = this.vendingData;
    const oldList = this.overlay.querySelector<HTMLElement>('.vending-offer-list');
    if (oldList) this.vendingScroll = oldList.scrollTop;
    this.overlay.replaceChildren();
    this.vendingBuyButton = null;
    this.vendingServiceButtons.clear();
    this.vendingJunkButton = null;
    this.vendingWallet = null;
    this.vendingStatus = null;
    if (!state || !data) {
      const pending = el('section', 'pause-panel');
      pending.append(el('h1', 'menu-title', 'VENDING'), el('p', 'menu-description', 'Connecting to the terminal.'), button('CLOSE', this.actions.closeMenu, 'primary-button'));
      this.overlay.append(pending); return;
    }
    if (!data.offers.some(offer => offer.id === this.selectedOfferId)) this.selectedOfferId = data.offers[0]?.id ?? null;
    const panel = el('section', `vending-panel vending-${data.type}`);
    const header = el('header', 'vending-header');
    const title = el('div');
    title.append(el('span', 'eyebrow', data.type === 'weapons' ? 'WEAPONS + AMMUNITION' : data.type === 'medical' ? 'MEDICAL + SHIELDS' : 'MECH EQUIPMENT + REPAIR'), el('h1', '', data.name));
    const tools = el('div', 'vending-header-tools');
    this.vendingWallet = el('strong', 'vendor-wallet', `${state.credits.toLocaleString()} CR`);
    tools.append(this.vendingWallet, button('CLOSE ×', this.actions.closeMenu, 'close-button'));
    header.append(title, tools);
    const body = el('div', 'vending-body');
    const left = el('div', 'vending-stock');
    const stockHeading = el('div', 'vending-stock-heading');
    stockHeading.append(el('span', 'eyebrow', `${data.offers.length} EXACT ITEMS IN STOCK`), el('span', '', 'SELECT TO COMPARE'));
    const list = el('div', 'vending-offer-list');
    list.setAttribute('aria-label', 'Vending equipment stock');
    if (!data.offers.length) list.append(el('p', 'empty-state', 'Equipment stock is sold out. New stock arrives after the next encounter.'));
    for (const offer of data.offers) {
      const item = offer.item, brand = brands[item.brand];
      const row = button('', () => { this.selectedOfferId = offer.id; this.renderVending(); }, `vendor-offer${this.selectedOfferId === offer.id ? ' selected' : ''}`);
      row.dataset.offerId = offer.id;
      row.style.setProperty('--rarity', rarityColors[item.rarity]);
      row.setAttribute('aria-pressed', String(this.selectedOfferId === offer.id));
      row.setAttribute('aria-label', `${item.name}, ${brand.name}, ${item.target}, ${item.rarity}, level ${item.level}, price ${offer.price} credits`);
      const text = el('span', 'vendor-offer-copy');
      text.append(el('strong', '', item.name), el('span', '', `${brand.name.toUpperCase()} / ${item.target.toUpperCase()} / LV ${item.level}`));
      const price = el('strong', 'vendor-price', `${offer.price.toLocaleString()} CR`);
      if (state.credits < offer.price) price.classList.add('unaffordable');
      row.append(text, price);
      list.append(row);
    }
    left.append(stockHeading, list, this.renderVendingServices(data));
    const right = el('div', 'vending-comparison item-card-pane');
    const offer = data.offers.find(entry => entry.id === this.selectedOfferId);
    if (offer) this.renderItemDetail(right, offer.item, state, { kind: 'vending', offer });
    else right.append(el('p', 'empty-state', 'No item selected. Services remain available below the stock list.'));
    body.append(left, right);
    const footer = el('footer', 'vending-footer');
    this.vendingStatus = el('span');
    this.vendingJunkButton = this.makeJunkSaleButton(state);
    footer.append(this.vendingStatus, this.vendingJunkButton);
    panel.append(header, body, footer);
    this.overlay.append(panel);
    list.scrollTop = this.vendingScroll;
    this.vendingScroll = list.scrollTop;
    this.updateVendingControls();
  }

  private renderVendingServices(data: VendingViewData): HTMLElement {
    const services = el('section', 'vending-services');
    services.setAttribute('aria-label', 'Vending services');
    services.append(el('span', 'eyebrow', 'SERVICES'));
    const kinds: VendingServiceKind[] = data.type === 'weapons' ? ['pilot-ammo', 'mech-ammo'] : data.type === 'medical' ? ['medical'] : ['mech-repair'];
    for (const kind of kinds) {
      const purchase = button('', () => this.actions.buyVendingService?.(kind), 'vending-service-button');
      this.vendingServiceButtons.set(kind, purchase);
      services.append(purchase);
    }
    return services;
  }

  private updateVendingControls(): void {
    if (!this.vendingData || !this.state || this.screen !== 'vending') return;
    const data = this.vendingData, state = this.state;
    if (this.vendingWallet) this.vendingWallet.textContent = `${state.credits.toLocaleString()} CR`;
    if (this.vendingStatus) this.vendingStatus.textContent = data.canBuy ? 'EXACT STOCK / REFRESHES AFTER EACH ENCOUNTER' : 'MOVE CLOSER TO THE TERMINAL / CLEAR NEARBY HOSTILES';
    const prices = new Map(data.offers.map(offer => [offer.id, offer.price]));
    this.overlay.querySelectorAll<HTMLElement>('.vendor-offer').forEach(row => {
      const price = prices.get(row.dataset.offerId ?? '');
      row.querySelector('.vendor-price')?.classList.toggle('unaffordable', price !== undefined && state.credits < price);
    });
    const offer = data.offers.find(entry => entry.id === this.selectedOfferId);
    if (this.vendingBuyButton) {
      this.vendingBuyButton.disabled = !offer || !data.canBuy || !this.actions.buyVendingItem || state.credits < offer.price || state.inventory.length >= INVENTORY_CAPACITY;
      this.vendingBuyButton.title = state.inventory.length >= INVENTORY_CAPACITY ? 'Backpack full. Sell or remove equipment before buying.' : 'Buy this exact item into the backpack.';
    }
    if (this.vendingJunkButton) {
      const summary = getJunkSaleSummary(state);
      this.vendingJunkButton.textContent = `SELL JUNK / ${summary.count} · ${summary.value.toLocaleString()} CR`;
      this.vendingJunkButton.disabled = !data.canBuy || !summary.canSell || !this.actions.sellJunk;
    }
    const choices: [VendingServiceKind, keyof VendingServicePrices, string][] = [
      ['pilot-ammo', 'pilotAmmo', 'PILOT AMMO'], ['mech-ammo', 'mechAmmo', 'MECH AMMO'],
      ['medical', 'medical', 'PILOT MEDICAL / HEALTH + SHIELD'], ['mech-repair', 'mechRepair', 'MECH REPAIR / HULL + SHIELD'],
    ];
    for (const [kind, priceKey, label] of choices) {
      const control = this.vendingServiceButtons.get(kind);
      if (!control) continue;
      const price = data.servicePrices[priceKey];
      const needed = data.serviceEnabled?.[priceKey] ?? true;
      const text = `${label} / ${price.toLocaleString()} CR`;
      if (control.textContent !== text) control.textContent = text;
      control.disabled = !data.canBuy || !needed || state.credits < price || !this.actions.buyVendingService;
      control.title = !needed ? 'This loadout is already full or this service is unavailable.' : 'Purchase this service with field credits.';
    }
  }

  setLootComparison(item: Item | null, state: Progression, usingGamepad = false): void {
    this.lootItem = item;
    this.lootState = state;
    this.lootUsingGamepad = usingGamepad;
    this.updateLootVisibility();
    if (!item) { this.lootKey = ''; return; }
    const equippedId = state.loadouts[item.target][item.slot] ?? '';
    const key = `${item.id}:${equippedId}:${usingGamepad}:${state.inventory.length >= INVENTORY_CAPACITY}`;
    if (key === this.lootKey) return;
    this.lootKey = key;
    this.lootPanel.replaceChildren();
    this.lootPanel.append(el('div', 'world-loot-title', `${item.target.toUpperCase()} / ${slotNames[item.slot].toUpperCase()}`));
    const card = el('div', 'world-loot-card item-card-pane');
    this.renderItemDetail(card, item, state, { kind: 'loot', usingGamepad });
    this.lootPanel.append(card);
  }

  private updateLootVisibility(): void {
    this.lootPanel.hidden = !this.lootItem || this.screen !== 'none' || this.respawning;
  }

  setTargetStatuses(statuses: TargetStatusView[]): void {
    const active = new Set<ElementType>();
    for (const status of statuses) {
      if (!isElementType(status.element) || status.element === 'kinetic' || !Number.isFinite(status.remaining) || status.remaining <= 0) continue;
      active.add(status.element);
      let nodes = this.targetStatusNodes.get(status.element);
      if (!nodes) {
        const chip = el('span', 'target-status-chip');
        chip.style.setProperty('--element-color', elementColors[status.element]);
        const value = el('strong', 'target-status-value');
        const time = el('span', 'target-status-time');
        chip.append(createItemIcon(status.element, elementLabels[status.element]), value, time);
        this.fields.targetStatusList.append(chip);
        nodes = { chip, value, time };
        this.targetStatusNodes.set(status.element, nodes);
      }
      const dps = Number.isFinite(status.dps) ? Math.max(0, status.dps) : 0;
      const value = dps > 0 ? `${compactCardNumber(dps)} DMG/s` : elementLabels[status.element].toUpperCase();
      const time = `${Number(Math.max(0.1, status.remaining).toFixed(1))}s`;
      if (nodes.value.textContent !== value) nodes.value.textContent = value;
      if (nodes.time.textContent !== time) nodes.time.textContent = time;
      const description = `${elementLabels[status.element]}: ${dps > 0 ? `${fmt(dps)} damage per second, ` : ''}${time} remaining`;
      nodes.chip.title = description;
      nodes.chip.setAttribute('aria-label', description);
    }
    for (const [element, nodes] of this.targetStatusNodes) {
      if (active.has(element)) continue;
      nodes.chip.remove();
      this.targetStatusNodes.delete(element);
    }
    this.updateTargetStatusVisibility();
  }

  private updateTargetStatusVisibility(): void {
    this.fields.targetStatuses.hidden = this.targetStatusNodes.size === 0 || this.screen !== 'none' || this.respawning;
  }

  private renderInventory(): void {
    if (!this.state) return;
    this.rememberInventoryScroll();
    const listContext = `${this.inventoryTab}:${this.inventorySlot ?? 'all'}`;
    const scrollTop = this.inventoryListContext === listContext ? this.inventoryListScroll : 0;
    this.inventoryListContext = listContext;
    const state = this.state;
    const formItems = sortInventoryItems(state.inventory.filter(item => item.target === this.inventoryTab));
    const items = this.inventorySlot ? formItems.filter(item => item.slot === this.inventorySlot) : formItems;
    if (!items.some(item => item.id === this.selectedId)) {
      const equippedId = state.loadouts[this.inventoryTab][this.inventorySlot ?? 'weapon'];
      this.selectedId = items.find(item => item.id === equippedId)?.id ?? items[0]?.id ?? null;
    }
    this.overlay.replaceChildren();
    const panel = el('section', 'inventory-panel');
    const header = el('header', 'inventory-header');
    const titleBlock = el('div');
    titleBlock.append(el('span', 'eyebrow', 'FIELD EQUIPMENT  /  CONFIGURATION'), el('h1', 'menu-title', 'LOADOUT'));
    const right = el('div', 'inventory-header-right');
    right.append(el('span', 'inventory-credits', `${state.credits.toLocaleString()} CR`), button('CLOSE  ×', this.actions.closeMenu, 'close-button'));
    header.append(titleBlock, right);
    const tabs = el('div', 'loadout-tabs');
    tabs.setAttribute('role', 'tablist');
    (['pilot', 'mech'] as Mode[]).forEach(mode => {
      const tab = button(mode === 'pilot' ? '01 / PILOT' : '02 / MECH', () => {
        if (mode === this.inventoryTab) return;
        this.inventoryTab = mode; this.inventorySlot = null; this.selectedId = null; this.renderInventory();
      }, `loadout-tab${mode === this.inventoryTab ? ' active' : ''}`);
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(mode === this.inventoryTab));
      tabs.append(tab);
    });
    tabs.append(el('span', 'inventory-count', this.inventorySlot ? `${items.length} / ${formItems.length} ITEMS` : `${items.length} ITEMS IN STORAGE`));

    const body = el('div', 'inventory-body');
    const listPane = el('div', 'inventory-list-pane');
    const equipped = el('div', 'equipped-strip');
    const slots: Slot[] = ['weapon', 'shield', 'reactor', 'legs'];
    slots.forEach(slot => {
      const item = state.inventory.find(entry => entry.id === state.loadouts[this.inventoryTab][slot]);
      const active = this.inventorySlot === slot;
      const row = button('', () => {
        this.inventorySlot = slot;
        this.selectedId = item?.id ?? null;
        this.renderInventory();
      }, `equipped-slot${item ? ' has-equipment' : ''}${active ? ' filter-active' : ''}`);
      row.setAttribute('aria-pressed', String(active));
      row.setAttribute('aria-label', `Filter ${this.inventoryTab} ${slotNames[slot].toLowerCase()}. ${item ? `Equipped: ${item.name}` : 'Empty slot'}`);
      row.append(el('span', 'eyebrow', slotNames[slot]), el('strong', '', item?.name ?? 'Empty slot'));
      if (item) {
        row.style.setProperty('--rarity', rarityColors[item.rarity]);
        const brand = brands[item.brand];
        const brandLabel = el('span', 'slot-brand', brand.name);
        brandLabel.style.color = brand.color;
        row.append(brandLabel);
      }
      if (active) row.append(el('span', 'slot-filter-marker', 'FILTER'));
      equipped.append(row);
    });
    const storageHeader = el('div', 'storage-heading');
    const resetFilter = button('ALL ITEMS', () => {
      if (this.inventorySlot === null) return;
      this.inventorySlot = null;
      this.renderInventory();
    }, `inventory-reset-filter${this.inventorySlot === null ? ' active' : ''}`);
    resetFilter.setAttribute('aria-pressed', String(this.inventorySlot === null));
    storageHeader.append(el('span', 'eyebrow storage-filter-label', this.inventorySlot ? `STORAGE / ${slotNames[this.inventorySlot].toUpperCase()}` : 'STORAGE / ALL ITEMS'), resetFilter);
    const list = el('div', 'item-list');
    list.setAttribute('aria-label', `${this.inventoryTab} ${this.inventorySlot ? slotNames[this.inventorySlot].toLowerCase() : 'all'} equipment`);
    if (!items.length) list.append(el('div', 'empty-state', this.inventorySlot
      ? `No ${slotNames[this.inventorySlot].toLowerCase()} equipment for this ${this.inventoryTab} yet. Choose All items or collect matching gear.`
      : 'No equipment collected yet. Defeat hostiles and pick up their drops.'));
    for (const item of items) {
      const isEquipped = state.loadouts[item.target][item.slot] === item.id;
      const brand = brands[item.brand];
      const row = button('', () => { this.selectedId = item.id; this.renderInventory(); }, `item-row${isEquipped ? ' is-equipped' : ''}${item.mark ? ` is-${item.mark}` : ''}${this.selectedId === item.id ? ' selected' : ''}`);
      row.style.setProperty('--rarity', rarityColors[item.rarity]);
      row.setAttribute('aria-pressed', String(this.selectedId === item.id));
      row.setAttribute('aria-label', `${item.name}, ${brand.name}, ${item.rarity}, level ${item.level}, ${slotNames[item.slot]}${isEquipped ? ', equipped' : ''}${item.mark ? `, ${item.mark}` : ''}`);
      const symbol = el('span', 'item-symbol');
      const slotIcon: Record<Slot, ItemIconName> = { weapon: 'damage', shield: 'shield', reactor: 'module', legs: 'moveSpeed' };
      symbol.append(createItemIcon(slotIcon[item.slot], slotNames[item.slot]));
      const content = el('span', 'item-row-content');
      const brandLabel = el('span', 'item-brand', brand.name.toUpperCase());
      brandLabel.style.color = brand.color;
      content.append(el('strong', '', item.name), brandLabel, el('span', '', `${item.rarity.toUpperCase()}  /  ${slotNames[item.slot].toUpperCase()}  /  LV ${item.level}`));
      const inspect = el('span', 'item-chevron');
      if (item.mark) {
        inspect.classList.add('item-mark-badge', `mark-${item.mark}`);
        inspect.append(createItemIcon(item.mark, item.mark === 'favorite' ? 'Favorite, protected from sale' : 'Marked as junk'));
      } else inspect.append(createItemIcon('up', 'Select item for comparison'));
      row.append(symbol, content, inspect);
      list.append(row);
    }
    listPane.append(equipped, storageHeader, el('div', 'inventory-sort-hint', 'RARITY ↓  ·  LEVEL ↓'), list);
    const detailPane = el('div', 'item-detail-pane item-card-pane');
    const item = items.find(entry => entry.id === this.selectedId);
    const previewPane = el('div', 'inventory-preview-pane');
    const previewing = !!item && state.loadouts[item.target][item.slot] !== item.id;
    const previewHeading = el('div', 'preview-heading');
    previewHeading.append(el('span', 'eyebrow', `${this.inventoryTab.toUpperCase()} / FULL LOADOUT`),
      el('span', `preview-status${previewing ? ' item-preview' : ''}`, previewing ? 'ITEM PREVIEW' : 'EQUIPPED LOADOUT'));
    const previewHost = el('div', 'loadout-preview-host');
    previewPane.append(previewHeading, previewHost,
      el('p', 'preview-explanation', previewing ? 'Selected item replaces its matching slot here. Equip it to apply this look.' : 'Showing the currently equipped weapon, shield, reactor, and legs.'),
      el('span', 'preview-turntable-note', 'LIVE 3D MODEL / DRAG TO ROTATE'));
    if (item) this.renderItemDetail(detailPane, item, state);
    else detailPane.append(el('p', 'empty-state', this.inventorySlot
      ? `No matching ${slotNames[this.inventorySlot].toLowerCase()} item selected. Collect gear or choose All items.`
      : 'Select equipment to inspect its stats.'));
    body.append(listPane, previewPane, detailPane);
    const footer = el('footer', 'inventory-footer');
    const junk = getJunkSaleSummary(state);
    footer.append(el('span', '', `SELL / FAV / JUNK: KBD X/V/J · PAD X/RB/LB  /  ${junk.count} JUNK · ${junk.value} CR`), el('span', '', 'I / ESC  CLOSE LOADOUT'));
    panel.append(header, tabs, body, footer);
    this.overlay.append(panel);
    // Selection and equip/sell rebuild this pane. Restore only the same form /
    // slot context, after the new list is attached so its real bounds clamp it.
    list.scrollTop = scrollTop;
    this.inventoryListScroll = list.scrollTop;
    try {
      this.loadoutPreview ??= new LoadoutPreview();
      this.loadoutPreview.mount(previewHost);
      this.loadoutPreview.setLoadout(state, this.inventoryTab, previewing ? item : undefined);
      this.loadoutPreview.setVisible(this.screen === 'inventory');
    } catch {
      this.loadoutPreview?.setVisible(false);
      previewHost.replaceChildren(el('p', 'preview-error', '3D preview is unavailable in this browser. Equipment stats and controls remain available.'));
    }
  }

  private renderItemDetail(host: HTMLElement, item: Item, state: Progression, context: ItemCardContext = { kind: 'inventory' }): void {
    const equipped = state.inventory.find(entry => entry.id === state.loadouts[item.target][item.slot]);
    const isEquipped = equipped?.id === item.id;
    const brand = brands[item.brand];
    const model = buildItemCard(item, equipped, this.weaponBalance);
    const card = el('article', `compact-item-card${model.weapon ? ' weapon-card' : ' module-card'}`);
    card.style.setProperty('--rarity', rarityColors[item.rarity]);
    const heading = el('header', 'card-heading');
    const meta = el('div', 'card-meta');
    const brandName = el('span', 'card-brand-mini', brand.name.toUpperCase());
    brandName.style.color = brand.color;
    meta.append(el('span', 'card-rarity', item.rarity.toUpperCase()), brandName, el('span', '', `LV ${item.level}`));
    if (context.kind === 'inventory') meta.append(this.renderItemMarks(item, state));
    const title = el('h2', 'card-item-name', item.name);
    title.title = item.name;
    heading.append(meta, title);
    card.append(heading);

    if (model.weapon) {
      const metric = model.weapon.burstDps;
      const headline = el('div', 'card-dps');
      headline.title = `${metric.description}\nReload-aware direct DPS: ${model.weapon.sustainedDps.display}. ${model.weapon.sustainedDps.description}`;
      const value = el('div', 'card-dps-main');
      value.append(el('span', 'card-dps-label', 'DIRECT DPS'), el('strong', 'card-dps-value', compactMetricDisplay(metric)));
      headline.append(value, cardDelta(metric.delta, 'Direct DPS'));
      card.append(headline);
    } else {
      card.append(el('div', 'card-bonus-label', 'ROLLED EQUIPMENT BONUSES'));
    }

    const metrics = el('div', `card-metrics${model.weapon ? ' five-metrics' : ''}`);
    metrics.setAttribute('aria-label', model.weapon ? 'Weapon statistics and changes from equipped' : 'Equipment bonuses and changes from equipped');
    model.stats.forEach(metric => metrics.append(cardMetric(metric)));
    card.append(metrics);
    for (const status of model.statuses) card.append(this.renderCardStatus(status));

    if (model.secondary.length) {
      const secondary = el('div', 'card-secondary');
      secondary.setAttribute('aria-label', 'Projectile properties');
      for (const spec of model.secondary) {
        const chip = el('span', 'card-spec-chip');
        chip.title = `${spec.label}: ${spec.display}`;
        chip.setAttribute('aria-label', chip.title);
        chip.append(createItemIcon(spec.key, spec.label), el('span', '', spec.display));
        secondary.append(chip);
      }
      card.append(secondary);
    }

    const traits = [item.slot === 'weapon' ? projectileLabels[getWeaponSpec(item).projectile] : slotNames[item.slot], item.affix].filter(Boolean).join(' · ');
    const traitLine = el('p', 'card-traits', traits);
    traitLine.title = traits;
    card.append(traitLine);
    const actions = el('div', 'card-actions');
    if (context.kind === 'inventory') {
      const equip = button(isEquipped ? 'EQUIPPED  ✓' : 'EQUIP  ↗', () => {
        this.actions.equip(item.id); this.renderInventory();
      }, 'primary-button');
      equip.disabled = isEquipped;
      const sell = button(`X SELL / ${item.value} CR`, () => this.sellSelectedItem(item.id), 'secondary-button');
      sell.disabled = !canSellItem(state, item.id);
      if (item.mark === 'favorite') sell.title = 'Favorites are protected. Press V to unmark before selling.';
      actions.append(equip, sell);
    } else if (context.kind === 'vending') {
      const buy = button(`BUY / ${context.offer.price.toLocaleString()} CR`, () => this.actions.buyVendingItem?.(context.offer.id), 'primary-button');
      this.vendingBuyButton = buy;
      actions.append(buy);
    } else {
      actions.classList.add('loot-card-actions');
      const controls: ['take' | 'equip' | 'junk', string, string][] = [
        ['take', context.usingGamepad ? 'Y' : 'E', 'TAKE'], ['equip', context.usingGamepad ? 'X' : 'F', 'EQUIP'],
        ['junk', context.usingGamepad ? 'DPAD↓' : 'G', 'JUNK'],
      ];
      for (const [action, key, label] of controls) {
        const take = button('', () => this.actions.takeLoot?.(action), action === 'take' ? 'primary-button' : 'secondary-button');
        take.append(keycap(key), el('span', '', label));
        take.disabled = !this.actions.takeLoot || state.inventory.length >= INVENTORY_CAPACITY;
        take.title = action === 'equip' ? `Take and equip for your ${item.target}.` : action === 'junk' ? 'Take into backpack marked as junk.' : 'Take into backpack.';
        actions.append(take);
      }
    }
    card.append(actions);
    const footer = el('footer', 'card-brand-footer');
    const wordmark = el('strong', '', brand.name.toUpperCase());
    wordmark.style.color = brand.color;
    wordmark.title = brand.description;
    footer.append(el('span', '', `${item.target.toUpperCase()} / ${item.slot.toUpperCase()}`), wordmark);
    card.append(footer);
    host.append(card);
  }

  private renderCardStatus(status: CardStatus): HTMLElement {
    const strip = el('div', 'card-element-strip');
    strip.style.setProperty('--element-color', status.color);
    strip.title = status.description;
    strip.append(createItemIcon(status.element, `${status.label} effect`));
    const body = el('div', 'card-element-body');
    const heading = el('div', 'card-element-heading');
    heading.append(el('strong', '', status.label.toUpperCase()));
    if (status.duration > 0) {
      const duration = el('span', 'card-effect-duration', `${compactCardNumber(status.duration)}s`);
      duration.title = `Effect duration: ${status.durationDisplay}. Repeated procs refresh the effect.`;
      heading.append(duration);
    }
    body.append(heading);
    const values = el('div', 'card-element-values');
    if (status.dps !== null) {
      const power = el('div', 'card-element-power');
      power.title = `${status.dpsDisplay}. Base damage per second after one successful proc; not chance-weighted weapon DPS. ${status.description}`;
      power.append(el('strong', 'card-element-damage', compactCardNumber(status.dps)), el('span', 'card-element-unit', status.dpsLabel),
        cardDelta(status.dpsDelta, 'Base damage per second on proc'));
      values.append(power);
    } else if (status.element !== 'kinetic') {
      values.append(el('strong', 'card-element-control', status.duration > 0 ? 'CONTROL' : 'NO EFFECT'));
    }
    if (status.element !== 'kinetic') {
      const chance = el('div', 'card-proc-chance');
      chance.title = 'Chance per impact to apply this effect. Repeated procs refresh the effect.';
      chance.append(el('strong', '', status.chanceDisplay), el('span', 'card-chance-label', 'chance'), cardDelta(status.chanceDelta, 'Proc chance'));
      values.append(chance);
    }
    if (values.childElementCount > 0) body.append(values);
    // Keep the extra mechanics (such as corrosion vulnerability or shock chains) visible.
    if (status.element !== 'fire') body.append(el('p', 'card-control-effect', status.effect));
    strip.append(body);
    return strip;
  }

  toast(message: string, color?: string): void {
    const item = el('div', 'toast');
    if (color) item.style.setProperty('--toast-color', color);
    item.append(el('span', 'toast-icon', '◇'), el('span', '', message));
    this.toasts.append(item);
    while (this.toasts.childElementCount > 4) this.toasts.firstElementChild?.remove();
    setTimeout(() => { item.classList.add('leaving'); setTimeout(() => item.remove(), 250); }, 3400);
  }

  /** Position is a normalized (0..1) viewport point projected by the combat scene. */
  hit(damage: number, critical = false, effect?: DamageEffect, position?: { x: number; y: number }): void {
    this.fields.crosshair.classList.add('hit');
    clearTimeout(this.hitTimeout);
    this.hitTimeout = setTimeout(() => this.fields.crosshair.classList.remove('hit'), 120);
    const number = el('span', `damage-number${critical ? ' critical' : ''}${effect ? ' status-damage-number' : ''}`);
    if (effect) {
      number.append(createItemIcon(damageEffectIcons[effect], `${effect} damage`), el('strong', '', compactCardNumber(damage)));
    } else {
      number.textContent = `${Math.round(damage)}${critical ? '!' : ''}`;
    }
    number.style.setProperty('--damage-color', getDamageColor({ critical, effect }));
    number.dataset.damageKind = effect ?? (critical ? 'critical' : 'normal');
    number.style.setProperty('--offset', `${effect ? 38 + Math.random() * 42 : (Math.random() - 0.5) * 70}px`);
    if (position && Number.isFinite(position.x) && Number.isFinite(position.y)
      && position.x >= 0 && position.x <= 1 && position.y >= 0 && position.y <= 1) {
      number.classList.add('damage-at-target');
      number.style.setProperty('--hit-x', `${position.x * 100}vw`);
      number.style.setProperty('--hit-y', `${position.y * 100}vh`);
      number.style.setProperty('--hit-jitter', `${(Math.random() - 0.5) * 18}px`);
    }
    this.numbers.append(number);
    setTimeout(() => number.remove(), effect ? 1100 : 800);
  }

  damage(): void {
    this.damageLayer.classList.add('active');
    clearTimeout(this.damageTimeout);
    this.damageTimeout = setTimeout(() => this.damageLayer.classList.remove('active'), 190);
  }
}
