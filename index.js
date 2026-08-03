/**
 * Key Prompter — nudges you toward keyboard shortcuts, à la JetBrains' Key Promoter X.
 *
 * Three detection layers:
 *  - Bus-event correlation (lib/detectors.js): compares editor events (undo,
 *    redo, save, copy/cut/paste, tool switches, zoom, layer/brush changes,
 *    game launch) against `ctx.bus.on("keybind.triggered")` to tell "used
 *    the shortcut" apart from "used the mouse".
 *  - View-toggle polling (lib/detectors.js): grid/collision/dim/event-cells
 *    have no bus event, so their state is polled and diffed the same way.
 *  - Best-effort DOM click matching (lib/dom-detect.js): catches whatever's
 *    left (no bus event, no observable state — e.g. DevTools) by matching
 *    the clicked control's accessible name against a keybind label.
 */

import { loadState, saveSettings } from "./lib/state.js";
import { createEngine } from "./lib/detectors.js";
import { createDomMatcher } from "./lib/dom-detect.js";
import { openStatsDialog } from "./lib/panel.js";
import { registerTranslations } from "./lib/i18n.js";

let engine = null;
let domMatcher = null;

export async function activate(ctx) {
  const state = await loadState(ctx);

  // Spanish translations for every string this mod shows. Menu item labels
  // below are left as their English source — the editor resolves them from
  // this same dictionary at render time, so no `ctx.i18n.t()` call is needed
  // for those specifically. Toasts and dialog HTML are translated explicitly.
  registerTranslations(ctx);

  engine = createEngine(ctx, state);
  domMatcher = createDomMatcher(ctx, state, engine);

  ctx.menu.registerMenuItem({
    menu: "Mods",
    label: "Key Prompter — Stats & Settings",
    icon: "keyboard",
    handler: () => openStatsDialog(ctx, state),
  });

  ctx.menu.registerMenuItem({
    menu: "Mods",
    label: "Key Prompter — Enabled",
    icon: "keyboard",
    isChecked: () => state.settings.enabled,
    handler: () => {
      state.settings.enabled = !state.settings.enabled;
      saveSettings(ctx, state.settings);
      ctx.ui.showToast({
        message: ctx.i18n.t(state.settings.enabled ? "Key Prompter enabled" : "Key Prompter disabled"),
      });
    },
  });

  ctx.log.info("Key Prompter activated");
}

export function deactivate() {
  // Menu items and bus subscriptions auto-dispose on unload — only the
  // view-option poll interval and the DOM click listener need manual
  // teardown to avoid stacking duplicates across hot reloads.
  engine?.dispose();
  domMatcher?.dispose();
  engine = null;
  domMatcher = null;
}
