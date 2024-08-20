type KeyActions = Partial<Record<string, () => void>>;

class InputManager {
  keys: Partial<Record<string, boolean>> = {};

  axis(negative: string, positive: string) {
    return Number(Boolean(this.keys[positive])) - Number(Boolean(this.keys[negative]));
  }

  init(actions: KeyActions) {
    document.addEventListener('keydown', (event) => {
      this.keys[event.code] = true;
      if (!event.repeat) actions[event.code]?.();
    });
    document.addEventListener('keyup', (event) => {
      delete this.keys[event.code];
    });
    window.addEventListener('blur', () => { this.keys = {}; });
  }
}

export const Input = new InputManager();
