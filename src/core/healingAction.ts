import type { Mode } from './index';

export const HEAL_ANIMATION_DURATION = 1.2;
export const HEAL_APPLY_TIME = 0.55;

function validClock(now: number): boolean {
  return Number.isFinite(now) && now >= 0 && now <= Number.MAX_SAFE_INTEGER;
}

/** Uses simulation timestamps only: menus can pause time without advancing the injection. */
export class HealingAction {
  private currentMode: Mode | null = null;
  private startedAt = 0;
  private applied = false;

  get active(): boolean { return this.currentMode !== null; }
  get mode(): Mode | null { return this.currentMode; }

  begin(mode: Mode, now: number): boolean {
    if (this.active || (mode !== 'pilot' && mode !== 'mech') || !validClock(now)
      || now + HEAL_ANIMATION_DURATION > Number.MAX_SAFE_INTEGER) return false;
    this.currentMode = mode;
    this.startedAt = now;
    this.applied = false;
    return true;
  }

  cancel(): void {
    this.currentMode = null;
    this.startedAt = 0;
    this.applied = false;
  }

  progress(now: number): number {
    if (!this.active || !validClock(now)) return 0;
    return Math.min(1, Math.max(0, (now - this.startedAt) / HEAL_ANIMATION_DURATION));
  }

  update(now: number): { apply: Mode | null; finished: boolean } {
    if (!this.active || !validClock(now)) return { apply: null, finished: false };
    // Compare absolute timestamps rather than subtracting elapsed time: e.g.
    // 5.55 - 5 can round below 0.55 even at the intended injection boundary.
    const apply = !this.applied && now >= this.startedAt + HEAL_APPLY_TIME ? this.currentMode : null;
    if (apply !== null) this.applied = true;
    const finished = now >= this.startedAt + HEAL_ANIMATION_DURATION;
    if (finished) this.cancel();
    return { apply, finished };
  }
}
