/**
 * Main userscript coordinator.
 * Imports all feature modules (which self-register via side effects),
 * injects global CSS, wires the page-title and grade-history handlers,
 * then starts the shared observer and generates Tampermonkey menu items.
 */

// Core infrastructure — must be imported first so XHR is patched before features run
import '../core/xhrInterceptor.js';
import { registerFeature, generateMenuItems } from '../core/settings.js';
import { registerFeatureHandler, initObserver } from '../core/observer.js';

// Feature modules — each self-registers via side-effect on import
import './journal/averageGrade.js';
import './journal/entryTooltips.js';
import './journal/batchAbsent.js';
import './journal/notifyStudent.js';
import './studentProfile/agePin.js';
import './studentProfile/negativeResults.js';
import './studentProfile/moduleLinks.js';
import './rja/parameters.js';
import './rja/summaryColumns.js';
import './journalList/todayJournals.js';
import './rooms/seatInfo.js';
import { gradeHistory } from './gradeHistory/gradeHistory.js';

if (typeof GM_log === 'function') console.log = GM_log;

// Inject global CSS rules shared across all features
const style = document.createElement('style');
style.textContent = `
  /* Hinnete dropdown oleks pikem */
  md-select-menu, md-select-menu md-content {
    max-height: 300px;
  }
  /* rühmajuhataja aruande tabelis nimed scrolliks kaasa */
  .tertiary-table student-group-teacher-table tbody td:nth-child(2) {
    position: sticky;
    left: 0;
    background: white;
    z-index: 2;
  }
`;
document.head.appendChild(style);

// Feature: update document.title from breadcrumb on every navigation
registerFeature({
  id: 'ui.pageTitle',
  label: 'Lehe pealkiri navigatsioonist',
  description: 'Uuendab brauseri vahelehe pealkirja viimase navigatsioonisamba teksti põhjal.',
  defaultEnabled: true,
});
registerFeatureHandler({
  featureId: 'ui.pageTitle',
  match: () => true,
  run() {
    const firstPath = window.location.href.match(/#\/([^\?\/]*)/)?.[1];
    let id = window.location.href.match(/\/(\d+)\//)?.[1] ?? '';
    id = id.length > 0 ? ` #${id}` : '';
    const lastBreadcrumb =
      document.querySelector('#breadcrumb-wrapper > span:last-child')?.textContent.trim() ||
      firstPath ||
      'Tahvel';
    document.title = lastBreadcrumb + id;
  },
});

// Feature: grade history chart (gradeHistory.js manages its own hashchange + auth)
registerFeature({
  id: 'gradeHistory',
  label: 'Hinnete ajaloo graafik',
  description: 'Näitab õpilase hinnete ajalugu graafikul profiililehel.',
  defaultEnabled: true,
});
registerFeatureHandler({
  featureId: 'gradeHistory',
  match: () => ['/results', '/myResults'].some(p => window.location.hash.includes(p)),
  async run() {
    if (!document.getElementById('grade-history-marker')) {
      await gradeHistory();
    }
  },
  cleanup() {
    document.getElementById('grade-history-marker')?.remove();
  },
});

// Start the shared observer and generate Tampermonkey menu from registry
generateMenuItems();
initObserver();
