const MOVEMENT_KEYS = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
};

const ARROW_KEYS = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

const CONTROL_KEYS = ['ControlLeft', 'ControlRight'];

const CONTROLLED_KEYS = new Set([
  ...Object.values(MOVEMENT_KEYS),
  ...Object.values(ARROW_KEYS),
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
    this.isFirstPerson = false;

    this.onKeyDown = (event) => {
      if (!CONTROLLED_KEYS.has(event.code)) return;

      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) return;

      // Ctrl is a toggle, not a held modifier: Ctrl+arrows can be a macOS shortcut.
      if (CONTROL_KEYS.includes(event.code)) {
        if (!event.repeat && !this.pressed.has(event.code)) {
          this.isFirstPerson = !this.isFirstPerson;
        }
        this.pressed.add(event.code);
        return;
      }

      if (event.code.startsWith('Arrow')) event.preventDefault();
      this.pressed.add(event.code);
    };

    this.onKeyUp = (event) => {
      if (!CONTROLLED_KEYS.has(event.code)) return;
      if (event.code.startsWith('Arrow')) event.preventDefault();
      this.pressed.delete(event.code);
    };

    this.onBlur = () => this.pressed.clear();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  get isCameraMode() {
    return this.pressed.has('ShiftLeft') || this.pressed.has('ShiftRight');
  }

  getMovement() {
    // In POV, arrows look around and WASD still walks. Outside POV, Shift
    // reserves arrows for orbiting the camera without blocking WASD.
    const arrowsMove = !this.isFirstPerson && !this.isCameraMode;
    const down = (direction) =>
      this.pressed.has(MOVEMENT_KEYS[direction])
      || (arrowsMove && this.pressed.has(ARROW_KEYS[direction]));

    return normalize(
      Number(down('right')) - Number(down('left')),
      Number(down('up')) - Number(down('down')),
    );
  }

  getCameraOrbit() {
    if (this.isFirstPerson || !this.isCameraMode) return { x: 0, y: 0 };
    return this.getArrowAxes();
  }

  getPOVLook() {
    if (!this.isFirstPerson) return { x: 0, y: 0 };
    return this.getArrowAxes();
  }

  getArrowAxes() {
    return normalize(
      Number(this.pressed.has('ArrowRight')) - Number(this.pressed.has('ArrowLeft')),
      Number(this.pressed.has('ArrowUp')) - Number(this.pressed.has('ArrowDown')),
    );
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
