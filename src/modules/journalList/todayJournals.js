/**
 * Feature: Show today's journal links at the top of the journals list.
 *
 * Fetches this week's timetable for the current teacher and renders
 * a "Tänased tunnid" (Today's lessons) section above the journal list.
 *
 * schoolId is read from localStorage (set by the XHR interceptor on login),
 * so it works across schools without hardcoding.
 */

import { registerFeature } from '../../core/settings.js';
import { registerFeatureHandler, addAppliedMarker, isAlreadyApplied } from '../../core/observer.js';
import { TAHVEL_API_URL } from '../../core/config.js';

registerFeature({
  id: 'journalList.todayJournals',
  label: 'Tänased tunnid päevikute nimekirjas',
  description: 'Lisab päevikute nimekirja ülaosasse tänaste tundide lingid.',
  defaultEnabled: true,
});

registerFeatureHandler({
  featureId: 'journalList.todayJournals',
  match: url => url.includes('#/journals?_menu'),
  run(_url, dom) {
    const myJournals = dom.querySelector('#main-content > div:nth-of-type(2)');
    if (myJournals && !isAlreadyApplied(myJournals)) {
      const inserted = addMyJournals();
      if (inserted) addAppliedMarker(inserted);
    }
  },
});

function addMyJournals() {
  const schoolId  = JSON.parse(localStorage.getItem('schoolId') ?? 'null');
  const teacherId = JSON.parse(localStorage.getItem('currentTeacherId') ?? 'null');

  if (!teacherId || !schoolId || !document.querySelector('#main-content')) return null;

  const mainContent = document.querySelector('#main-content');
  const container = document.createElement('div');
  container.classList.add('layout-padding');

  const label = document.createElement('label');
  label.textContent = 'Tänased tunnid';
  label.classList.add('md-title-small');
  container.appendChild(label);

  const today    = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const day      = today.getDay();
  const diff     = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday   = new Date(today.setDate(diff)).toISOString().split('T')[0] + 'T00:00:00Z';
  const sunday   = new Date(today.setDate(diff + 6)).toISOString().split('T')[0] + 'T00:00:00Z';

  fetch(
    `${TAHVEL_API_URL}/timetableevents/timetableByTeacher/${schoolId}?from=${monday}&lang=ET&teachers=${teacherId}&thru=${sunday}`,
    { headers: { accept: 'application/json' } }
  )
    .then(r => r.json())
    .then(timetable => {
      const added = new Set();
      const todaysEvents = timetable.timetableEvents.filter(te => te.journalId && te.date.startsWith(todayStr));

      for (const te of todaysEvents) {
        if (added.has(te.journalId)) continue;
        added.add(te.journalId);

        const room   = te.rooms?.[0]?.roomCode ?? '';
        const groups = te.studentGroups.map(sg => sg.code).join(', ');

        const link = document.createElement('a');
        link.href = `#/journal/${te.journalId}/edit`;
        link.textContent = `${te.nameEt} ${room} ${groups}`.trim();
        link.style.cssText = 'padding-bottom:5px;display:block';
        container.appendChild(link);
      }

      if (added.size === 0) {
        const empty = document.createElement('i');
        empty.textContent = 'Tänaseid päevikuid ei leitud';
        empty.style.display = 'block';
        container.appendChild(empty);
      }
    });

  mainContent.firstChild.after(container);
  return container;
}
