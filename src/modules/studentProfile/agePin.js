/**
 * Feature: Show student age next to their personal ID code (isikukood) in the student list.
 *
 * Computes age from the Estonian national ID (format SYYMMDDNNNC) and appends
 * it in parentheses. Ages under 18 are shown in bold.
 */

import { registerFeature } from '../../core/settings.js';
import { registerFeatureHandler, addAppliedMarker, isAlreadyApplied } from '../../core/observer.js';

registerFeature({
  id: 'studentProfile.agePin',
  label: 'Õpilase vanus isikukoodi kõrval',
  description: 'Arvutab isikukoodist vanuse ja kuvab selle õpilaste nimekirjas isikukoodi järel.',
  defaultEnabled: true,
});

registerFeatureHandler({
  featureId: 'studentProfile.agePin',
  match: url => url.includes('students'),
  run(_url, dom) {
    const table = dom.querySelector('.md-table');
    const marker = dom.querySelector('.md-table tbody > tr > td:nth-child(1)');
    if (table && !isAlreadyApplied(marker)) {
      appendAgeToPin(dom);
      addAppliedMarker(marker);
    }
  },
});

/**
 * Parse an Estonian national ID and return the person's age in integer years.
 * Century digit: 3/4 → 1900s, 5/6 → 2000s.
 * @param {string} pin
 * @returns {number}
 */
function calculateAgeFromPin(pin) {
  const century = parseInt(pin.substring(0, 1));
  const year    = parseInt(pin.substring(1, 3));
  const month   = parseInt(pin.substring(3, 5));
  const day     = parseInt(pin.substring(5, 7));

  const baseYear  = (century === 3 || century === 4) ? 1900 : 2000;
  const birthDate = new Date(baseYear + year, month - 1, day);
  const ageMs     = Date.now() - birthDate.getTime();
  return Math.abs(new Date(ageMs).getUTCFullYear() - 1970);
}

function appendAgeToPin(dom) {
  const columnHeader = dom.querySelector("[md-order-by='person.idcode']");
  if (!columnHeader) return;

  const columnNumber = Array.from(columnHeader.parentElement.children).indexOf(columnHeader);
  const cells = Array.from(
    columnHeader.parentElement.parentElement.parentElement.querySelectorAll(
      `tbody > tr > td:nth-child(${columnNumber + 1})`
    )
  );

  for (const cell of cells) {
    const pin = cell.textContent.trim();
    const age = calculateAgeFromPin(pin);
    cell.innerHTML = `${pin} <span style="font-weight:${age < 18 ? 'bold' : 'normal'}">(${age})</span>`;
  }
}
