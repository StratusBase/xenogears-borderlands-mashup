import { getDamageColor, type DamageEffect } from '../core/feedback';

export type DamageFeedbackQuality = 'classic' | 'crowd';
export interface DamagePoint { x: number; y: number }
export interface DamageHead extends DamagePoint { targetId: string | number; primary?: boolean }
export interface DamageHudState { encounterGuide: boolean; toasts: number }
export interface DamageFeedbackContext {
  targetId: string | number;
  kind: 'direct' | 'status';
  at: number;
  head?: DamagePoint;
}
export interface DamageNumberEvent extends DamageFeedbackContext {
  amount: number;
  critical: boolean;
  effect?: DamageEffect;
  position: DamagePoint;
}
export const DAMAGE_NUMBER_LIMITS = Object.freeze({ nodes: 40, records: 256, statusWindow: .65,
  directLifetime: .8, criticalLifetime: .8, statusLifetime: 1.1, float: 18 });

export interface DamageNumberRecord extends DamageNumberEvent {
  id: number;
  events: number;
  mergeUntil: number;
  visibleAt?: number;
  paintedAmount: number;
  paintedEvents: number;
  lane: number;
  overflow: boolean;
  breakdown: Partial<Record<DamageEffect, { amount: number; events: number }>>;
  edgeCache?: { x: number; y: number; anchorX: number; anchorY: number; viewportWidth: number; viewportHeight: number };
  edgePresented?: boolean;
}
function canonical(effect?: DamageEffect): DamageEffect | undefined {
  return effect === 'corrosion' ? 'corrosive' : effect === 'frost' ? 'ice' : effect;
}
const cues: Record<DamageEffect, string> = { fire: 'FIRE', ice: 'ICE', frost: 'ICE', shock: 'SHOCK',
  corrosive: 'ACID', corrosion: 'ACID', radiation: 'RAD', gravity: 'GRAV', adhesive: 'STICK', bleed: 'BLEED' };
function recordCue(record: DamageNumberRecord): string {
  const cue = record.critical ? 'CRIT' : record.effect ? cues[record.effect] : record.kind === 'status' ? 'STATUS' : '';
  return record.overflow ? `MORE${cue ? ` ${cue}` : ''}` : cue;
}
function lifetime(record: DamageNumberRecord): number {
  return record.critical ? DAMAGE_NUMBER_LIMITS.criticalLifetime
    : record.kind === 'status' ? DAMAGE_NUMBER_LIMITS.statusLifetime : DAMAGE_NUMBER_LIMITS.directLifetime;
}
/** Aggregate raw amounts first; round the final status total only once.
 * Full amounts remain in data/tooltip/accounting; no k/M truncation. */
export function formatDamageAmount(amount: number, kind: 'status' | 'direct' = 'status'): string {
  if (kind === 'direct' && amount >= 1) return String(Math.round(amount));
  return String(amount >= .01 ? Number(amount.toFixed(2)) : Number(amount.toPrecision(2)));
}

/** A finite presentation queue. Combat events are never delayed or changed.
 * Ordinary hits remain individual; status windows retain each target's exact
 * elemental breakdown in one compact row rather than four competing labels.
 * Reserved, explicitly labelled overflow tallies conserve every accepted amount
 * even if an artificial burst exhausts the ordinary queue. */
export class DamageNumberModel {
  readonly records: DamageNumberRecord[] = [];
  private sequence = 0;
  private receivedEvents = 0;
  private receivedDamage = 0;
  private directEvents = 0;
  private statusEvents = 0;
  private criticalEvents = 0;
  private mergedEvents = 0;
  private salvoMergedEvents = 0;
  private overflowEvents = 0;
  private renderedEvents = 0;
  private renderedDamage = 0;
  private retiredDamage = 0;
  private ordinaryRecords = 0;
  private revision = 0;
  private now = 0;
  private maxQueueDelay = 0;
  private resetCancelledDamage = 0;
  private resetCancelledEvents = 0;
  private resetCount = 0;
  private lastResetReason = '';
  private edgeRecords = 0;
  get version(): number { return this.revision; }

  push(event: DamageNumberEvent): void {
    if (!Number.isFinite(event.amount) || event.amount <= 0 || !Number.isFinite(event.at)
      || !Number.isFinite(event.position.x) || !Number.isFinite(event.position.y)) return;
    const effect = canonical(event.effect), kind = event.critical ? 'direct' : event.kind;
    this.revision++;
    this.receivedEvents++; this.receivedDamage += event.amount;
    if (kind === 'status') this.statusEvents++; else this.directEvents++;
    if (event.critical) this.criticalEvents++;
    let record = kind === 'status' && effect ? this.records.find(candidate => !candidate.overflow
      && candidate.kind === 'status' && candidate.targetId === event.targetId
      && event.at >= candidate.at && event.at < candidate.mergeUntil) : undefined;
    if (kind === 'direct') record = this.records.find(candidate => !candidate.overflow && candidate.kind === 'direct'
      && candidate.targetId === event.targetId && candidate.at === event.at
      && candidate.critical === event.critical && candidate.effect === effect);
    if (record) this.mergedEvents++;
    if (record && kind === 'direct') this.salvoMergedEvents++;
    const overflow = !record && this.ordinaryRecords >= DAMAGE_NUMBER_LIMITS.records;
    if (overflow) {
      this.overflowEvents++;
      record = this.records.find(candidate => candidate.overflow && candidate.kind === kind
        && candidate.critical === event.critical && candidate.effect === effect);
    }
    if (record) {
      if (record.overflow && record.visibleAt !== undefined && event.at >= record.visibleAt + lifetime(record)) record.visibleAt = undefined;
      record.amount += event.amount; record.events++;
      if (kind === 'status' && effect) {
        const part = record.breakdown[effect] ?? (record.breakdown[effect] = { amount: 0, events: 0 });
        part.amount += event.amount; part.events++;
        if (Object.keys(record.breakdown).length > 1) record.effect = undefined;
      }
      if (!record.overflow) { record.position = event.position; record.head = event.head; }
      return;
    }
    if (!overflow) this.ordinaryRecords++;
    this.records.push({ ...event, effect, kind, id: ++this.sequence, events: 1,
      targetId: overflow ? 'overflow' : event.targetId, position: overflow ? { x: .88, y: .22 } : event.position,
      head: overflow ? undefined : event.head, mergeUntil: event.at + DAMAGE_NUMBER_LIMITS.statusWindow,
      paintedAmount: 0, paintedEvents: 0, lane: -1, overflow,
      breakdown: kind === 'status' && effect ? { [effect]: { amount: event.amount, events: 1 } } : {} });
  }

  advance(now: number): void {
    this.now = now;
    let write = 0;
    for (const record of this.records) {
      // A queued amount receives its whole lifetime once first presented.
      if (record.visibleAt !== undefined && now >= record.visibleAt + lifetime(record)
        && record.paintedEvents === record.events) {
        this.retiredDamage += record.amount;
        if (!record.overflow) this.ordinaryRecords--;
      }
      else this.records[write++] = record;
    }
    this.records.length = write;
  }
  presented(record: DamageNumberRecord, now: number, edge = false): void {
    if (record.visibleAt === undefined) this.maxQueueDelay = Math.max(this.maxQueueDelay, Math.max(0, now - record.at));
    if (edge && !record.edgePresented) { record.edgePresented = true; this.edgeRecords++; }
    record.visibleAt ??= now;
    this.renderedEvents += record.events - record.paintedEvents;
    this.renderedDamage += record.amount - record.paintedAmount;
    record.paintedEvents = record.events; record.paintedAmount = record.amount;
  }
  clear(reason = 'reset'): void {
    for (const record of this.records) {
      this.resetCancelledDamage += record.amount - record.paintedAmount;
      this.resetCancelledEvents += record.events - record.paintedEvents;
      this.retiredDamage += record.paintedAmount;
    }
    this.records.length = 0;
    this.ordinaryRecords = 0; this.revision++;
    this.resetCount++; this.lastResetReason = reason;
  }
  get diagnostics() {
    let pending = 0, unpresentedDamage = 0, unpresentedEvents = 0, oldestPendingSeconds = 0;
    for (const record of this.records) {
      if (record.visibleAt === undefined) { pending++; oldestPendingSeconds = Math.max(oldestPendingSeconds, this.now - record.at); }
      unpresentedDamage += record.amount - record.paintedAmount;
      unpresentedEvents += record.events - record.paintedEvents;
    }
    return { receivedEvents: this.receivedEvents, receivedDamage: this.receivedDamage,
      directEvents: this.directEvents, statusEvents: this.statusEvents, criticalEvents: this.criticalEvents,
      mergedEvents: this.mergedEvents, salvoMergedEvents: this.salvoMergedEvents, overflowEvents: this.overflowEvents,
      renderedEvents: this.renderedEvents, renderedDamage: this.renderedDamage,
      retiredDamage: this.retiredDamage, unpresentedDamage, unpresentedEvents, records: this.records.length, pending,
      resetCancelledDamage: this.resetCancelledDamage, resetCancelledEvents: this.resetCancelledEvents,
      resetCount: this.resetCount, lastResetReason: this.lastResetReason, edgeRecords: this.edgeRecords,
      maxQueueDelay: this.maxQueueDelay, oldestPendingSeconds: Math.max(0, oldestPendingSeconds) };
  }
}

export interface DamagePlacement { record: DamageNumberRecord; x: number; y: number; width: number; height: number; edge: boolean; direction: string }
const CELL_X = 24, CELL_Y = 16, ROW = 26;
const EDGE_DIRECTIONS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
/** Estimates fixed typography in CSS pixels; never measures DOM or scales by DPR.
 * Occupancy includes the complete upward travel, all known heads and reticle. */
export class DamageNumberLayout {
  private cells = new Uint8Array(0);
  private columns = 0;
  private rows = 0;
  private width = 0;
  private height = 0;
  private order: DamageNumberRecord[] = [];
  private placements: DamagePlacement[] = [];
  private occupy(x: number, y: number, width: number, height: number, test = false): boolean {
    const left = Math.max(0, Math.floor(x / CELL_X)), top = Math.max(0, Math.floor(y / CELL_Y));
    const right = Math.min(this.columns - 1, Math.floor((x + width) / CELL_X)), bottom = Math.min(this.rows - 1, Math.floor((y + height) / CELL_Y));
    for (let row = top; row <= bottom; row++) for (let column = left; column <= right; column++) {
      const index = row * this.columns + column;
      if (test && this.cells[index]) return false;
      if (!test) this.cells[index] = 1;
    }
    return true;
  }
  private spot(x: number, y: number, width: number, height: number, mark = false): boolean {
    const left = x - width / 2 - 3, top = y - height / 2 - DAMAGE_NUMBER_LIMITS.float - 3;
    return this.occupy(left, top, width + 6, height + DAMAGE_NUMBER_LIMITS.float + 6, !mark);
  }
  /** Exceptional, delayed fallback: the closest safe location to this SAME
   * target's anchor, with a directional cue. Never an arbitrary corner slot. */
  private nearestSafe(record: DamageNumberRecord, width: number, height: number) {
    const anchor = record.head ?? record.position, anchorX = anchor.x * this.width, anchorY = anchor.y * this.height;
    const cached = record.edgeCache;
    if (cached && cached.viewportWidth === this.width && cached.viewportHeight === this.height
      && Math.abs(cached.anchorX - anchorX) <= 24 && Math.abs(cached.anchorY - anchorY) <= 24
      && cached.x >= width / 2 + 18 && cached.x <= this.width - width / 2 - 18
      && this.spot(cached.x, cached.y, width, height)) return cached;
    let bestDistance = Infinity, bestX = 0, bestY = 0;
    for (let y = 72; y <= this.height - 110; y += 26) for (let x = width / 2 + 18; x <= this.width - width / 2 - 18; x += 24) {
      const distance = (x - anchorX) ** 2 + (y - anchorY) ** 2;
      if (distance >= bestDistance || !this.spot(x, y, width, height)) continue;
      bestDistance = distance; bestX = x; bestY = y;
    }
    if (!Number.isFinite(bestDistance)) return undefined;
    const result = cached ?? (record.edgeCache = { x: 0, y: 0, anchorX: 0, anchorY: 0, viewportWidth: 0, viewportHeight: 0 });
    result.x = bestX; result.y = bestY; result.anchorX = anchorX; result.anchorY = anchorY;
    result.viewportWidth = this.width; result.viewportHeight = this.height;
    return result;
  }
  place(records: readonly DamageNumberRecord[], now: number, width: number, height: number,
    heads: readonly DamagePoint[] = [], hud?: DamageHudState): readonly DamagePlacement[] {
    this.width = Math.max(240, width); this.height = Math.max(180, height);
    const columns = Math.ceil(this.width / CELL_X), rows = Math.ceil(this.height / CELL_Y);
    if (columns !== this.columns || rows !== this.rows) { this.columns = columns; this.rows = rows; this.cells = new Uint8Array(columns * rows); }
    this.cells.fill(0); this.order.length = 0;
    // Established HUD footprints, expressed only in CSS pixels. Smaller
    // viewports scale the reserved margins; no DOM geometry is measured.
    const hudScale = Math.min(1, this.width / 1100, this.height / 650);
    this.occupy(0, 0, 370 * hudScale, 220 * hudScale);
    this.occupy(this.width - 320 * hudScale, 0, 320 * hudScale, 180 * hudScale);
    this.occupy(this.width / 2 - 165 * hudScale, 110 * hudScale, 330 * hudScale, 125 * hudScale);
    this.occupy(0, this.height - 235 * hudScale, 340 * hudScale, 235 * hudScale);
    this.occupy(this.width - 340 * hudScale, this.height - 205 * hudScale, 340 * hudScale, 205 * hudScale);
    this.occupy(this.width / 2 - 120 * hudScale, this.height - 205 * hudScale, 240 * hudScale, 205 * hudScale);
    if (hud?.encounterGuide) this.occupy(36 * hudScale, 140 * hudScale, 600 * hudScale, 170 * hudScale);
    if (hud?.toasts) this.occupy(this.width - 420 * hudScale, 166 * hudScale, 420 * hudScale,
      (Math.min(4, hud.toasts) * 72 + 12) * hudScale);
    this.occupy(this.width / 2 - 48, this.height / 2 - 48, 96, 96);
    for (const head of heads) this.occupy(head.x * this.width - 28, head.y * this.height - 14, 56, 62);
    for (const record of records) {
      this.order.push(record);
      if (record.head) this.occupy(record.head.x * this.width - 28, record.head.y * this.height - 14, 56, 62);
    }
    // Waiting status rows never outrank responsive direct or critical feedback.
    const priority = (record: DamageNumberRecord) => (record.critical ? 100 : record.kind === 'direct' ? 80 : 1)
      + (now - record.at > .8 && record.visibleAt === undefined ? 4 : 0);
    this.order.sort((a, b) => priority(b) - priority(a) || a.id - b.id);
    let placed = 0;
    for (const record of this.order) {
      if (placed === DAMAGE_NUMBER_LIMITS.nodes) break;
      const cue = recordCue(record);
      let labelWidth = Math.min(260, Math.max(72, formatDamageAmount(record.amount, record.kind).length * (record.critical ? 13 : record.kind === 'direct' ? 10 : 8)
        + cue.length * 5 + (record.events > 1 ? 26 : 0) + 16));
      const labelHeight = record.critical ? 27 : record.kind === 'direct' ? 23 : 19;
      let found = false;
      const anchor = record.head ?? record.position;
      // Two nearby side lanes retain association with the actual target.
      // Excess rows wait in the finite queue instead of scattering to corners.
      for (let attempt = -1; attempt < 40; attempt++) {
        const lane = attempt < 0 ? record.lane : attempt;
        if (lane < 0) continue;
        const side = lane % 2 === 0 ? 1 : -1, ring = Math.floor(lane / 20);
        const row = Math.floor(lane / 2) % 10;
        const offsetY = row === 0 ? 0 : Math.ceil(row / 2) * (row % 2 ? -ROW : ROW);
        let x = anchor.x * this.width + side * (42 + labelWidth / 2 + ring * 44);
        let y = anchor.y * this.height - 28 + offsetY;
        x = Math.max(labelWidth / 2 + 18, Math.min(this.width - labelWidth / 2 - 18, x));
        y = Math.max(72, Math.min(this.height - 110, y));
        if (!this.spot(x, y, labelWidth, labelHeight)) continue;
        this.spot(x, y, labelWidth, labelHeight, true);
        record.lane = lane;
        const placement = this.placements[placed] ?? (this.placements[placed] = {} as DamagePlacement);
        placement.record = record; placement.x = x; placement.y = y; placement.width = labelWidth; placement.height = labelHeight;
        placement.edge = false; placement.direction = '';
        placed++; found = true; break;
      }
      if (!found) {
        record.lane = -1;
        if (now - record.at < .25) continue;
        labelWidth = Math.min(272, labelWidth + 12);
        const edge = this.nearestSafe(record, labelWidth, labelHeight);
        if (!edge) continue;
        this.spot(edge.x, edge.y, labelWidth, labelHeight, true);
        const placement = this.placements[placed] ?? (this.placements[placed] = {} as DamagePlacement);
        placement.record = record; placement.x = edge.x; placement.y = edge.y; placement.width = labelWidth; placement.height = labelHeight;
        const dx = anchor.x * this.width - edge.x, dy = anchor.y * this.height - edge.y;
        placement.direction = Math.hypot(dx, dy) < 12 ? 'EDGE' : EDGE_DIRECTIONS[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
        placement.edge = true; placed++;
      }
    }
    this.placements.length = placed;
    return this.placements;
  }
}

interface NumberNode { root: HTMLSpanElement; cue: HTMLSpanElement; value: HTMLElement; count: HTMLSpanElement; id: number; signature: string }
export class DamageNumberPresentation {
  readonly model = new DamageNumberModel();
  private readonly layout = new DamageNumberLayout();
  private readonly nodes: NumberNode[] = [];
  private readonly bindings = new Map<number, NumberNode>();
  private hitUntil = -Infinity;
  private hit = false;
  private paused = false;
  private writes = 0;
  private visible = 0;
  private readonly visibleIds = new Set<number>();
  private lastTime = NaN;
  private lastWidth = 0;
  private lastHeight = 0;
  private lastVersion = -1;
  private lastHud = '';
  constructor(private readonly layer: HTMLElement, private readonly crosshair: HTMLElement) {
    layer.classList.add('crowd-damage-numbers'); layer.setAttribute('aria-hidden', 'true');
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < DAMAGE_NUMBER_LIMITS.nodes; i++) {
      const root = document.createElement('span'), cue = document.createElement('span'), value = document.createElement('strong'), count = document.createElement('span');
      root.className = 'crowd-damage-number'; cue.className = 'damage-cue'; count.className = 'damage-count';
      root.hidden = true; root.append(cue, value, count); fragment.append(root);
      this.nodes.push({ root, cue, value, count, id: -1, signature: '' });
    }
    layer.append(fragment);
  }
  push(event: DamageNumberEvent): void { this.model.push(event); this.hitUntil = Math.max(this.hitUntil, event.at + .12); }
  update(now: number, width: number, height: number, paused: boolean, heads: readonly DamageHead[] = [], hud?: DamageHudState): void {
    if (paused !== this.paused) { this.paused = paused; this.layer.dataset.paused = String(paused); }
    const hit = !paused && now < this.hitUntil;
    if (hit !== this.hit) { this.hit = hit; this.crosshair.classList.toggle('hit', hit); }
    if (paused) return;
    const hudKey = `${hud?.encounterGuide ?? false}/${hud?.toasts ?? 0}`;
    if (now === this.lastTime && width === this.lastWidth && height === this.lastHeight && this.model.version === this.lastVersion && hudKey === this.lastHud) return;
    this.lastHud = hudKey;
    this.lastTime = now; this.lastWidth = width; this.lastHeight = height; this.lastVersion = this.model.version;
    this.model.advance(now);
    for (const record of this.model.records) {
      const head = heads.find(candidate => candidate.targetId === record.targetId && candidate.primary !== false);
      if (head) {
        // Game reuses its head projection buffer; retain this target's own point.
        record.head ??= { x: head.x, y: head.y };
        record.head.x = head.x; record.head.y = head.y;
      }
    }
    const placements = this.layout.place(this.model.records, now, width, height, heads, hud);
    this.visibleIds.clear(); for (const placement of placements) this.visibleIds.add(placement.record.id);
    for (const [id, node] of this.bindings) if (!this.visibleIds.has(id)) { node.root.hidden = true; node.id = -1; this.bindings.delete(id); }
    this.visible = placements.length;
    for (const placement of placements) {
      const record = placement.record;
      let node = this.bindings.get(record.id);
      if (!node) {
        node = this.nodes.find(candidate => candidate.id < 0)!;
        node.id = record.id; node.signature = ''; node.root.hidden = false; this.bindings.set(record.id, node);
      }
      const signature = `${record.amount}/${record.events}/${record.critical}/${record.effect}/${record.overflow}/${placement.direction}`;
      if (node.signature !== signature) {
        node.signature = signature;
        node.root.dataset.damageKind = record.critical ? 'critical' : record.effect ?? (record.kind === 'status' ? 'status' : 'normal');
        node.root.dataset.feedbackId = String(record.id);
        node.root.dataset.damageBreakdown = JSON.stringify(record.breakdown);
        node.root.dataset.eventKind = record.kind; node.root.dataset.targetId = String(record.targetId);
        node.root.dataset.damageAmount = String(record.amount); node.root.dataset.damageEvents = String(record.events);
        node.root.dataset.overflow = String(record.overflow);
        node.root.dataset.feedbackPlacement = placement.edge ? 'edge' : 'nearby';
        node.root.className = `crowd-damage-number ${record.critical ? 'critical' : record.kind}`;
        node.root.style.setProperty('--damage-color', getDamageColor(record));
        node.cue.textContent = `${recordCue(record)}${placement.edge ? ` ${placement.direction}` : ''}`.trim();
        const elements = Object.keys(record.breakdown) as DamageEffect[];
        node.cue.style.backgroundImage = elements.length > 1 ? `linear-gradient(to right,${elements.map((element, i) => {
          const color = getDamageColor({ critical: false, effect: element });
          return `${color} ${i / elements.length * 100}%,${color} ${(i + 1) / elements.length * 100}%`;
        }).join(',')})` : '';
        node.value.textContent = `${formatDamageAmount(record.amount, record.kind)}${record.critical ? '!' : ''}`;
        node.count.textContent = record.events > 1 ? `×${record.events}` : '';
        node.root.title = `${record.amount} damage · ${record.events} ${record.critical ? 'critical hits' : record.kind === 'status' ? 'status ticks' : 'hits'}${record.overflow ? ' · overflow tally' : ''}`
          + elements.map(element => ` · ${cues[element]} ${record.breakdown[element]!.amount} (${record.breakdown[element]!.events})`).join('')
          + (placement.edge ? ` · nearest safe edge ${placement.direction}, same target` : '');
        node.root.style.width = `${placement.width}px`;
        this.writes++;
      }
      this.model.presented(record, now, placement.edge);
      const age = Math.max(0, now - record.visibleAt!), progress = Math.min(1, age / lifetime(record));
      node.root.style.transform = `translate3d(${(placement.x - placement.width / 2).toFixed(2)}px,${(placement.y - placement.height / 2 - DAMAGE_NUMBER_LIMITS.float * progress).toFixed(2)}px,0)`;
      node.root.style.opacity = String(progress < .72 ? 1 : (1 - progress) / .28);
    }
  }
  clear(reason = 'reset'): void {
    this.model.clear(reason); this.bindings.clear(); this.visible = 0; this.hitUntil = -Infinity;
    for (const node of this.nodes) { node.root.hidden = true; node.id = -1; node.signature = ''; }
    this.crosshair.classList.remove('hit'); this.hit = false;
  }
  dispose(): void { this.clear('dispose'); for (const node of this.nodes) node.root.remove(); this.nodes.length = 0; }
  get diagnostics() { return { quality: 'crowd' as const, ...this.model.diagnostics, visible: this.visible,
    pooledNodes: this.nodes.length, createdNodes: DAMAGE_NUMBER_LIMITS.nodes, domContentWrites: this.writes, timersPerEvent: 0 }; }
}
