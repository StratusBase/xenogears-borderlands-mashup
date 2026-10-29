import './weaponWorkbench.css';
import { rarityColors, type Item, type Mode, type Progression, type Rarity } from '../core/index';
import {
  brandList, brands, elementLabels, projectileLabels, projectileTrailLabels, weaponTypeLabels,
} from '../core/arsenal';
import { buildItemCard, type CardMetric, type CardStatus } from '../core/itemCard';
import { DEFAULT_WEAPON_BALANCE, type WeaponBalanceRules } from '../core/weaponBalance';
import {
  DEFAULT_WORKBENCH_CONFIG, WORKBENCH_PRESETS, createWorkbenchWeapon, normalizeWorkbenchConfig,
  parseWorkbenchCode, workbenchCode, type WorkbenchConfig,
} from '../core/workbench';
import { LoadoutPreview } from '../rendering/LoadoutPreview';
import { createItemIcon, type ItemIconName } from './itemIcons';

export interface WeaponWorkbenchActions {
  test(item: Item, code: string): void;
  targets(): void;
  close(): void;
  toast?(message: string): void;
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text) element.textContent = text;
  return element;
}

function action(label: string, callback: () => void, className = ''): HTMLButtonElement {
  const button = node('button', className, label);
  button.type = 'button';
  button.addEventListener('click', event => { event.stopPropagation(); callback(); });
  return button;
}

const metricIcons: Partial<Record<CardMetric['key'], ItemIconName>> = {
  damage: 'damage', spread: 'spread', reload: 'reload', fireRate: 'fireRate', magazine: 'magazine',
};
const rarityLabels: Record<Rarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };

function compact(value: number): string {
  return Math.abs(value) >= 1000 ? `${Number((value / 1000).toFixed(1))}k` : String(Number(value.toFixed(2)));
}

function metricDisplay(metric: CardMetric): string {
  const pellets = metric.key === 'damage' ? /^([0-9.]+)×([0-9]+)$/.exec(metric.display) : null;
  if (pellets) return `${compact(Number(pellets[1]))}×${pellets[2]}`;
  return Math.abs(metric.value) >= 1000 ? `${compact(metric.value)}${metric.unit}` : metric.display;
}

/** Reuses real item builders and equipped-model previews; drafts never mutate the backpack. */
export class WeaponWorkbench {
  readonly element = node('section', 'weapon-workbench');
  private readonly panel = node('div', 'workbench-panel');
  private readonly controls = node('div', 'workbench-controls');
  private readonly previewHost = node('div', 'workbench-preview-host');
  private readonly detail = node('div', 'workbench-detail');
  private readonly description = node('p', 'workbench-brand-description');
  private readonly code = node('input', 'workbench-code');
  private readonly message = node('p', 'workbench-message');
  private readonly preset = node('select', 'workbench-select workbench-preset-select');
  private readonly focusButtons = new Map<'weapon' | 'loadout', HTMLButtonElement>();
  private focus: 'weapon' | 'loadout' = 'weapon';
  private readonly fields = new Map<keyof WorkbenchConfig, HTMLSelectElement | HTMLInputElement>();
  private config = normalizeWorkbenchConfig(DEFAULT_WORKBENCH_CONFIG);
  private state: Progression | null = null;
  private draft: Item | null = null;
  private preview: LoadoutPreview | null = null;
  private previewFailed = false;
  private opened = false;

  constructor(private readonly host: HTMLElement, private readonly actions: WeaponWorkbenchActions,
    private readonly weaponBalance: Readonly<WeaponBalanceRules> = DEFAULT_WEAPON_BALANCE) {
    this.element.hidden = true;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-labelledby', 'workbench-title');
    this.element.addEventListener('click', event => event.stopPropagation());
    this.element.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); this.actions.close(); }
    });
    const header = node('header', 'workbench-header');
    const heading = node('div');
    heading.append(node('span', 'workbench-eyebrow', 'SANDBOX / PROTOTYPE STATION'));
    const title = node('h2', 'workbench-title', 'WEAPON WORKBENCH'); title.id = 'workbench-title';
    heading.append(title);
    header.append(heading, action('CLOSE ×', () => this.actions.close(), 'workbench-close'));

    const body = node('div', 'workbench-body');
    this.buildControls();
    const previewColumn = node('div', 'workbench-preview-column');
    const previewHeading = node('div', 'workbench-preview-heading');
    const focusTabs = node('div', 'workbench-focus-tabs');
    for (const focus of ['weapon', 'loadout'] as const) {
      const button = action(focus.toUpperCase(), () => {
        this.focus = focus;
        this.syncFocus(); this.preview?.setFocus(focus);
      }, 'workbench-focus-button');
      button.setAttribute('aria-label', `${focus === 'weapon' ? 'Weapon close-up' : 'Full loadout'} preview`);
      this.focusButtons.set(focus, button); focusTabs.append(button);
    }
    previewHeading.append(focusTabs, node('span', '', 'DRAG TO ROTATE'));
    this.syncFocus();
    this.previewHost.setAttribute('aria-label', 'Live configured weapon on your current equipment');
    previewColumn.append(previewHeading, this.previewHost,
      node('p', 'workbench-preview-note', 'The weapon changes here. Your other equipment stays fitted.'));
    body.append(this.controls, previewColumn, this.detail);

    const footer = node('footer', 'workbench-footer');
    const codeBlock = node('div', 'workbench-code-block');
    const codeLabel = node('label', 'workbench-eyebrow', 'BUILD CODE / COPY WITH YOUR FEEDBACK');
    this.code.id = 'workbench-build-code'; codeLabel.htmlFor = this.code.id;
    this.code.type = 'text'; this.code.spellcheck = false; this.code.autocomplete = 'off';
    this.code.setAttribute('aria-label', 'Build code; paste a code and select Load');
    this.code.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); this.loadCode(); } });
    const codeRow = node('div', 'workbench-code-row');
    codeRow.append(this.code, action('COPY', () => { void this.copyCode(); }, 'workbench-small-button'),
      action('LOAD', () => this.loadCode(), 'workbench-small-button'));
    this.message.setAttribute('role', 'status'); this.message.setAttribute('aria-live', 'polite');
    codeBlock.append(codeLabel, codeRow, this.message);
    const actionBar = node('div', 'workbench-actions');
    actionBar.append(action('RESET DUMMY', () => { this.actions.targets(); this.say('Dummy measurements reset.'); }, 'workbench-secondary'),
      action('EQUIP & TEST ↗', () => { if (this.draft) this.actions.test(this.draft, workbenchCode(this.config)); }, 'workbench-test'));
    const actionGroup = node('div', 'workbench-action-group');
    actionGroup.append(actionBar, node('p', 'workbench-controller-hint', 'D-PAD ↑↓ navigate · ←→ adjust · A select · B close'));
    footer.append(codeBlock, actionGroup);
    this.panel.append(header, body, footer); this.element.append(this.panel);
  }

  show(state: Progression, mode: Mode): void {
    this.state = state;
    if (!this.opened) this.config = normalizeWorkbenchConfig({ ...this.config, target: mode });
    this.opened = true;
    if (this.element.parentElement !== this.host) this.host.append(this.element);
    this.element.hidden = false;
    this.message.textContent = '';
    this.syncFields();
    this.updateDraft();
  }

  hide(): void { this.element.hidden = true; this.preview?.setVisible(false); }

  dispose(): void { this.preview?.dispose(); this.preview = null; this.element.remove(); this.state = null; }

  private buildControls(): void {
    const examples = node('label', 'workbench-field workbench-examples');
    examples.append(node('span', 'workbench-eyebrow', 'EXAMPLES / EVERY MAKE, TYPE & EFFECT'));
    this.preset.setAttribute('aria-label', 'Weapon examples');
    const custom = node('option', '', 'Custom build'); custom.value = ''; this.preset.append(custom);
    for (const preset of WORKBENCH_PRESETS) {
      const option = node('option', '', preset.label); option.value = preset.id; this.preset.append(option);
    }
    this.preset.addEventListener('change', () => {
      const preset = WORKBENCH_PRESETS.find(candidate => candidate.id === this.preset.value);
      if (!preset) return;
      this.config = normalizeWorkbenchConfig({ ...this.config, ...preset.config, target: this.config.target });
      this.syncFields(); this.updateDraft();
    });
    examples.append(this.preset); this.controls.append(examples);
    const grid = node('div', 'workbench-field-grid');
    this.select(grid, 'target', 'Loadout', [['pilot', 'Pilot'], ['mech', 'Mech']]);
    this.select(grid, 'brand', 'Manufacturer', brandList.map(brand => [brand.id, brand.name]));
    this.select(grid, 'weaponType', 'Weapon type', Object.entries(weaponTypeLabels));
    this.select(grid, 'affix', 'Assembly', [['standard', 'Standard'], ['heavy', 'Heavy'], ['rapid', 'Rapid'], ['compact', 'Compact']]);
    this.select(grid, 'projectile', 'Projectile', Object.entries(projectileLabels));
    this.select(grid, 'trail', 'Flight style', Object.entries(projectileTrailLabels));
    this.select(grid, 'element', 'Primary element', Object.entries(elementLabels));
    this.select(grid, 'secondaryElement', 'Secondary element', [['none', 'None'], ...Object.entries(elementLabels).filter(([element]) => element !== 'kinetic')]);
    this.select(grid, 'visualVariant', 'Design variant', [['0', 'A'], ['1', 'B'], ['2', 'C'], ['3', 'D']]);
    this.select(grid, 'rarity', 'Rarity', Object.entries(rarityLabels));
    const levelLabel = node('label', 'workbench-field');
    levelLabel.append(node('span', 'workbench-eyebrow', 'Level'));
    const level = node('input', 'workbench-level'); level.type = 'number'; level.min = '1'; level.max = '100'; level.step = '1';
    level.setAttribute('aria-label', 'Weapon level');
    level.addEventListener('change', () => this.change('level', Number(level.value)));
    this.fields.set('level', level); levelLabel.append(level); grid.append(levelLabel);
    const guarantee = node('label', 'workbench-guarantee');
    const check = node('input'); check.type = 'checkbox'; check.setAttribute('aria-label', 'Guaranteed status procs');
    check.addEventListener('change', () => this.change('guaranteedStatus', check.checked));
    this.fields.set('guaranteedStatus', check);
    const guaranteeCopy = node('span'); guaranteeCopy.append(node('strong', '', '100% STATUS'), node('small', '', 'Repeatable effect tests'));
    guarantee.append(check, guaranteeCopy); grid.append(guarantee);
    this.controls.append(grid, this.description);
    const reset = action('RESET BUILD', () => {
      this.config = normalizeWorkbenchConfig({ ...DEFAULT_WORKBENCH_CONFIG, target: this.config.target });
      this.preset.value = ''; this.syncFields(); this.updateDraft(); this.say('Build reset.');
    }, 'workbench-reset');
    this.controls.append(reset);
  }

  private select(parent: HTMLElement, key: keyof WorkbenchConfig, label: string, choices: [string, string][]): void {
    const field = node('label', 'workbench-field'); field.append(node('span', 'workbench-eyebrow', label));
    const select = node('select', 'workbench-select'); select.setAttribute('aria-label', label);
    for (const [value, label] of choices) { const option = node('option', '', label); option.value = value; select.append(option); }
    select.addEventListener('change', () => this.change(key, key === 'visualVariant' ? Number(select.value) : select.value));
    this.fields.set(key, select); field.append(select); parent.append(field);
  }

  private change(key: keyof WorkbenchConfig, value: unknown): void {
    this.config = normalizeWorkbenchConfig({ ...this.config, [key]: value });
    this.preset.value = ''; this.message.textContent = ''; this.syncFields(); this.updateDraft();
  }

  private syncFields(): void {
    for (const [key, field] of this.fields) {
      if (field instanceof HTMLInputElement && field.type === 'checkbox') field.checked = Boolean(this.config[key]);
      else field.value = String(this.config[key]);
    }
    const secondary = this.fields.get('secondaryElement');
    if (secondary instanceof HTMLSelectElement) {
      for (const option of secondary.options) option.disabled = option.value === this.config.element;
    }
  }

  private updateDraft(): void {
    if (!this.state) return;
    const item = this.draft = createWorkbenchWeapon(this.config);
    const card = buildItemCard(item, undefined, this.weaponBalance);
    this.code.value = workbenchCode(this.config);
    this.panel.style.setProperty('--workbench-brand', brands[this.config.brand].color);
    this.description.textContent = brands[this.config.brand].description;
    this.detail.replaceChildren();
    const meta = node('div', 'workbench-item-meta');
    const rarity = node('span', '', rarityLabels[item.rarity]); rarity.style.color = rarityColors[item.rarity];
    meta.append(rarity, node('span', '', `LV ${item.level}`));
    const name = node('h3', 'workbench-item-name', item.name);
    const brand = node('span', 'workbench-item-brand', brands[item.brand].name.toUpperCase());
    this.detail.append(meta, brand, name);
    if (card.weapon) {
      const dps = node('div', 'workbench-dps');
      dps.append(node('span', 'workbench-eyebrow', 'DIRECT DPS'), node('strong', '', metricDisplay(card.weapon.burstDps)));
      dps.title = card.weapon.burstDps.description;
      this.detail.append(dps);
    }
    const stats = node('div', 'workbench-stats');
    for (const metric of card.stats) {
      const icon = metricIcons[metric.key]; if (!icon) continue;
      const cell = node('div', 'workbench-stat');
      cell.title = `${metric.label}: ${metric.display}. ${metric.description}`;
      cell.setAttribute('aria-label', `${metric.label}: ${metric.display}`);
      cell.append(createItemIcon(icon, metric.label), node('strong', '', metricDisplay(metric))); stats.append(cell);
    }
    this.detail.append(stats);
    const statuses = (card as typeof card & { statuses?: CardStatus[] }).statuses ?? (card.status ? [card.status] : []);
    for (const status of statuses) this.detail.append(this.statusStrip(status));
    const tags = node('div', 'workbench-tags');
    tags.append(node('span', '', projectileLabels[this.config.projectile]), node('span', '', projectileTrailLabels[this.config.trail]),
      node('span', '', `${item.weapon?.speed ?? 0} m/s`));
    if ((item.weapon?.pellets ?? 1) > 1) tags.append(node('span', '', `×${item.weapon!.pellets} pellets`));
    if (item.weapon?.split) {
      tags.append(node('span', '', `${item.weapon.split.count} bomblets`),
        node('span', '', `Split: ${item.weapon.split.delay} s or impact`),
        node('span', '', `Bomblet fuse: ${item.weapon.fuse} s`),
        node('span', '', `Blast: ${item.weapon.blastRadius} m`));
    }
    this.detail.append(tags);
    const note = node('p', 'workbench-test-note', 'Free sandbox build. Equip & test replaces the previous workbench weapon.');
    this.detail.append(note);
    if (!this.previewFailed) {
      try {
        this.preview ??= new LoadoutPreview();
        this.preview.mount(this.previewHost);
        this.preview.setFocus(this.focus);
        this.preview.setLoadout(this.state, this.config.target, item);
        this.preview.setVisible(!this.element.hidden);
      } catch {
        this.previewFailed = true;
        this.preview?.dispose(); this.preview = null;
        this.previewHost.replaceChildren(node('p', 'workbench-preview-unavailable', '3D preview unavailable. Equip and test the build in the field.'));
      }
    }
  }

  private statusStrip(status: CardStatus): HTMLElement {
    const strip = node('div', 'workbench-status'); strip.style.setProperty('--effect-color', status.color);
    strip.title = status.description;
    strip.append(createItemIcon(status.element, status.label));
    const copy = node('div'); copy.append(node('span', 'workbench-eyebrow', status.label));
    const detail = node('div', 'workbench-status-values');
    detail.append(node('strong', '', status.element === 'kinetic' ? 'DIRECT IMPACT' : status.dps === null ? 'CONTROL' : `${Number(status.dps.toFixed(2))} DMG/s`));
    if (status.element !== 'kinetic') detail.append(node('span', '', `${status.chanceDisplay} · ${status.durationDisplay}`));
    copy.append(detail);
    if (status.dps === null && status.element !== 'kinetic') copy.append(node('small', '', status.effect));
    strip.append(copy); return strip;
  }

  private say(message: string): void { this.message.textContent = message; }

  private syncFocus(): void {
    for (const [focus, button] of this.focusButtons) {
      button.classList.toggle('active', this.focus === focus);
      button.setAttribute('aria-pressed', String(this.focus === focus));
    }
  }

  private loadCode(): void {
    const config = parseWorkbenchCode(this.code.value.trim());
    if (!config) { this.say('That build code is not valid.'); this.code.focus(); return; }
    this.config = config; this.preset.value = ''; this.syncFields(); this.updateDraft(); this.say('Build loaded.');
  }

  private async copyCode(): Promise<void> {
    this.code.value = workbenchCode(this.config);
    try { await navigator.clipboard.writeText(this.code.value); this.say('Build code copied.'); }
    catch { this.code.focus(); this.code.select(); this.say('Code selected. Press Ctrl/Cmd+C to copy.'); }
  }
}
