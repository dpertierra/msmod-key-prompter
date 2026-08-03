import { prettyKey } from "./combo.js";
import { saveSettings, saveStats } from "./state.js";

// Curated set of built-in actions we actually correlate — kept in sync with detectors.js.
const TRACKED_ACTIONS = [
  "edit.undo",
  "edit.redo",
  "edit.save",
  "edit.saveAll",
  "edit.saveShadow",
  "edit.copy",
  "edit.cut",
  "edit.paste",
  "edit.selectAll",
  "edit.deselect",
  "tool.brush",
  "tool.eraser",
  "tool.fill",
  "tool.rectangle",
  "tool.eyedropper",
  "tool.select",
  "tool.pan",
  "view.toggleGrid",
  "view.toggleCollision",
  "view.toggleEventCells",
  "view.toggleDim",
  "brush.sizeUp",
  "brush.sizeDown",
  "brush.rotateCW",
  "brush.rotateCCW",
  "zoom.in",
  "zoom.out",
  "layer.select1",
  "layer.select2",
  "layer.select3",
  "layer.select4",
  "layer.select5",
  "layer.select6",
  "layer.select7",
  "layer.select8",
  "layer.select9",
  "app.runGame",
  "dev.toggleDevTools",
];

// A dockable ctx.ui.registerPanel() doesn't close on Escape — only the app's
// DialogShell-based windows do (Mod Manager, Stats, etc.), and mod panels
// aren't wired into that mechanism. ctx.ui.showCustomDialog() renders through
// that same DialogShell shell, so Escape/X/backdrop-click all close it for
// free, with a draggable header and consistent styling to match.
export function openStatsDialog(ctx, state) {
  ctx.ui.showCustomDialog({
    title: ctx.i18n.t("Key Prompter — Stats & Settings"),
    width: "640px",
    height: "480px",
    render(body) {
      let disposed = false;

      function draw() {
        if (disposed) return;
        body.innerHTML = buildHtml(ctx, state);
        wireEvents(body, ctx, state, draw);
      }
      draw();
      const interval = setInterval(draw, 4000);
      const localeSub = ctx.i18n.onChanged(draw);

      return () => {
        disposed = true;
        clearInterval(interval);
        localeSub.dispose();
      };
    },
  });
}

function buildHtml(ctx, state) {
  const rows = TRACKED_ACTIONS.map((id) => {
    const kb = ctx.keybinds.get(id);
    if (!kb) return null;
    return { id, kb, count: state.stats[id] || 0, muted: state.settings.mutedActions.includes(id) };
  })
    .filter(Boolean)
    .sort((a, b) => b.count - a.count);

  const rowsHtml = rows
    .map(
      (r) => `
    <tr style="border-top:1px solid var(--border);">
      <td style="padding:4px 6px;">${escapeHtml(ctx.i18n.t(r.kb.label))}</td>
      <td style="padding:4px 6px; font-family:monospace; color:var(--text-secondary);">${r.kb.key ? escapeHtml(prettyKey(r.kb.key)) : escapeHtml(ctx.i18n.t("— (unassigned)"))}</td>
      <td style="padding:4px 6px; text-align:right;">${r.count}</td>
      <td style="padding:4px 6px; text-align:center;"><input type="checkbox" data-mute="${r.id}" ${r.muted ? "checked" : ""}/></td>
    </tr>`,
    )
    .join("");

  return `
    <div style="padding:10px; font-family:inherit; font-size:13px; color:var(--text-primary);">
      <p style="margin:0 0 10px; color:var(--text-secondary);">
        ${escapeHtml(ctx.i18n.t(
          "Shows a tip when you use the mouse for something that already has a keyboard shortcut — or an \"Assign shortcut\" prompt when it doesn't have one yet.",
        ))}
      </p>
      <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">
        <label style="display:flex; align-items:center; gap:6px;">
          <input type="checkbox" id="kp-enabled" ${state.settings.enabled ? "checked" : ""}/> ${escapeHtml(ctx.i18n.t("Enabled"))}
        </label>
        <label style="display:flex; align-items:center; gap:6px;">
          <input type="checkbox" id="kp-dom" ${state.settings.domMatching ? "checked" : ""}/> ${escapeHtml(ctx.i18n.t("Detect toolbar/menu clicks (best effort)"))}
        </label>
        <label style="display:flex; align-items:center; gap:6px;">
          ${escapeHtml(ctx.i18n.t("Reminder cooldown per action"))}
          <input type="number" id="kp-cooldown" min="5" max="600" value="${Math.round(state.settings.cooldownMs / 1000)}"
            style="width:60px; background:var(--input-bg); color:var(--text-primary); border:1px solid var(--border); border-radius:4px; padding:2px 4px;"/>
          s
        </label>
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="text-align:left; color:var(--text-tertiary); text-transform:uppercase; font-size:11px;">
            <th style="padding:4px 6px;">${escapeHtml(ctx.i18n.t("Action"))}</th>
            <th style="padding:4px 6px;">${escapeHtml(ctx.i18n.t("Shortcut"))}</th>
            <th style="padding:4px 6px; text-align:right;">${escapeHtml(ctx.i18n.t("Missed"))}</th>
            <th style="padding:4px 6px; text-align:center;">${escapeHtml(ctx.i18n.t("Mute"))}</th>
          </tr>
        </thead>
        <tbody>${rowsHtml || `<tr><td colspan="4" style="padding:8px; color:var(--text-tertiary);">${escapeHtml(ctx.i18n.t("Nothing tracked yet — keep mapping."))}</td></tr>`}</tbody>
      </table>
      <button id="kp-reset" style="margin-top:10px; padding:4px 10px; border-radius:4px; cursor:pointer; border:1px solid var(--border); background:transparent; color:var(--text-secondary);">${escapeHtml(ctx.i18n.t("Reset stats"))}</button>
    </div>`;
}

function wireEvents(host, ctx, state, rerender) {
  host.querySelector("#kp-enabled")?.addEventListener("change", (e) => {
    state.settings.enabled = e.target.checked;
    saveSettings(ctx, state.settings);
  });
  host.querySelector("#kp-dom")?.addEventListener("change", (e) => {
    state.settings.domMatching = e.target.checked;
    saveSettings(ctx, state.settings);
  });
  host.querySelector("#kp-cooldown")?.addEventListener("change", (e) => {
    const seconds = Math.max(5, Math.min(600, Number(e.target.value) || 30));
    state.settings.cooldownMs = seconds * 1000;
    saveSettings(ctx, state.settings);
  });
  host.querySelectorAll("[data-mute]").forEach((el) => {
    el.addEventListener("change", (e) => {
      const id = e.target.getAttribute("data-mute");
      const set = new Set(state.settings.mutedActions);
      if (e.target.checked) set.add(id);
      else set.delete(id);
      state.settings.mutedActions = [...set];
      saveSettings(ctx, state.settings);
    });
  });
  host.querySelector("#kp-reset")?.addEventListener("click", () => {
    for (const k of Object.keys(state.stats)) delete state.stats[k];
    saveStats(ctx, state.stats);
    rerender();
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
