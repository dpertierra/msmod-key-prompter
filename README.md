# Key Prompter

A [Maker Studio](https://github.com/Toskan4134/maker-studio) mod inspired by JetBrains'
[Key Promoter X](https://plugins.jetbrains.com/plugin/9792-key-promoter-x): whenever you
perform an action with the mouse that already has a keyboard shortcut, it shows a toast
reminding you of the shortcut — and keeps a running tally of how often you reach for the mouse
instead.

> 💡 Undo: try Ctrl+Z next time (mouse used 4×)

## How it detects "you used the mouse"

The editor doesn't expose a generic "an action was invoked" event, so this mod combines three
detection layers:

1. **Bus-event correlation** (reliable). `ctx.bus.on("keybind.triggered")` records, per action,
   the last time its shortcut actually fired via the keyboard. This is the *only* reliable way
   to know that: the editor's global shortcut dispatcher runs on `window` in the capture phase
   before any mod loads and calls `e.stopImmediatePropagation()` the moment it resolves a
   keydown, so a mod's own raw `keydown` listener never sees the event for a shortcut that
   actually fired — `keybind.triggered` exists specifically so mods don't have to guess. When
   the editor emits a bus event for that same action (`undo`, `redo`, `save.after`,
   `clipboard.changed`, `paste.before`, `tool.activated`, `viewport.changed`, `brush.changed`,
   `layer.changed`, `game.launch`), the mod checks whether `keybind.triggered` fired for it in
   the last ~900ms. If not, the action was almost certainly triggered by mouse — toolbar button,
   menu item, or scroll wheel — and a nudge fires. This covers: Undo/Redo, Save, Copy/Cut/Paste,
   tool switches, zoom, brush size/rotate, layer selection (1-9), and Run Game.
2. **View-toggle polling** (reliable, no bus event needed). Grid, Collision, Dim, and Event
   Cells don't fire a bus event when toggled, so `ctx.editor.viewOptions()` is polled every
   400ms and diffed against the previous read — same idea as the bus correlators above, minus
   the bus. Whichever field changed gets checked against `keybind.triggered` exactly like any
   other action.
3. **Best-effort DOM click matching** (approximate, toggleable). Whatever's left with no bus
   event and no observable state (e.g. DevTools) falls back to matching the clicked control's
   visible text/`aria-label`/`title` against a keybind's label. This depends on the editor's
   own DOM lining up with keybind labels, which isn't a guaranteed contract — treat it as a
   bonus, not a promise. Disable it from the settings panel ("Detect toolbar/menu clicks") if
   it ever produces noise.

All three layers share one per-action cooldown (default 30s) so a spree of clicks doesn't spam
toasts, and all write to the same per-action "missed" counter.

## Using it

- **Mods → Key Prompter — Stats & Settings** opens a dialog with: a global enable toggle, the
  DOM-matching toggle, cooldown, and a per-action table (shortcut, times missed, mute checkbox).
  It's a dialog (`ctx.ui.showCustomDialog`) rather than a dockable panel specifically so it
  closes the normal way — Escape, the X, or a backdrop click — like every other window in the
  editor (Mod Manager, Stats, …). A dockable panel doesn't get that for free.
- **Mods → Key Prompter — Enabled** is a quick on/off toggle with its own keyboard shortcut slot
  in the Keyboard Shortcuts dialog (assign one if you want to silence it fast).
- Zoom in/out are muted by default — scroll-wheel zoom is a normal workflow, not a missed
  shortcut. Mute anything else that gets noisy for you the same way.
- Stats and settings persist per mod install (`ctx.storage`), independent of any project.

## What it doesn't catch

- Actions with no keyboard shortcut bound show an "Assign shortcut" nudge instead of a "Change
  key" one — muting one works the same as any other action. Both buttons open the Keyboard
  Shortcuts dialog scrolled to that action and ready to capture a new key.
- Mouse actions inside a text field are unaffected — `keybind.triggered` only fires for
  built-in shortcuts the global dispatcher actually resolves, which already excludes text entry.
- DevTools, Select All, and Deselect rely on the DOM-matching layer only (no bus event, no
  observable state to poll — Select All/Deselect are indistinguishable from a normal mouse
  drag-selection at the state level), so they're only caught when the editor's button/menu
  text matches the keybind label closely enough.

## Development

```text
lib/combo.js       — key-combo formatting, used for the toast text
lib/state.js        — settings/stats persistence (ctx.storage)
lib/detectors.js    — the nudge engine: keybind.triggered tracker + bus-event/poll correlators
lib/dom-detect.js   — best-effort click-to-label matcher
lib/i18n.js          — Spanish translations for this mod's own strings
lib/panel.js         — settings/stats dialog (showCustomDialog)
index.js             — wires it together, menu items, activate/deactivate
```

Test locally by copying this folder into `%APPDATA%\maker-studio\Mods\key-prompter` (Windows)
and reloading the mod from **Mods → Mod Manager**. See the registry's
[publishing guide](https://github.com/Toskan4134/maker-studio-mods/blob/main/docs/publishing.md)
for the full local-test / release / registry-PR flow.

## License

MIT.
