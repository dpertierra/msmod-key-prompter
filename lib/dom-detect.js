/**
 * Best-effort click matcher: catches mouse actions that never reach the
 * event bus (toolbar toggles, native menu items without a bus event, …) by
 * matching the clicked control's accessible name against a keybind label.
 *
 * This is inherently approximate — it depends on the editor's own DOM
 * (aria-label/title/text) lining up with the keybind label text, which isn't
 * a documented contract. Kept deliberately conservative (interactive
 * elements only, near-exact label match) to minimize false positives, and
 * fully disposable via the "Detect toolbar/menu clicks" setting.
 */

function normalizeLabel(s) {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/[.…]+$/g, "") // trailing "..." / "…"
    .replace(/\([^)]*\)/g, "") // strip parenthetical shortcut hints, e.g. "Save (Ctrl+S)"
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function accessibleName(el) {
  return el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "";
}

const INTERACTIVE_SELECTOR = 'button, [role="menuitem"], [role="button"], a';

export function createDomMatcher(ctx, state, engine) {
  let labelIndex = new Map();

  function rebuildIndex() {
    const next = new Map();
    for (const kb of ctx.keybinds.list()) {
      if (!kb.key) continue;
      const norm = normalizeLabel(kb.label);
      if (norm) next.set(norm, kb.actionId);
    }
    labelIndex = next;
  }
  rebuildIndex();
  const kbSub = ctx.keybinds.onChanged(() => rebuildIndex());

  function onClick(e) {
    if (!state.settings.domMatching || !state.settings.enabled) return;
    let el = e.target;
    let depth = 0;
    while (el && el.nodeType === 1 && depth < 6) {
      if (typeof el.matches === "function" && el.matches(INTERACTIVE_SELECTOR)) {
        const norm = normalizeLabel(accessibleName(el));
        const actionId = labelIndex.get(norm);
        if (actionId) {
          engine._internal.nudge(actionId);
          return;
        }
      }
      el = el.parentElement;
      depth++;
    }
  }
  document.addEventListener("click", onClick, true);

  return {
    dispose() {
      document.removeEventListener("click", onClick, true);
      kbSub.dispose();
    },
  };
}
