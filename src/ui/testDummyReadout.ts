import './testDummyReadout.css';
import { getDamageColor } from '../core/feedback';
import type { TestDummySnapshot } from '../core/testDummy';
import { createItemIcon } from './itemIcons';

const normalNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

function display(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return value >= 10_000 ? compactNumber.format(value) : normalNumber.format(value);
}

/** Passive on-aim feedback. The game supplies a snapshot only while inspecting the fixed dummy. */
export class TestDummyReadout {
  readonly element = document.createElement('section');
  private readonly lastLabel = document.createElement('span');
  private readonly lastValue = document.createElement('strong');
  private readonly totalValue = document.createElement('strong');
  private readonly dpsValue = document.createElement('strong');
  private key = '';
  private disposed = false;

  constructor(parent: HTMLElement) {
    this.element.className = 'test-dummy-readout';
    this.element.hidden = true;
    this.element.setAttribute('role', 'group');
    this.element.setAttribute('aria-label', 'Training dummy damage measurements');
    const header = document.createElement('div'); header.className = 'dummy-readout-heading';
    const title = document.createElement('span'); title.className = 'dummy-readout-title'; title.textContent = 'TEST DUMMY';
    const infinite = document.createElement('span'); infinite.className = 'dummy-readout-infinite'; infinite.textContent = 'INFINITE';
    header.append(createItemIcon('tracking', 'Training target'), title, infinite);
    const metrics = document.createElement('div'); metrics.className = 'dummy-readout-metrics';
    const last = document.createElement('div'); last.className = 'dummy-readout-metric dummy-readout-last';
    this.lastLabel.className = 'dummy-readout-label'; this.lastLabel.textContent = 'LAST HIT';
    last.append(this.lastLabel, this.lastValue);
    const total = document.createElement('div'); total.className = 'dummy-readout-metric';
    const totalLabel = document.createElement('span'); totalLabel.className = 'dummy-readout-label'; totalLabel.textContent = 'TOTAL';
    total.append(totalLabel, this.totalValue);
    const dps = document.createElement('div'); dps.className = 'dummy-readout-metric';
    const dpsLabel = document.createElement('span'); dpsLabel.className = 'dummy-readout-label'; dpsLabel.textContent = '5 s DPS';
    dpsLabel.prepend(createItemIcon('dps', 'Damage per second over the last five seconds'));
    dps.append(dpsLabel, this.dpsValue);
    metrics.append(last, total, dps);
    this.element.append(header, metrics);
    parent.append(this.element);
  }

  update(snapshot: TestDummySnapshot | null): void {
    if (this.disposed) return;
    this.element.hidden = snapshot === null;
    if (!snapshot) return;
    const last = snapshot.hitCount > 0 ? display(snapshot.lastHit) : '—';
    const total = display(snapshot.total), dps = display(snapshot.dps);
    const kind = snapshot.latestEffect ?? (snapshot.latestCritical ? 'critical' : 'normal');
    const label = snapshot.latestCritical ? 'LAST CRIT' : snapshot.latestEffect ? 'LAST TICK' : 'LAST HIT';
    const key = `${last}|${total}|${dps}|${kind}`;
    if (key === this.key) return;
    this.key = key;
    this.element.dataset.damageKind = kind;
    this.element.style.setProperty('--dummy-last-color', getDamageColor({ critical: snapshot.latestCritical, effect: snapshot.latestEffect ?? undefined }));
    this.lastLabel.textContent = label;
    this.lastValue.textContent = last;
    this.totalValue.textContent = total;
    this.dpsValue.textContent = dps;
    this.element.setAttribute('aria-label', `Infinite training dummy. ${label.toLowerCase()} ${last}. Total damage ${total}. Damage per second over the last five seconds ${dps}.`);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.element.remove();
  }
}
