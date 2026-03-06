/**
 * Miscellaneous utility functions not tied to a specific feature.
 */

/**
 * Compute the duration in years for each group-code prefix.
 * Uses the autocomplete endpoint result: GET /autocomplete/studentgroups?lang=ET
 * @param {Array<{nameEt: string, validFrom: string, validThru: string}>} groups
 * @returns {Record<string, number>}
 */
export function getAllGroupDurations(groups) {
  const durations = {};
  for (const data of groups) {
    const groupCode = data.nameEt.split('-')[0];
    const durationMs = new Date(data.validThru) - new Date(data.validFrom);
    durations[groupCode] = durationMs / (1000 * 60 * 60 * 24 * 365.25);
  }
  return durations;
}

/**
 * Wrap a method so that `after` runs after `original`, even if `original` throws.
 * @template {(...args: any[]) => any} T
 * @param {object} scope
 * @param {T} original
 * @param {T} after
 * @returns {T}
 */
export function hook(scope, original, after) {
  return function () {
    original.apply(scope, arguments);
    try {
      after.apply(scope, arguments);
    } catch (e) {
      console.error(e);
    }
  };
}

/**
 * Simulate user typing into an AngularJS-bound input by setting its value
 * and dispatching a bubbling input event so the framework picks up the change.
 * @param {HTMLInputElement} inputElement
 * @param {string} text
 */
export function simulateTyping(inputElement, text) {
  inputElement.value = text;
  inputElement.dispatchEvent(new Event('input', { bubbles: true }));
}
