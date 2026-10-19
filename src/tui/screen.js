// Thin terminal control layer: the only module in the TUI that writes to a
// real stream. Kept separate from render.js so the layout logic stays
// testable without a terminal. No input handling -- this is a spectator
// broadcast, not an interactive app.

const CLEAR_AND_HOME = '\x1b[2J\x1b[H';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

export function createScreen(stream = process.stdout) {
  return {
    draw(frame) {
      stream.write(CLEAR_AND_HOME + frame + '\n');
    },
    hideCursor() {
      stream.write(HIDE_CURSOR);
    },
    showCursor() {
      stream.write(SHOW_CURSOR);
    },
  };
}
