/**
 * Feature: Batch-mark all students absent (or present) in a single click.
 *
 * Appends a "| Märgi kõik puudujaks" toggle link next to the existing
 * "Hinde korraga" batch-grade button in the journal edit popup.
 */

import { registerFeature } from '../../core/settings.js';
import { registerFeatureHandler, addAppliedMarker, isAlreadyApplied } from '../../core/observer.js';

registerFeature({
  id: 'journal.batchAbsent',
  label: 'Kõik puudujaks korraga',
  description: 'Lisab päeviku kande popupile nupu, mis märgib kõik õpilased korraga puudujaks või kohalviibijateks.',
  defaultEnabled: true,
});

registerFeatureHandler({
  featureId: 'journal.batchAbsent',
  match: url => url.includes('journal'),
  run() {
    const batchGrade = document.querySelector('.mass-grade');
    if (batchGrade && batchGrade.textContent.includes('Hinde korraga') && !isAlreadyApplied(batchGrade)) {
      journalEntryBatchAbsent(batchGrade);
      addAppliedMarker(batchGrade);
    }
  },
});

function journalEntryBatchAbsent(siblingContainer) {
  const link = document.createElement('a');
  link.href = '#';
  link.textContent = ' | Märgi kõik puudujaks';
  link.style.cssText = 'color:blue;cursor:pointer';

  link.addEventListener('click', event => {
    event.preventDefault();
    let checkboxes = [...document.querySelectorAll('checkbox[formcontrolname="absenceWithoutReason"] button')];
    const allChecked = checkboxes.every(btn => btn.matches(':has(div.checked)'));

    checkboxes.forEach(btn => {
      if (allChecked) {
        if (btn.matches(':has(div.checked)')) btn.click();
      } else {
        if (!btn.matches(':has(div.checked)')) btn.click();
      }
    });

    // Re-query because some checkboxes may be removed when students are excused
    checkboxes = [...document.querySelectorAll('checkbox[formcontrolname="absenceWithoutReason"] button')];
    const nowAllChecked = checkboxes.every(btn => btn.matches(':has(div.checked)'));
    link.textContent = nowAllChecked ? ' | Märgi kõik kohalolijaks' : ' | Märgi kõik puudujaks';
  });

  siblingContainer.appendChild(link);
}
