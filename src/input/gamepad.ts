/** Browser-independent standard gamepad mapping. Axes retain native Y: up is -1. */
export type GamepadAction =
  | 'jump' | 'reload' | 'interact' | 'switchMode' | 'ability' | 'heal'
  | 'inventory' | 'pause' | 'back' | 'confirm' | 'nextEncounter' | 'lootJunk'
  | 'up' | 'down' | 'left' | 'right';

export interface GamepadLike {
  readonly id: string;
  readonly index?: number;
  readonly connected: boolean;
  readonly mapping: string;
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed?: boolean; readonly value?: number }[];
}

export interface GamepadFrame {
  connected: boolean;
  label: string;
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  fire: boolean;
  aim: boolean;
  sprint: boolean;
  pressed: Set<GamepadAction>;
}

const DEADZONE = 0.16;
const MENU_THRESHOLD = 0.55;
const TRIGGER_THRESHOLD = 0.5;

export function neutralGamepadFrame(label = ''): GamepadFrame {
  return {
    connected: false, label,
    moveX: 0, moveY: 0, lookX: 0, lookY: 0,
    fire: false, aim: false, sprint: false, pressed: new Set(),
  };
}

function axis(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

/** Circular deadzone avoids faster diagonal movement and smoothly remaps to full scale. */
function stick(xValue: number | undefined, yValue: number | undefined): [number, number] {
  const x = axis(xValue), y = axis(yValue);
  const length = Math.hypot(x, y);
  if (length <= DEADZONE) return [0, 0];
  const magnitude = (Math.min(1, length) - DEADZONE) / (1 - DEADZONE);
  return [x / length * magnitude, y / length * magnitude];
}

function held(pad: GamepadLike, index: number): boolean {
  const button = pad.buttons[index];
  return button?.pressed === true || (typeof button?.value === 'number' && button.value >= 0.5);
}

function trigger(pad: GamepadLike, index: number): boolean {
  const button = pad.buttons[index];
  if (typeof button?.value === 'number' && Number.isFinite(button.value)) return button.value >= TRIGGER_THRESHOLD;
  return button?.pressed === true;
}

export class GamepadInput {
  private previous = new Set<GamepadAction>();
  private selected = '';

  clear(): void {
    this.previous.clear();
    this.selected = '';
  }

  poll(gamepads: readonly (GamepadLike | null | undefined)[]): GamepadFrame {
    const padIndex = gamepads.findIndex(pad => pad?.connected && pad.mapping === 'standard');
    const pad = gamepads[padIndex];
    if (!pad) {
      this.clear();
      const unsupported = gamepads.find(candidate => candidate?.connected);
      return neutralGamepadFrame(unsupported ? `${unsupported.id} · standard mapping required` : '');
    }

    const identity = `${pad.index ?? padIndex}:${pad.id}`;
    if (identity !== this.selected) {
      this.previous.clear();
      this.selected = identity;
    }
    const [moveX, moveY] = stick(pad.axes[0], pad.axes[1]);
    const [lookX, lookY] = stick(pad.axes[2], pad.axes[3]);
    const active = new Set<GamepadAction>();
    const bind = (index: number, ...actions: GamepadAction[]) => {
      if (held(pad, index)) actions.forEach(action => active.add(action));
    };
    bind(0, 'jump', 'confirm');
    bind(1, 'back', 'heal');
    bind(2, 'reload');
    bind(3, 'interact');
    bind(4, 'switchMode');
    bind(5, 'ability');
    bind(8, 'inventory');
    bind(9, 'pause');
    bind(12, 'up', 'nextEncounter');
    bind(13, 'down', 'lootJunk');
    bind(14, 'left');
    bind(15, 'right');
    if (moveY < -MENU_THRESHOLD) active.add('up');
    if (moveY > MENU_THRESHOLD) active.add('down');
    if (moveX < -MENU_THRESHOLD) active.add('left');
    if (moveX > MENU_THRESHOLD) active.add('right');
    const pressed = new Set([...active].filter(action => !this.previous.has(action)));
    this.previous = active;

    return {
      connected: true, label: pad.id,
      moveX, moveY, lookX, lookY,
      fire: trigger(pad, 7), aim: trigger(pad, 6), sprint: held(pad, 10), pressed,
    };
  }
}
