/** Settings + stats persistence (per-mod storage, no permission required). */

const SETTINGS_KEY = "settings";
const STATS_KEY = "stats";

export const DEFAULT_SETTINGS = {
  enabled: true,
  domMatching: true,
  cooldownMs: 30000,
  toastDurationMs: 4000,
  // Muted by default: scroll-wheel zoom is a normal mouse workflow, not a "missed shortcut".
  mutedActions: ["zoom.in", "zoom.out"],
};

export async function loadState(ctx) {
  const settings = await ctx.storage.get(SETTINGS_KEY, DEFAULT_SETTINGS);
  const stats = await ctx.storage.get(STATS_KEY, {});
  return {
    settings: { ...DEFAULT_SETTINGS, ...settings },
    stats: { ...stats },
  };
}

export function saveSettings(ctx, settings) {
  ctx.storage.set(SETTINGS_KEY, settings).catch((err) => ctx.log.warn("key-prompter: failed to save settings", err));
}

export function saveStats(ctx, stats) {
  ctx.storage.set(STATS_KEY, stats).catch((err) => ctx.log.warn("key-prompter: failed to save stats", err));
}
