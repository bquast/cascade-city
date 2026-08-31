const keys = new Set();
const pressed = new Set(); // consumed one-shot presses

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  pressed.add(e.code);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

export const input = {
  down: (code) => keys.has(code),
  // true once per physical key press
  justPressed: (code) => {
    if (pressed.has(code)) { pressed.delete(code); return true; }
    return false;
  },
  axis: () => ({
    x: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
    y: (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0),
  }),
  endFrame: () => pressed.clear(),
};
