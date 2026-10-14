const ARROW_KEYS = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

const ACTION_KEYS = {
  KeyA: 'interact', // pick up / plant
  KeyS: 'action',   // object-specific action
};
const CONTROL_KEYS = ['ControlLeft', 'ControlRight'];

const CONTROLLED_KEYS = new Set([
  ...Object.values(ARROW_KEYS),
  ...Object.keys(ACTION_KEYS),
  'ShiftLeft',
  'ShiftRight',
  ...CONTROL_KEYS,
]);

function normalize(x, y) {
  const length = Math.hypot(x, y);
  return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}

export class Input {
  constructor() {
    this.pressed = new Set();
    this.pendingActions = [];
    this.isFirstPerson = false;

    this.onKeyDown = (event) => {
      if (!CONTROLLED_KEYS.has(event.code)) return;

      const tag = event.target?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag) || event.target?.isContentEditable) return;

      // Ctrl is a toggle, not a held modifier: Ctrl+arrows can be a macOS shortcut.
      if (CONTROL_KEYS.includes(event.code)) {
        if (!event.repeat && !this.pressed.has(event.code)) {
          this.isFirstPerson = !this.isFirstPerson;
        }
        this.pressed.add(event.code);
        return;
      }

      if (event.code.startsWith('Arrow')) event.preventDefault();

      const action = ACTION_KEYS[event.code];
      if (action) {
        // Do not hijack browser shortcuts such as Cmd+A / Cmd+S / Ctrl+A.
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || this.isCameraMode) return;
        event.preventDefault();
        if (!event.repeat && !this.pressed.has(event.code)) this.pendingActions.push(action);
      }
      this.pressed.add(event.code);
    };

    this.onKeyUp = (event) => {
      if (!CONTROLLED_KEYS.has(event.code)) return;
      if (event.code.startsWith('Arrow')) event.preventDefault();
      this.pressed.delete(event.code);
    };

    this.onBlur = () => {
      this.pressed.clear();
      this.pendingActions.length = 0;
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  get isCameraMode() {
    return this.pressed.has('ShiftLeft') || this.pressed.has('ShiftRight');
  }

  getMovement() {
    // The arrow keys ALWAYS move (both POV and third-person).
    // Shift + arrows is reserved for looking around.
    if (this.isCameraMode) return { x: 0, y: 0 };
    return this.getArrowAxes();
  }

  getCameraOrbit() {
    if (this.isFirstPerson || !this.isCameraMode) return { x: 0, y: 0 };
    return this.getArrowAxes();
  }

  getPOVLook() {
    if (!this.isFirstPerson || !this.isCameraMode) return { x: 0, y: 0 };
    return this.getArrowAxes();
  }

  getArrowAxes() {
    return normalize(
      Number(this.pressed.has('ArrowRight')) - Number(this.pressed.has('ArrowLeft')),
      Number(this.pressed.has('ArrowUp')) - Number(this.pressed.has('ArrowDown')),
    );
  }

  consumeActions() {
    return this.pendingActions.splice(0);
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
