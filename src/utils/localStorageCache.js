const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Creates a key/value cache backed by localStorage with per-entry TTL.
 *
 * Entry return semantics for `get()`:
 *   - `undefined`  → absent or expired  (cache miss – value should be re-fetched)
 *   - `null`       → cached negative    (previous lookup found no result)
 *   - value        → the cached value
 *
 * @param {object}   options
 * @param {string}   options.storageKey        - The localStorage key for the whole cache object.
 * @param {number}  [options.ttlMs]            - Per-entry TTL in ms (default: 30 days).
 * @param {(k: string) => string} [options.normalizeKey]
 *                                             - Key normalisation fn (default: trim).
 * @param {() => Storage | null} [options.getLocalStorage]
 *                                             - Returns the Storage instance to use.
 */
export function createLocalStorageCache({
  storageKey,
  ttlMs = DEFAULT_TTL_MS,
  normalizeKey = (k) => String(k ?? "").trim(),
  getLocalStorage = () => (typeof localStorage !== "undefined" ? localStorage : null)
} = {}) {
  if (!storageKey) throw new Error("createLocalStorageCache: storageKey is required");

  function storage() {
    return getLocalStorage();
  }

  function loadRaw() {
    const ls = storage();
    if (!ls) return {};
    try {
      const raw = ls.getItem(storageKey);
      if (!raw) return {};
      return JSON.parse(raw) ?? {};
    } catch {
      return {};
    }
  }

  function saveRaw(data) {
    const ls = storage();
    if (!ls) return;
    try {
      ls.setItem(storageKey, JSON.stringify(data));
    } catch {
      // ignore (e.g. storage quota exceeded)
    }
  }

  function isExpired(entry) {
    if (!entry || typeof entry.cachedAt !== "number") return true;
    return Date.now() - entry.cachedAt > ttlMs;
  }

  return {
    /**
     * Returns the cached value for the given key.
     * - `undefined`: not in cache or entry expired (fetch required)
     * - `null`:      cached negative (previous lookup found nothing)
     * - value:       the cached value
     */
    get(key) {
      const normalized = normalizeKey(key);
      if (!normalized) return undefined;

      const data = loadRaw();
      if (!Object.prototype.hasOwnProperty.call(data, normalized)) return undefined;

      const entry = data[normalized];
      if (isExpired(entry)) {
        delete data[normalized];
        saveRaw(data);
        return undefined;
      }

      return entry.value ?? null;
    },

    /** Stores a value (or null for a negative result) against the key. */
    set(key, value) {
      const normalized = normalizeKey(key);
      if (!normalized) return;

      const data = loadRaw();
      data[normalized] = { value: value ?? null, cachedAt: Date.now() };
      saveRaw(data);
    },

    /** Removes a single entry by key. */
    delete(key) {
      const normalized = normalizeKey(key);
      if (!normalized) return;

      const data = loadRaw();
      if (!Object.prototype.hasOwnProperty.call(data, normalized)) return;
      delete data[normalized];
      saveRaw(data);
    },

    /** Removes all entries (clears the entire localStorage key). */
    clear() {
      const ls = storage();
      if (!ls) return;
      try {
        ls.removeItem(storageKey);
      } catch {
        // ignore
      }
    },

    /** Returns the raw stored data object (useful for debugging/inspection). */
    dump() {
      return loadRaw();
    }
  };
}
