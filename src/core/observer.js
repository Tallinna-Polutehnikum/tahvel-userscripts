/**
 * Shared MutationObserver infrastructure.
 *
 * Feature modules call registerFeatureHandler({ featureId, match, run, cleanup? })
 * at import time. On every Angular DOM mutation the observer iterates all handlers,
 * skips disabled features, calls match(), and then run() or cleanup().
 *
 * The disconnect-callback-reconnect pattern prevents the userscript's own DOM writes
 * from re-triggering the observer.
 */

import { isFeatureEnabled } from './settings.js';

/**
 * @typedef {Object} FeatureHandler
 * @property {string} featureId
 * @property {function(url: string, dom: Document): boolean} match
 * @property {function(url: string, dom: Document): void | Promise<void>} run
 * @property {function(url: string, dom: Document): void} [cleanup]
 */

/** @type {FeatureHandler[]} */
const handlers = [];

/**
 * Register a handler that will be evaluated on every Angular route/DOM change.
 * The featureId is looked up in the settings registry to determine if it's enabled.
 * @param {FeatureHandler} handler
 */
export function registerFeatureHandler(handler) {
  handlers.push(handler);
}

/**
 * Mark a DOM element as already processed so re-renders don't apply changes twice.
 * @param {Element|null} element
 */
export function addAppliedMarker(element) {
  if (!element) return;
  element.dataset.userscriptApplied = 'true';
}

/**
 * Check whether a DOM element has already been processed by this userscript.
 * @param {Element|null} element
 * @returns {boolean}
 */
export function isAlreadyApplied(element) {
  if (!element) return false;
  return element.dataset.userscriptApplied === 'true';
}

/**
 * Create a MutationObserver that fires a callback on Angular-driven childList changes.
 * Disconnects before calling the callback (prevents re-entrance) then resumes.
 * Returns the observer so callers can stop it if needed.
 * @param {Node} targetNode
 * @param {function(): void} callback
 * @returns {MutationObserver}
 */
export function observeTargetChange(targetNode, callback) {
  const observer = new MutationObserver((mutationsList, obs) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        obs.disconnect();
        callback();
        obs.observe(targetNode, { childList: true, subtree: true });
        return;
      }
    }
  });
  observer.observe(targetNode, { childList: true, subtree: true });
  return observer;
}

/**
 * Start the main observer on document.body.
 * Must be called once after all feature handlers have been registered.
 */
export function initObserver() {
  observeTargetChange(document.body, async () => {
    const url = window.location.href;
    const dom = document;

    for (const handler of handlers) {
      if (!isFeatureEnabled(handler.featureId)) {
        handler.cleanup?.(url, dom);
        continue;
      }

      if (handler.match(url, dom)) {
        await handler.run(url, dom);
      } else {
        handler.cleanup?.(url, dom);
      }
    }
  });
}
