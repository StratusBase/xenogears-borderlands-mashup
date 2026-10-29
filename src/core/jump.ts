import type { Mode } from './index';

/** Two button presses per landing; a held key must not call request repeatedly. */
export class JumpMotion {
  height = 0;
  velocity = 0;
  used = 0;

  request(mode: Mode): boolean {
    if (this.used >= 2) return false;
    this.used++;
    this.velocity = mode === 'pilot' ? 6.5 : 5.2;
    return true;
  }

  update(dt: number, floor = 0, ceiling = Infinity): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    floor = Number.isFinite(floor) ? Math.max(0, floor) : 0;
    ceiling = Math.max(floor, Number.isFinite(ceiling) ? ceiling : Infinity);
    if (!this.velocity && this.height === floor) return;
    // Integrate in small steps so a slow frame cannot skip a landing.
    let remaining = Math.min(dt, 1);
    while (remaining > 0) {
      const step = Math.min(remaining, 1 / 120);
      this.height += this.velocity * step - 9 * step * step;
      this.velocity -= 18 * step;
      remaining -= step;
      if (this.height > ceiling) { this.height = ceiling; this.velocity = Math.min(0, this.velocity); }
      if (this.height <= floor) { this.height = floor; this.velocity = 0; this.used = 0; break; }
    }
  }

  reset(): void { this.height = 0; this.velocity = 0; this.used = 0; }
}
