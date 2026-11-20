// Keyboard and mouse input for Solmar Bay. Keys are tracked as a live set
// so the game loop reads them each frame; the mouse position is kept in
// canvas coordinates for aiming.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouseX: 640,
    mouseY: 400,
    mouseDown: false,
    pressed: new Set(), // keys pressed since last frame (edge-triggered)
  };

  const keyName = (e) => e.key.length === 1 ? e.key.toLowerCase() : e.key;

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    if (!input.keys.has(k)) input.pressed.add(k);
    input.keys.add(k);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(keyName(e)));
  window.addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = ((e.clientX - r.left) / r.width) * canvas.width;
    input.mouseY = ((e.clientY - r.top) / r.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.mouseDown = true;
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });

  input.isDown = (k) => input.keys.has(k);
  input.wasPressed = (k) => input.pressed.has(k);
  input.endFrame = () => input.pressed.clear();
  return input;
}
