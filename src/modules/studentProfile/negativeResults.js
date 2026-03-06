/**
 * Feature: Negative-result tools on the "Sooritamise järjekorras" tab in the student profile.
 *
 * Adds three buttons above the table:
 *  1. Toggle to show only negative final grades
 *  2. Toggle to hide non-essential columns
 *  3. Button to inject journal links from vocationalConnectedEntities
 *
 * Also shows a counter: "Negatiivseid lõpptulemusi: N (~X%)".
 */

import { registerFeature } from '../../core/settings.js';
import { registerFeatureHandler, addAppliedMarker, isAlreadyApplied } from '../../core/observer.js';
import { TAHVEL_API_URL } from '../../core/config.js';

registerFeature({
  id: 'studentProfile.negativeResults',
  label: 'Negatiivsete tulemuste tööriistad',
  description: 'Lisab "Sooritamise järjekorras" vahekaardile filtrid, peidab veerge ja näitab negatiivsete hinnete arvu.',
  defaultEnabled: true,
});

registerFeatureHandler({
  featureId: 'studentProfile.negativeResults',
  match: url => /students\/.*\/results/.test(url),
  run(url, dom) {
    const studentId = url.match(/students\/(\d+)/)?.[1];
    if (!dom.querySelector(`.md-active[aria-label='Sooritamise järjekorras']`)) return;

    const table = dom.querySelector(`[ng-show="resultsCurrentNavItem === 'student.inOrderOfPassing'"]`);
    const tableRows = table?.querySelectorAll('tbody tr');
    if (table && tableRows?.length > 5 && !isAlreadyApplied(table)) {
      negativeResultsToolsInStudentProfile(table, tableRows, studentId);
      addAppliedMarker(table);
    }
  },
});

function negativeResultsToolsInStudentProfile(table, tableRows, studentId) {
  const tableHeaders = table.querySelectorAll('thead th');
  const NEGATIVE_GRADES = ['MA', 'X', '1', '2'];
  const ALL_GRADES = [...NEGATIVE_GRADES, '3', '4', '5', 'A'];

  let negativeGrades = 0;
  let totalGrades = 0;

  tableRows.forEach(row => {
    const type  = row.querySelector('td:nth-child(2)')?.textContent.trim();
    const grade = row.querySelector('td:nth-child(3)')?.textContent.trim();
    if (ALL_GRADES.includes(grade) && type === 'Lõpptulemus') totalGrades++;
    if (NEGATIVE_GRADES.includes(grade) && type === 'Lõpptulemus') negativeGrades++;
  });

  const pct = totalGrades > 0 ? ((negativeGrades / totalGrades) * 100).toFixed(0) : 0;
  const counter = document.createElement('span');
  counter.textContent = `Negatiivseid lõpptulemusi: ${negativeGrades} (~${pct}%)`;

  // Button: toggle negative-only view
  const negToggle = document.createElement('button');
  negToggle.textContent = 'Näita neg. hindeid';
  negToggle.classList.add('md-button', 'md-raised');
  negToggle.style.marginRight = '10px';
  negToggle.dataset.active = 'false';
  negToggle.addEventListener('click', () => {
    const active = negToggle.dataset.active === 'true';
    negToggle.dataset.active = String(!active);
    negToggle.textContent = active ? 'Näita neg. hindeid' : 'Näita kõiki hindeid';
    tableRows.forEach(row => {
      const type  = row.querySelector('td:nth-child(2)')?.textContent.trim();
      const grade = row.querySelector('td:nth-child(3)')?.textContent.trim();
      row.style.display = (!active && (!NEGATIVE_GRADES.includes(grade) || type !== 'Lõpptulemus')) ? 'none' : '';
    });
  });

  // Button: hide non-essential columns
  const hideColumns = [1, 3];
  const hideToggle = document.createElement('button');
  hideToggle.textContent = 'Peida mittevajalikud veerud';
  hideToggle.classList.add('md-button', 'md-raised');
  hideToggle.style.marginRight = '10px';
  hideToggle.dataset.active = 'false';
  hideToggle.addEventListener('click', () => {
    const active = hideToggle.dataset.active === 'true';
    hideToggle.dataset.active = String(!active);
    hideToggle.textContent = active ? 'Peida mittevajalikud veerud' : 'Näita kõiki veerge';
    tableRows.forEach(row => {
      hideColumns.forEach(i => {
        row.children[i].style.display     = active ? '' : 'none';
        tableHeaders[i].style.display = active ? '' : 'none';
      });
    });
  });

  // Button: inject journal links
  const journalBtn = document.createElement('button');
  journalBtn.textContent = 'Lisa päeviku lingid';
  journalBtn.classList.add('md-button', 'md-raised');
  journalBtn.style.marginRight = '10px';
  journalBtn.addEventListener('click', () => {
    fetch(`${TAHVEL_API_URL}/students/${studentId}/vocationalConnectedEntities`, {
      headers: { accept: 'application/json' },
    })
      .then(r => r.json())
      .then(data => {
        tableRows.forEach(row => {
          const subject = row.querySelector('td:nth-child(1)')?.textContent.trim().toLowerCase();
          data
            .filter(e => e.type === 'journal' && subject?.startsWith(e.nameEt.toLowerCase()))
            .forEach(e => {
              const btn = document.createElement('button');
              btn.textContent = 'Päevik';
              btn.addEventListener('click', () => window.open(`#/journal/${e.entityId}/edit`, '_blank'));
              row.querySelector('td:nth-child(1)')?.appendChild(btn);
            });
        });
        journalBtn.disabled = true;
      });
  });

  table.parentElement.insertBefore(counter,    table);
  table.parentElement.insertBefore(journalBtn, table);
  table.parentElement.insertBefore(hideToggle, table);
  table.parentElement.insertBefore(negToggle,  table);
}
