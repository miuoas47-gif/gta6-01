// Keyboard and mouse input, read fresh every frame. Keys are tracked in a
// set; one-shot actions (enter car, punch, pause, confirm) are edge-triggered
// so holding a key does not repeat them.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MISSION = 16;
export const ACTION_SHOOT = 32;

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mousePressed = false;

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (!keys.has(event.code)) pressed.add(event.code);
    keys.add(event.code);
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    if (event.button === 0) {
      mouseDown = true;
      mousePressed = true;
      onMouseMove(event);
    }
  }

  function onMouseUp(event) {
    if (event.button === 0) mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    /** WASD / arrows as movement axes. */
    axes() {
      const left = keys.has('KeyA') || keys.has('ArrowLeft');
      const right = keys.has('KeyD') || keys.has('ArrowRight');
      const up = keys.has('KeyW') || keys.has('ArrowUp');
      const down = keys.has('KeyS') || keys.has('ArrowDown');
      return {
        x: (right ? 1 : 0) - (left ? 1 : 0),
        y: (down ? 1 : 0) - (up ? 1 : 0),
        up, down, left, right,
      };
    },
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    /** One-shot actions since the last call; clears the edge queue. */
    takeActions() {
      let actions = 0;
      if (pressed.has('Enter') || pressed.has('Space')) actions |= ACTION_CONFIRM;
      if (pressed.has('KeyP') || pressed.has('Escape')) actions |= ACTION_PAUSE;
      if (pressed.has('KeyE')) actions |= ACTION_ENTER;
      if (pressed.has('KeyF')) actions |= ACTION_PUNCH;
      if (pressed.has('KeyM')) actions |= ACTION_MISSION;
      if (mousePressed) actions |= ACTION_SHOOT;
      pressed.clear();
      mousePressed = false;
      return actions;
    },
  };
}
