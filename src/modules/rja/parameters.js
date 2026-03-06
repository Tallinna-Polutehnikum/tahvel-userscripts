/**
 * Feature: Auto-fill Rühmajuhataja aruanne (RJA) parameters when a group is selected.
 *
 * Derives the start date from the group code year, sets the entry-type checkbox
 * pattern, and optionally sets an end date for the "õppetoetus" (grant) mode.
 *
 * Sub-setting: rja.oppetoetus
 *   When enabled, also sets end date to 31 Dec of the previous year and enables
 *   additional entry-type checkboxes needed for the grant calculation.
 *   See docs/rja-enhancements.md for the full checkbox matrix.
 */

import { registerFeature, isFeatureEnabled } from '../../core/settings.js';
import { registerFeatureHandler, addAppliedMarker, isAlreadyApplied } from '../../core/observer.js';
import { simulateTyping } from '../../utils/misc.js';

registerFeature({
  id: 'rja.parameters',
  label: 'RJA: automaatsed parameetrid',
  description: 'Täidab rühmajuhataja aruandes kuupäeva ja kandete valikud automaatselt rühma koodi põhjal.',
  defaultEnabled: true,
  settings: [
    {
      id: 'rja.oppetoetus',
      label: 'RJA: õppetoetuse režiim',
      description: 'Muudab kandete valikut ja lõpukuupäeva eelmise semestri andmete jaoks (õppetoetuse arvutamiseks).',
      defaultEnabled: false,
    },
  ],
});

registerFeatureHandler({
  featureId: 'rja.parameters',
  match: url => url.includes('reports/studentgroupteacher'),
  run(_url, dom) {
    // Autocomplete input (for class teachers)
    const groupSelect = dom.querySelector(`md-autocomplete[md-floating-label="Õpperühm"] input`);
    if (groupSelect && !isAlreadyApplied(groupSelect)) {
      groupSelect.addEventListener('change', () => {
        setTimeout(() => updateRJAParameters(groupSelect.value), 200);
      });
      addAppliedMarker(groupSelect);
    }

    // Option list (for regular teachers)
    const groupSelectOptions = [...dom.querySelectorAll(`md-option[ng-value="studentGroup"]`)];
    if (groupSelectOptions.length && !isAlreadyApplied(groupSelectOptions[0])) {
      groupSelectOptions.forEach(option => {
        option.addEventListener('click', () => {
          setTimeout(() => updateRJAParameters(groupSelect?.value ?? ''), 200);
        });
      });
      addAppliedMarker(groupSelectOptions[0]);
    }
  },
});

function updateRJAParameters(group) {
  if (typeof group === 'object' && group?.nameEt) group = group.nameEt;

  const year = parseInt(group.match(/\d+/)?.[0] ?? '0') + 2000;
  const startDate = new Date(year, 7, 1); // 1 August

  const oppetoetus = isFeatureEnabled('rja.oppetoetus');

  // Entry-type checkbox states (18 checkboxes in order)
  const rjaEntryTypes = oppetoetus
    ? [1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0]
    : [1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  // Loop 4× to overcome Angular state that may not update on first click
  for (let i = 0; i < 4; i++) {
    document.querySelectorAll(`[ng-show="formState.showAllParameters"] md-checkbox`).forEach((input, index) => {
      const isChecked = input.getAttribute('aria-checked') === 'true' ? 1 : 0;
      if (isChecked ^ rjaEntryTypes[index]) input.click();
    });
  }

  const dateInput = document.querySelector(`[ng-model="criteria.from"] input`);
  if (dateInput) {
    dateInput.click();
    dateInput.value = '';
    simulateTyping(dateInput, startDate.toLocaleDateString('et', { day: '2-digit', month: '2-digit', year: 'numeric' }));
  }

  if (oppetoetus) {
    const endDate = new Date(new Date().getFullYear() - 1, 11, 31); // 31 Dec prev year
    const dateInput2 = document.querySelector(`[ng-model="criteria.thru"] input`);
    if (dateInput2) {
      dateInput2.click();
      dateInput2.value = '';
      simulateTyping(dateInput2, endDate.toLocaleDateString('et', { day: '2-digit', month: '2-digit', year: 'numeric' }));
    }
  }

  document.querySelector(`[ng-model="criteria.studyYear"]`)?.click();
  setTimeout(() => {
    document.querySelector(`.md-select-menu-container.md-active.md-clickable md-option`)?.click();
  }, 120);
}
