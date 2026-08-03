/**
 * Spanish translations for this mod's own strings (Tier 1 i18n — see
 * docs/api-reference.md#i18n). Keys are the exact English source strings used
 * throughout the mod; `ctx.i18n.t(source, vars)` looks them up for the active
 * locale. Menu item labels aren't run through `t()` explicitly — the editor
 * resolves them from this same dictionary at render time via
 * `ModI18n.translateForMod(modId, label)`, so registering it here is enough.
 */

export const ES_TRANSLATIONS = {
  "Dismiss": "Descartar",
  "Don't show again": "No volver a mostrar",
  "Assign shortcut": "Asignar atajo",

  "⌨️ {label} has a keyboard shortcut: {key} (you used the mouse {count}×)":
    "⌨️ {label} tiene un atajo de teclado: {key} (usaste el mouse {count}×)",
  "⌨️ {label} has no keyboard shortcut yet (you used the mouse {count}×)":
    "⌨️ {label} todavía no tiene atajo de teclado (usaste el mouse {count}×)",

  "Key Prompter — Stats & Settings": "Key Prompter — Estadísticas y ajustes",
  "Key Prompter — Enabled": "Key Prompter — Activado",
  "Key Prompter enabled": "Key Prompter activado",
  "Key Prompter disabled": "Key Prompter desactivado",

  "Shows a tip when you use the mouse for something that already has a keyboard shortcut — or an \"Assign shortcut\" prompt when it doesn't have one yet.":
    "Muestra un aviso cuando usás el mouse para algo que ya tiene un atajo de teclado — o te ofrece \"Asignar atajo\" cuando todavía no tiene uno.",
  "Enabled": "Activado",
  "Detect toolbar/menu clicks (best effort)": "Detectar clics en toolbar/menú (best effort)",
  "Reminder cooldown per action": "Tiempo de espera entre avisos por acción",
  "Action": "Acción",
  "Shortcut": "Atajo",
  "Missed": "Perdidas",
  "Mute": "Silenciar",
  "— (unassigned)": "— (sin asignar)",
  "Nothing tracked yet — keep mapping.": "Todavía no hay datos — seguí mapeando.",
  "Reset stats": "Reiniciar estadísticas",
};

export function registerTranslations(ctx) {
  return ctx.i18n.addTranslations("es", ES_TRANSLATIONS);
}
