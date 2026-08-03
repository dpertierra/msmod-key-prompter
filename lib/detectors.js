/**
 * The nudge engine: tracks which shortcut fired most recently via
 * `ctx.bus.on("keybind.triggered")`, and correlates editor bus events (or,
 * for view toggles, polled state — see VIEW_TOGGLE_ACTIONS) against that to
 * tell "used the keyboard" apart from "did it with the mouse".
 *
 * `keybind.triggered` (not a raw `keydown` listener) is required here: the
 * editor's global shortcut dispatcher is mounted on `window` in the capture
 * phase before any mod loads, and calls `e.stopImmediatePropagation()` the
 * moment it resolves a keydown to an action — so a mod's own `keydown`
 * listener, on any target or phase, never sees the event for a shortcut that
 * actually fired. `keybind.triggered` fires from inside that same dispatcher,
 * before the propagation is stopped, so it's the only reliable signal.
 *
 * Neither that event nor the correlated bus event/poll identifies which
 * caused which, so a `keybind.triggered` for the same actionId within
 * KEY_WINDOW_MS before the correlated signal is treated as "the user just
 * used the shortcut" and suppresses the nudge.
 *
 * Each nudge toast carries two buttons (requires editor support for
 * `ToastOptions.action`/`secondaryAction` — additive, degrades to a plain
 * toast on older editors): "Dismiss" for a bound action, or "Assign
 * shortcut" (via `ctx.ui.openKeyboardShortcuts()`) for an unbound one; both
 * pair with a "Don't show again" that mutes the action for good.
 */

import { prettyKey } from "./combo.js";
import { saveStats, saveSettings } from "./state.js";

const KEY_WINDOW_MS = 900;
const MAP_CHANGE_WINDOW_MS = 450;
const VIEW_POLL_MS = 400;

// No bus event fires when a view toggle changes, so these are polled and
// diffed instead — same idea as the brush/zoom bus correlators below, just
// without a bus event to hang off. Keys are ctx.editor.viewOptions() fields;
// "showEvents" has no keybind (no shortcut to suggest), so it's left out.
const VIEW_TOGGLE_ACTIONS = {
  showGrid: "view.toggleGrid",
  showCollision: "view.toggleCollision",
  showEventCells: "view.toggleEventCells",
  showDim: "view.toggleDim",
};

export function createEngine(ctx, state) {
  const recentKeyActions = new Map(); // actionId -> timestamp of last "keybind.triggered"
  const lastNudgeAt = new Map(); // actionId -> timestamp of last shown toast
  const prevZoomByMap = new Map(); // mapId -> zoom
  let prevBrush = null;
  let lastMapChangeAt = 0;

  function usedKeyboardRecently(actionId) {
    const t = recentKeyActions.get(actionId);
    return t != null && Date.now() - t < KEY_WINDOW_MS;
  }

  function mute(actionId) {
    if (state.settings.mutedActions.includes(actionId)) return;
    state.settings.mutedActions = [...state.settings.mutedActions, actionId];
    saveSettings(ctx, state.settings);
  }

  /** Show (or suppress, on cooldown/mute) the nudge toast for an actionId. */
  function nudge(actionId) {
    if (!state.settings.enabled) return;
    if (state.settings.mutedActions.includes(actionId)) return;
    const kb = ctx.keybinds.get(actionId);
    if (!kb) return; // unknown action, nothing to suggest

    const now = Date.now();
    const last = lastNudgeAt.get(actionId) || 0;
    if (now - last < state.settings.cooldownMs) return;
    lastNudgeAt.set(actionId, now);

    state.stats[actionId] = (state.stats[actionId] || 0) + 1;
    saveStats(ctx, state.stats);
    const count = state.stats[actionId];

    const dontShowAgain = { label: ctx.i18n.t("Don't show again"), onClick: () => mute(actionId) };
    // kb.label is the editor's own English source label (e.g. "Undo") — t()
    // resolves it via the app's own dictionary, not this mod's.
    const label = ctx.i18n.t(kb.label);

    if (kb.key) {
      ctx.ui.showToast({
        message: ctx.i18n.t("⌨️ {label} has a keyboard shortcut: {key} (you used the mouse {count}×)", {
          label,
          key: prettyKey(kb.key),
          count,
        }),
        level: "info",
        durationMs: state.settings.toastDurationMs,
        action: { label: ctx.i18n.t("Dismiss"), onClick: () => {} },
        secondaryAction: dontShowAgain,
      });
    } else if (typeof ctx.ui.openKeyboardShortcuts === "function") {
      // No shortcut assigned yet — offer to assign one instead of a "press X" tip.
      ctx.ui.showToast({
        message: ctx.i18n.t("⌨️ {label} has no keyboard shortcut yet (you used the mouse {count}×)", { label, count }),
        level: "info",
        durationMs: state.settings.toastDurationMs,
        action: { label: ctx.i18n.t("Assign shortcut"), onClick: () => ctx.ui.openKeyboardShortcuts(actionId) },
        secondaryAction: dontShowAgain,
      });
    }
    // else: older editor without ctx.ui.openKeyboardShortcuts — nothing useful to offer, stay quiet.
  }

  /** For bus-event-driven detection: only nudge if the keyboard wasn't just used for this action. */
  function correlate(actionId) {
    if (usedKeyboardRecently(actionId)) {
      recentKeyActions.delete(actionId);
      return;
    }
    nudge(actionId);
  }

  const disposables = [];
  const addRaw = (removeFn) => disposables.push({ dispose: removeFn });

  // --- Keyboard-triggered tracker --------------------------------------------
  disposables.push(
    ctx.bus.on("keybind.triggered", (e) => {
      recentKeyActions.set(e.actionId, Date.now());
    }),
  );

  // --- View option polling ---------------------------------------------------
  let prevViewOptions = null;
  const viewPollInterval = setInterval(() => {
    const opts = ctx.editor.viewOptions();
    if (prevViewOptions) {
      for (const key in VIEW_TOGGLE_ACTIONS) {
        if (opts[key] !== prevViewOptions[key]) correlate(VIEW_TOGGLE_ACTIONS[key]);
      }
    }
    prevViewOptions = opts;
  }, VIEW_POLL_MS);
  addRaw(() => clearInterval(viewPollInterval));

  // --- Bus correlators -------------------------------------------------------
  disposables.push(ctx.bus.on("undo", () => correlate("edit.undo")));
  disposables.push(ctx.bus.on("redo", () => correlate("edit.redo")));
  disposables.push(ctx.bus.on("game.launch", () => correlate("app.runGame")));

  disposables.push(
    ctx.bus.on("tool.activated", (e) => {
      correlate(`tool.${e.toolId}`);
    }),
  );

  disposables.push(
    ctx.bus.on("layer.changed", (e) => {
      if (e.change !== "active") return;
      if (e.layerIndex < 0 || e.layerIndex > 8) return;
      correlate(`layer.select${e.layerIndex + 1}`);
    }),
  );

  disposables.push(
    ctx.bus.on("viewport.changed", (e) => {
      const prev = prevZoomByMap.get(e.mapId);
      prevZoomByMap.set(e.mapId, e.zoom);
      if (prev == null || prev === e.zoom) return;
      correlate(e.zoom > prev ? "zoom.in" : "zoom.out");
    }),
  );

  disposables.push(
    ctx.bus.on("brush.changed", (e) => {
      if (prevBrush) {
        if (e.size !== prevBrush.size) {
          correlate(e.size > prevBrush.size ? "brush.sizeUp" : "brush.sizeDown");
        }
        if (e.rotation !== prevBrush.rotation) {
          const diff = (((e.rotation - prevBrush.rotation) % 360) + 360) % 360;
          if (diff === 90) correlate("brush.rotateCW");
          else if (diff === 270) correlate("brush.rotateCCW");
        }
      }
      prevBrush = e;
    }),
  );

  disposables.push(
    ctx.bus.on("map.tile.changed", () => {
      lastMapChangeAt = Date.now();
    }),
  );
  disposables.push(
    ctx.bus.on("map.batch.changed", () => {
      lastMapChangeAt = Date.now();
    }),
  );

  disposables.push(
    ctx.bus.on("clipboard.changed", (e) => {
      if (!e.hasData) return; // ignore clears
      const isCut = Date.now() - lastMapChangeAt < MAP_CHANGE_WINDOW_MS;
      correlate(isCut ? "edit.cut" : "edit.copy");
    }),
  );

  disposables.push(ctx.bus.on("paste.before", () => correlate("edit.paste")));

  disposables.push(
    ctx.bus.on("save.after", () => {
      const saveActionIds = ["edit.save", "edit.saveAll", "edit.saveShadow"];
      const usedAny = saveActionIds.some(usedKeyboardRecently);
      if (usedAny) {
        for (const id of saveActionIds) recentKeyActions.delete(id);
        return;
      }
      nudge("edit.save");
    }),
  );

  return {
    dispose() {
      for (const d of disposables) d.dispose();
    },
    _internal: { nudge, correlate },
  };
}
