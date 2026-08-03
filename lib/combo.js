/** Key-combo parsing/formatting for the toast text — turns a normalized
 *  combo string (e.g. "ctrl+shift+s", as returned by ctx.keybinds) into a
 *  display label (e.g. "Ctrl+Shift+S"). */

const MOD_PREFIXES = [
  ["ctrl+", "ctrl"],
  ["control+", "ctrl"],
  ["alt+", "alt"],
  ["shift+", "shift"],
  ["meta+", "meta"],
  ["cmd+", "meta"],
  ["command+", "meta"],
];

/** Parse a normalized combo string (e.g. "ctrl+shift+s") into flags + base key. */
export function parseCombo(str) {
  if (!str) return null;
  let rest = String(str).trim().toLowerCase();
  const mods = { ctrl: false, alt: false, shift: false, meta: false };
  let matched = true;
  while (matched) {
    matched = false;
    for (const [prefix, flag] of MOD_PREFIXES) {
      if (rest.startsWith(prefix) && rest.length > prefix.length) {
        mods[flag] = true;
        rest = rest.slice(prefix.length);
        matched = true;
      }
    }
  }
  if (!rest) return null;
  return { ...mods, key: rest };
}

const KEY_LABELS = {
  esc: "Esc",
  escape: "Esc",
  " ": "Space",
  space: "Space",
  arrowup: "Up",
  arrowdown: "Down",
  arrowleft: "Left",
  arrowright: "Right",
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  delete: "Del",
  backspace: "Backspace",
};

/** Render a normalized combo string as a display label: "ctrl+shift+s" -> "Ctrl+Shift+S". */
export function prettyKey(comboStr) {
  const parsed = parseCombo(comboStr);
  if (!parsed) return comboStr || "";
  const parts = [];
  if (parsed.ctrl) parts.push("Ctrl");
  if (parsed.alt) parts.push("Alt");
  if (parsed.shift) parts.push("Shift");
  if (parsed.meta) parts.push("Meta");
  const k = parsed.key;
  parts.push(KEY_LABELS[k] || (k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1)));
  return parts.join("+");
}
