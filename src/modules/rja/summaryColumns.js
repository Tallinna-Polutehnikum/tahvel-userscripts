/**
 * Feature: RJA summary columns — negative grade counts and percentages.
 *
 * When the class-teacher report table is loaded, restructures it to move the
 * summary columns to the left, then appends four new columns:
 *   Neg. perioodi hinded | Neg. perioodi % | Neg. lõpuhinded | Neg. lõpuhinde %
 *
 * Sub-setting: rja.oppetoetusDownload
 *   When enabled (together with rja.oppetoetus), also triggers a JSON download
 *   of the raw report data.
 *
 * See docs/rja-enhancements.md for column structure details.
 */

import { registerFeature, isFeatureEnabled } from '../../core/settings.js';
import { registerFeatureHandler, addAppliedMarker, isAlreadyApplied } from '../../core/observer.js';
import { getCurrentClassTeacherReport } from '../../core/xhrInterceptor.js';
import { addXHRInterceptor } from '../../core/xhrInterceptor.js';

registerFeature({
  id: 'rja.summaryColumns',
  label: 'RJA: negatiivsete hinnete kokkuvõte',
  description: 'Lisab rühmajuhataja aruandesse negatiivsete perioodi- ja lõpuhinnete arvu ning protsendi veerud.',
  defaultEnabled: true,
  settings: [
    {
      id: 'rja.oppetoetusDownload',
      label: 'RJA: lae aruanne alla JSON-ina',
      description: 'Laeb rühmajuhataja aruande automaatselt alla JSON-failina (vajalik õppetoetuse pingeridade jaoks).',
      defaultEnabled: false,
    },
  ],
});

// XHR: download JSON when oppetoetusDownload sub-setting is on
addXHRInterceptor(
  url => url.includes('hois_back/reports/studentgroupteacher'),
  data => {
    if (!isFeatureEnabled('rja.oppetoetusDownload')) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const fileName = document.querySelector('[aria-label="Õpperühm"]')?.value ?? 'class-teacher-report';
    a.download = `${fileName}.json`;
    a.click();
  }
);

registerFeatureHandler({
  featureId: 'rja.summaryColumns',
  match: url => url.includes('reports/studentgroupteacher'),
  run(_url, dom) {
    const table = dom.querySelector('.student-group-teacher-table');
    const isLoaded = table?.querySelector('tbody tr:first-child td:nth-child(2) span:not([class])');
    if (isLoaded && !isAlreadyApplied(table)) {
      addSummaryDataToRJA(table);
      addAppliedMarker(table);
    }
  },
});

const NEW_COLUMNS = 4;
const PERIOD_CLASSIFIER = 'R';
const FINAL_CLASSIFIER  = 'L';
const NEGATIVE_CODES    = ['MA', 'X', '1', '2'];

function addSummaryDataToRJA(table) {
  const report = getCurrentClassTeacherReport();
  if (!report) return;

  const studentGradesMap = new Map();

  report.students.forEach(student => {
    let totalFinal = 0, totalPeriod = 0, negFinal = 0, negPeriod = 0;
    student.resultColumns.forEach(col => {
      const results = col?.journalResult?.results;
      if (!results?.length) return;
      results.forEach(r => {
        const code = r.grade?.code ?? '';
        const isNeg = NEGATIVE_CODES.some(n => code.endsWith(n));
        if (r.entryType?.endsWith(PERIOD_CLASSIFIER)) {
          if (isNeg) negFinal++;
          totalFinal++;
        } else if (r.entryType?.endsWith(FINAL_CLASSIFIER)) {
          if (isNeg) negPeriod++;
          totalPeriod++;
        }
      });
    });
    studentGradesMap.set(student.fullname, { totalPeriod, negPeriod, totalFinal, negFinal });
  });

  const OFFSET = 2;
  const headerRows      = table.querySelectorAll('thead tr');
  const summaryHeader0  = headerRows[0].querySelector('th:last-child');
  const summaryHeader1  = headerRows[1].querySelector('th:last-child');
  const colspan         = parseInt(summaryHeader0.getAttribute('colspan'));
  const allHeaderCells  = headerRows[2].querySelectorAll('th');
  const lastCells       = Array.from(allHeaderCells).slice(-colspan);
  const lastCellIndex   = Array.from(allHeaderCells).indexOf(lastCells[0]);

  // Move summary columns to the left
  headerRows[0].insertBefore(summaryHeader0, headerRows[0].children[1]);
  headerRows[1].insertBefore(summaryHeader1, headerRows[1].children[1]);

  const bodyRows = table.querySelectorAll('tbody tr');
  lastCells.forEach((cell, ci) => {
    headerRows[2].insertBefore(cell, headerRows[OFFSET].children[OFFSET + ci]);
    bodyRows.forEach(row => {
      row.insertBefore(row.children[lastCellIndex + ci], row.children[OFFSET + ci]);
    });
  });

  // Append negative-grade columns to each data row
  bodyRows.forEach(row => {
    const nameEl = row.children[OFFSET - 1]?.querySelector('span:not([class]):not([ng-if])');
    const studentName = nameEl?.textContent.trim();
    if (!studentGradesMap.has(studentName)) return;

    const { totalPeriod, negPeriod, totalFinal, negFinal } = studentGradesMap.get(studentName);

    const mkCell = text => { const td = document.createElement('td'); td.textContent = text; return td; };

    const negPeriodCell       = mkCell(negPeriod);
    const negPeriodPctCell    = mkCell(((negPeriod / totalPeriod) * 100).toFixed(1) + '%');
    const negFinalCell        = mkCell(negFinal);
    const negFinalPctCell     = mkCell(((negFinal / totalFinal) * 100).toFixed(1) + '%');

    const pct = (negFinal / totalFinal) * 100;
    negFinalPctCell.style.backgroundColor =
      pct > 50 ? 'black' : pct > 30 ? '#ff3333' : pct > 10 ? 'orange' : pct > 0 ? 'yellow' : '#92D293';
    negFinalPctCell.style.color = pct > 30 ? 'white' : 'black';

    const insertAt = OFFSET + colspan;
    row.insertBefore(negFinalPctCell,  row.children[insertAt]);
    row.insertBefore(negFinalCell,     row.children[insertAt]);
    row.insertBefore(negPeriodPctCell, row.children[insertAt]);
    row.insertBefore(negPeriodCell,    row.children[insertAt]);
  });

  // Update colspans and insert header cells
  summaryHeader0.setAttribute('colspan', colspan + NEW_COLUMNS);
  summaryHeader1.setAttribute('colspan', colspan + NEW_COLUMNS);

  const insertAt = OFFSET + colspan;
  const headers = [
    'Neg. lõpuhinde %', 'Neg. lõpuhinded', 'Neg. perioodi %', 'Neg. perioodi hinded',
  ];
  headers.forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRows[2].insertBefore(th, headerRows[2].children[insertAt]);
  });
}
