const KEY_MAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

export class Input {
  constructor() {
    this.pressed = new Set();

    this.onKeyDown = (event) => {
      if (!(event.code in KEY_MAP)) return;
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) return;
      event.preventDefault();
      this.pressed.add(event.code);
    };

    this.onKeyUp = (event) => {
      if (!(event.code in KEY_MAP)) return;
      event.preventDefault();
      this.pressed.delete(event.code);
    };

    this.onBlur = () => this.pressed.clear();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  getMovement() {
    const down = (direction) => [...this.pressed].some((code) => KEY_MAP[code] === direction);
    const x = Number(down('right')) - Number(down('left'));
    const y = Number(down('up')) - Number(down('down'));
    const magnitude = Math.hypot(x, y);

    return magnitude > 0
      ? { x: x / magnitude, y: y / magnitude }
      : { x: 0, y: 0 };
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
