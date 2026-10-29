export interface MouseLookCallbacks {
  look: (dx: number, dy: number) => void;
  lockedChanged: (locked: boolean) => void;
  lockFailed: (message: string) => void;
}

/** A small browser surface also usable by input tests without a WebGL renderer. */
export interface MouseLookEnvironment {
  document: EventTarget & {
    readonly pointerLockElement: EventTarget | null;
    exitPointerLock?: () => void | Promise<void>;
  };
  window: EventTarget;
}

const FAILURE_MESSAGE = 'Mouse capture was not allowed. Use Capture Mouse to retry, or hold right mouse and drag to look.';

/** Native FPS mouse capture with a client-coordinate drag fallback for embedded browsers. */
export class MouseLook {
  private enabled = false;
  private disposed = false;
  private nativeLocked = false;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private requestSerial = 0;
  private pendingRequest: number | null = null;
  private acceptNativeLock = false;
  private readonly environment: MouseLookEnvironment;

  constructor(
    private readonly canvas: HTMLElement,
    private readonly callbacks: MouseLookCallbacks,
    environment?: MouseLookEnvironment,
  ) {
    this.environment = environment ?? { document, window };
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    this.environment.document.addEventListener('mousemove', this.onLockedMove);
    this.environment.document.addEventListener('pointerlockchange', this.onLockChange);
    this.environment.document.addEventListener('pointerlockerror', this.onLockError);
    this.environment.window.addEventListener('mousemove', this.onDragMove);
    this.environment.window.addEventListener('mouseup', this.onMouseUp);
    this.environment.window.addEventListener('blur', this.onBlur);
  }

  get locked(): boolean { return this.nativeLocked; }

  setEnabled(enabled: boolean): void {
    if (this.disposed) return;
    this.enabled = enabled;
    if (!enabled) this.release();
  }

  /** Invoke directly inside a trusted click/keyboard handler; never retries automatically. */
  requestLock(): void {
    if (this.disposed || !this.enabled || this.nativeLocked || this.pendingRequest !== null) return;
    this.clearDrag();
    const request = ++this.requestSerial;
    this.pendingRequest = request;
    this.acceptNativeLock = true;
    if (typeof this.canvas.requestPointerLock !== 'function') {
      this.fail(request);
      return;
    }
    try {
      // No raw-input options: basic capture works on the broadest browser set.
      const result = this.canvas.requestPointerLock();
      if (result && typeof result.then === 'function') {
        void Promise.resolve(result).then(() => {
          if (this.environment.document.pointerLockElement === this.canvas && (!this.enabled || this.disposed || !this.acceptNativeLock)) {
            this.exitNativeLock();
            return;
          }
          if (this.disposed || this.pendingRequest !== request) return;
          this.syncNativeLock();
          if (this.pendingRequest === request && !this.nativeLocked) this.fail(request);
        }, error => this.fail(request, error));
      }
    } catch (error) {
      this.fail(request, error);
    }
  }

  release(): void {
    this.clearDrag();
    this.pendingRequest = null;
    this.acceptNativeLock = false;
    this.requestSerial++;
    this.changeLocked(false);
    if (this.environment.document.pointerLockElement === this.canvas) this.exitNativeLock();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.enabled = false;
    this.release();
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.environment.document.removeEventListener('mousemove', this.onLockedMove);
    this.environment.document.removeEventListener('pointerlockchange', this.onLockChange);
    this.environment.document.removeEventListener('pointerlockerror', this.onLockError);
    this.environment.window.removeEventListener('mousemove', this.onDragMove);
    this.environment.window.removeEventListener('mouseup', this.onMouseUp);
    this.environment.window.removeEventListener('blur', this.onBlur);
  }

  private clearDrag(): void {
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
  }

  private changeLocked(locked: boolean): void {
    if (this.nativeLocked === locked) return;
    this.nativeLocked = locked;
    this.clearDrag();
    if (!this.disposed) this.callbacks.lockedChanged(locked);
  }

  private fail(request: number, error?: unknown): void {
    if (this.disposed || this.pendingRequest !== request) return;
    this.pendingRequest = null;
    this.acceptNativeLock = false;
    const reason = error instanceof Error ? ` (${error.name}: ${error.message.slice(0, 140)})` : '';
    if (this.enabled) this.callbacks.lockFailed(FAILURE_MESSAGE + reason);
  }

  private exitNativeLock(): void {
    try {
      const result = this.environment.document.exitPointerLock?.();
      if (result && typeof result.then === 'function') void Promise.resolve(result).catch(() => {});
    } catch { /* Escape remains available if a browser cannot release programmatically. */ }
  }

  private syncNativeLock(): void {
    const owned = this.environment.document.pointerLockElement === this.canvas;
    if (owned && (!this.enabled || this.disposed || !this.acceptNativeLock)) {
      this.exitNativeLock();
      return;
    }
    if (owned) this.pendingRequest = null;
    else if (this.nativeLocked) this.acceptNativeLock = false;
    this.changeLocked(owned);
  }

  private onLockChange = (): void => { this.syncNativeLock(); };

  private onLockError = (): void => {
    if (this.pendingRequest !== null) this.fail(this.pendingRequest);
  };

  private onContextMenu = (event: Event): void => { event.preventDefault(); };

  private onMouseDown = (event: Event): void => {
    const mouse = event as MouseEvent;
    if (!this.enabled || this.disposed || this.nativeLocked || mouse.button !== 2) return;
    if (!Number.isFinite(mouse.clientX) || !Number.isFinite(mouse.clientY)) return;
    this.dragging = true;
    this.lastX = mouse.clientX;
    this.lastY = mouse.clientY;
    event.preventDefault();
  };

  private onLockedMove = (event: Event): void => {
    if (!this.enabled || this.disposed || !this.nativeLocked) return;
    const mouse = event as MouseEvent;
    const dx = Number.isFinite(mouse.movementX) ? mouse.movementX : 0;
    const dy = Number.isFinite(mouse.movementY) ? mouse.movementY : 0;
    if (dx || dy) this.callbacks.look(dx, dy);
  };

  private onDragMove = (event: Event): void => {
    if (!this.enabled || this.disposed || this.nativeLocked || !this.dragging) return;
    const mouse = event as MouseEvent;
    if (typeof mouse.buttons === 'number' && !(mouse.buttons & 2)) { this.clearDrag(); return; }
    if (!Number.isFinite(mouse.clientX) || !Number.isFinite(mouse.clientY)) return;
    const dx = mouse.clientX - this.lastX, dy = mouse.clientY - this.lastY;
    this.lastX = mouse.clientX;
    this.lastY = mouse.clientY;
    if (dx || dy) this.callbacks.look(dx, dy);
  };

  private onMouseUp = (event: Event): void => {
    if ((event as MouseEvent).button === 2) this.clearDrag();
  };

  private onBlur = (): void => { this.release(); };
}
