/**
 * Feature: Journal entry tooltips on hover.
 *
 * Fetches journal entry metadata and shows a tooltip with entry type, content,
 * and homework details when the user hovers over a date header or a grade cell.
 */

import { registerFeature } from '../../core/settings.js';
import { registerFeatureHandler } from '../../core/observer.js';
import { TAHVEL_API_URL } from '../../core/config.js';
import { SissekandedEnum } from './utils.js';

registerFeature({
  id: 'journal.entryTooltips',
  label: 'Päeviku kande kirjeldused',
  description: 'Hiirega kuupäeva peale liikumisel näitab tunni kirjeldust ja kodutöö infot.',
  defaultEnabled: true,
});

registerFeatureHandler({
  featureId: 'journal.entryTooltips',
  match: url => url.includes('journal'),
  run() {
    return journalEntryTooltips();
  },
});

async function journalEntryTooltips() {
  const journalId = window.location.href.match(/journal\/(\d+)/)?.[1];
  if (!journalId) return;

  const entryDOMs = document.querySelectorAll(`[ng-if^="journalEntry.entryType.code"]`);
  if (entryDOMs.length === 0) return;

  let table = entryDOMs[0];
  while (table.tagName !== 'TABLE') table = table.parentElement;
  const tableBody = table?.querySelector('tbody');
  const headerRow = table.querySelector('thead tr');

  const [res1, res2] = await Promise.all([
    fetch(`${TAHVEL_API_URL}/journals/${journalId}/journalEntry?lang=ET&page=0&size=100`, {
      headers: { 'accept': 'application/json, text/plain, */*', 'x-requested-with': 'XMLHttpRequest' },
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
    }),
    fetch(`${TAHVEL_API_URL}/journals/${journalId}/journalEntriesByDate?allStudents=false`, {
      headers: { 'Accept': 'application/json, text/plain, */*', 'X-Requested-With': 'XMLHttpRequest' },
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
    }),
  ]);

  const dataEntries = await res1.json();
  const journalEntries = await res2.json();

  const skipHeaders = ['Nr', 'Õppija, Õpperühm', 'Keskm.', 'Summa'];
  let domIndex = 0;

  journalEntries.forEach((dateEntry, entryIndex) => {
    domIndex++;
    let content = headerRow.children[domIndex]?.textContent;
    while (content && skipHeaders.includes(content)) {
      domIndex++;
      content = headerRow.children[domIndex]?.textContent;
    }

    const entry = dataEntries.content.find(d => d.id === dateEntry.id);
    if (!entry) return;

    const el = entryDOMs[entryIndex];
    const entryType = SissekandedEnum[entry.entryType] ?? entry.entryType;
    const typeLabel = entry.nameEt !== entryType ? `${entryType}: ${entry.nameEt}` : entryType;
    let tooltipHtml = `<b>${typeLabel}</b><br>${entry.content?.replaceAll('\n', '<br>') ?? ''}`;
    if (entry.homework) {
      const due = entry.homeworkDuedate ? new Date(entry.homeworkDuedate).toLocaleDateString('et') : '';
      tooltipHtml += `<br><br><b>Kodutöö ${due}</b><br><br>${entry.homework?.replaceAll('\n', '<br>') ?? ''}`;
    }

    const tooltip = createTooltip(tooltipHtml);

    const attachTooltip = (target, offsetY) => {
      target.addEventListener('mousemove', event => {
        tooltip.style.display = 'block';
        tooltip.style.top = event.clientY + offsetY + window.scrollY + 'px';
        tooltip.style.left = event.clientX - target.getBoundingClientRect().width / 2 + 'px';
      });
      target.addEventListener('mouseout', () => {
        if (tooltip.style.display === 'block') tooltip.style.display = 'none';
      });
    };

    attachTooltip(el, 20);

    for (let i = 0; i < tableBody.children.length; i++) {
      const cell = tableBody.children[i].children[domIndex]?.querySelector('div.layout-row > div');
      if (cell) attachTooltip(cell, 46);
    }
  });
}

function createTooltip(htmlContent) {
  const div = document.createElement('div');
  div.innerHTML = htmlContent;
  div.style.cssText =
    'display:none;position:absolute;z-index:1000;background:white;padding:5px;max-width:500px;pointer-events:none';
  document.body.appendChild(div);
  return div;
}
