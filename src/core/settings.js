/**
 * Feature registry and settings system.
 *
 * Each feature module calls registerFeature({ id, label, description, defaultEnabled, settings? })
 * at import time. The settings array holds sub-settings (e.g. oppetoetus mode inside RJA).
 *
 * isFeatureEnabled(id) is the single source of truth consumed by the observer.
 * generateMenuItems() should be called once at startup; it creates one Tampermonkey menu
 * entry per feature (and per sub-setting) auto-generated from the registry.
 */

const STORAGE_PREFIX = 'tahvelUserscripts.features.';

/** @type {Array<FeatureDescriptor>} */
const registry = [];

/**
 * @typedef {Object} SubSetting
 * @property {string} id
 * @property {string} label
 * @property {string} [description]
 * @property {boolean} defaultEnabled
 */

/**
 * @typedef {Object} FeatureDescriptor
 * @property {string} id
 * @property {string} label
 * @property {string} [description]
 * @property {string} [screenshotUrl]
 * @property {boolean} defaultEnabled
 * @property {SubSetting[]} [settings]
 */

/**
 * Register a feature (or sub-setting) descriptor. Call this at module load time.
 * @param {FeatureDescriptor} descriptor
 */
export function registerFeature(descriptor) {
  registry.push(descriptor);
}

/**
 * Check whether a feature or sub-setting is enabled.
 * Reads from localStorage, falling back to defaultEnabled in the registry.
 * @param {string} id
 * @returns {boolean}
 */
export function isFeatureEnabled(id) {
  const stored = localStorage.getItem(STORAGE_PREFIX + id);
  if (stored !== null) return stored === 'true';

  // Search top-level features, then sub-settings
  const topLevel = registry.find(f => f.id === id);
  if (topLevel) return topLevel.defaultEnabled;

  for (const feature of registry) {
    const sub = (feature.settings ?? []).find(s => s.id === id);
    if (sub) return sub.defaultEnabled;
  }

  return true; // Unknown id: default to enabled
}

/**
 * Generate one Tampermonkey menu entry per feature and per sub-setting.
 * Should be called once after all feature modules have been imported.
 * Each entry toggles the feature on/off and alerts the user to reload.
 */
export function generateMenuItems() {
  if (typeof GM_registerMenuCommand !== 'function') return;

  for (const feature of registry) {
    const enabled = isFeatureEnabled(feature.id);

    GM_registerMenuCommand(
      `${enabled ? '✓' : '✗'} ${feature.label}`,
      () => {
        localStorage.setItem(STORAGE_PREFIX + feature.id, String(!enabled));
        alert(`"${feature.label}" ${!enabled ? 'lubatud' : 'keelatud'}. Laadi leht uuesti.`);
      }
    );

    for (const sub of feature.settings ?? []) {
      const subEnabled = isFeatureEnabled(sub.id);

      GM_registerMenuCommand(
        `\u00a0\u00a0${subEnabled ? '✓' : '✗'} ${sub.label}`,
        () => {
          localStorage.setItem(STORAGE_PREFIX + sub.id, String(!subEnabled));
          alert(`"${sub.label}" ${!subEnabled ? 'lubatud' : 'keelatud'}. Laadi leht uuesti.`);
        }
      );
    }
  }
}

/** Expose the registry read-only for debugging. */
export function getRegistry() {
  return [...registry];
}
