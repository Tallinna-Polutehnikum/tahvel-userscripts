/**
 * Feature: Auto-toggle the "isTest" checkbox when a homework description is filled.
 *
 * When opened in the journal entry edit popup, this feature automatically checks
 * or unchecks the isTest checkbox based on whether a homework description is present,
 * and reacts to entry-type changes (SISSEKANNE_H always implies isTest).
 */

import { registerFeature } from '../../core/settings.js';
import { registerFeatureHandler, addAppliedMarker, isAlreadyApplied } from '../../core/observer.js';

registerFeature({
  id: 'journal.notifyStudent',
  label: 'Kodutöö teavituse automaatika',
  description: 'Märgib isTest kasti automaatselt kui kodutöö kirjeldus on täidetud.',
  defaultEnabled: true,
});

registerFeatureHandler({
  featureId: 'journal.notifyStudent',
  match: url => url.includes('journal'),
  run() {
    const homeworkDesc = document.querySelector("[ng-model='journalEntry.homework']");
    if (homeworkDesc && !isAlreadyApplied(homeworkDesc)) {
      journalEntryNotifyStudent(homeworkDesc);
    }
  },
});

function journalEntryNotifyStudent(homeworkDesc) {
  const isTestCheckbox = document.querySelector("[ng-model='journalEntry.isTest']");

  homeworkDesc.addEventListener('input', () => {
    const hasHomework = homeworkDesc.value.trim().length > 0;
    if (isTestCheckbox.getAttribute('aria-checked') === (hasHomework ? 'false' : 'true')) {
      isTestCheckbox.click();
    }
  });

  addAppliedMarker(homeworkDesc);

  const entryTypeOptions = document.querySelectorAll(`[value^="SISSEKANNE_"]`);
  entryTypeOptions.forEach(option => {
    option.addEventListener('click', () => {
      const hasHomework = homeworkDesc.value.trim().length > 0;
      const shouldBeChecked = option.value === 'SISSEKANNE_H' || hasHomework;
      if (isTestCheckbox.getAttribute('aria-checked') === (shouldBeChecked ? 'false' : 'true')) {
        isTestCheckbox.click();
      }
    });
  });
}
