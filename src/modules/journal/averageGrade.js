/**
 * Feature: Journal average grade + sum columns + column background colours.
 *
 * Adds "Keskm." (average) and "Summa" (total score) columns before each period-grade
 * column, and a "Perioodide hinded" column before the final-grade column.
 * Also colours journal entry columns by the header background of special entry types.
 *
 * See docs/journal-average-grade.md for the column-detection algorithm.
 */

import { registerFeature } from '../../core/settings.js';
import { registerFeatureHandler, addAppliedMarker, isAlreadyApplied } from '../../core/observer.js';

registerFeature({
  id: 'journal.averageGrade',
  label: 'Päevikus keskmised hinded',
  description: 'Lisab päeviku tabelisse keskmise hinde ja summa veerud perioodi- ja lõpphinnete kõrvale.',
  defaultEnabled: true,
});

registerFeatureHandler({
  featureId: 'journal.averageGrade',
  match: url => url.includes('journal'),
  run(_url, dom) {
    const journalTableRows = dom.querySelectorAll('.tahvel-table tr');
    if (journalTableRows?.length > 2 && !isAlreadyApplied(journalTableRows[1])) {
      addAverageGradeColumn();
      columnBackgroundColors();
      addAppliedMarker(journalTableRows[1]);
    }
  },
});

// ---------------------------------------------------------------------------
// Grade colour palette (grade value → cell background)
// ---------------------------------------------------------------------------

const gradePalette = {
  5: '#b3ffb3',
  4: '#b3ffb3',
  3: '#ffffb3',
  2: '#ffb3b3',
  1: '#ffb3b3',
  0: '#ffb3b3',
};

/**
 * Calculate the average and total of a set of grade strings (e.g. ["X / 3 / 5", "2"]).
 * MA and X are treated as 0. Returns [averageString, totalNumber].
 * @param {string[]} grades
 * @returns {[string, number]}
 */
function calculateAverageGrade(grades) {
  let total = 0;
  let count = 0;

  for (const grade of grades) {
    let lastGrade = grade.trim().split('/').pop().trim();
    if (lastGrade === 'MA' || lastGrade === 'X') lastGrade = '0';
    const parsed = parseFloat(lastGrade);
    if (!isNaN(parsed)) {
      total += parsed;
      count++;
    }
  }

  return [count > 0 ? (total / count).toFixed(1) : '0.0', total];
}

function addAverageGradeColumn() {
  const observer = new MutationObserver(() => {
    const gradeTable = document.querySelector('#studentTable');
    if (!gradeTable) return;

    observer.disconnect();

    const tableHeaders = gradeTable.querySelectorAll(
      '.tahvel-table th.header-cell:not([style*="background-color: rgb(224, 231, 255)"]):not([style*="background-color: rgb(249, 168, 212)"])'
    );
    const periodGradeHeaders = gradeTable.querySelectorAll(
      '.tahvel-table th[style*="background-color: rgb(224, 231, 255)"]'
    );
    const finalGradeHeader = gradeTable.querySelector(
      '.tahvel-table th[style*="background-color: rgb(249, 168, 212)"]'
    );

    const gradeColumnIndices = Array.from(tableHeaders).map(th => th.cellIndex);
    let periodGradeColumnIndices = Array.from(periodGradeHeaders).map(th => th.cellIndex);
    let usedFinalGradeAsPeriodGrade = false;

    if (periodGradeColumnIndices.length === 0) {
      if (finalGradeHeader) {
        periodGradeColumnIndices = [finalGradeHeader.cellIndex];
      } else {
        periodGradeColumnIndices = [gradeTable.querySelectorAll('.tahvel-table thead th').length - 1];
      }
      usedFinalGradeAsPeriodGrade = true;
    }

    const rows = gradeTable.querySelectorAll('.tahvel-table tr');
    const headerRow = rows[0];

    // Remove any previously injected headers before Angular re-renders rows
    [...gradeTable.querySelectorAll('.tahvel-table th[aria-label*="Keskmine hinne"]')].forEach(h => h.remove());
    [...gradeTable.querySelectorAll('.tahvel-table th[aria-label*="Hinnete summa"]')].forEach(h => h.remove());
    [...gradeTable.querySelectorAll('.tahvel-table th[aria-label*="Perioodide hinded"]')].forEach(h => h.remove());

    for (let i = 0; i < periodGradeColumnIndices.length; i++) {
      const avgHeader = document.createElement('th');
      avgHeader.textContent = 'Keskm.';
      avgHeader.setAttribute('aria-label', 'Keskmine hinne');
      avgHeader.style.cssText = 'width:20px;padding:0 2px;background-color:#e2e4f4';
      headerRow.insertBefore(avgHeader, headerRow.children[periodGradeColumnIndices[i] + i * 2]);

      const sumHeader = document.createElement('th');
      sumHeader.textContent = 'Summa';
      sumHeader.setAttribute('aria-label', 'Hinnete summa');
      sumHeader.style.cssText = 'width:20px;padding:0 2px;background-color:#e2e4f4';
      headerRow.insertBefore(sumHeader, headerRow.children[periodGradeColumnIndices[i] + i * 2]);
    }

    if (finalGradeHeader && !usedFinalGradeAsPeriodGrade) {
      const periodGradesHeader = document.createElement('th');
      periodGradesHeader.textContent = 'Perioodide hinded';
      periodGradesHeader.setAttribute('aria-label', 'Perioodide hinded');
      periodGradesHeader.style.cssText = 'width:20px;padding:0 2px;background-color:#f7b0c8';
      headerRow.insertBefore(periodGradesHeader, finalGradeHeader);
    }

    /** @type {[HTMLTableCellElement, number][][]} */
    const totalColumnsAndScores = [];

    rows.forEach((row, rowIndex) => {
      if (rowIndex === 0) return;

      row.addEventListener('mouseover', function () {
        this.style.outline = '2px solid #000';
        this.style.outlineOffset = '-2px';
      });
      row.addEventListener('mouseout', function () {
        this.style.outline = 'unset';
      });

      /** @type {string[][]} */
      const grades = Array.from({ length: periodGradeColumnIndices.length }, () => []);
      const periodGrades = [];

      let currentPeriodIndex = 0;
      for (const columnIndex of gradeColumnIndices) {
        if (columnIndex > periodGradeColumnIndices[currentPeriodIndex]) currentPeriodIndex++;
        if (currentPeriodIndex < periodGradeColumnIndices.length) {
          const cell = row.querySelectorAll('td')[columnIndex];
          grades[currentPeriodIndex].push(cell?.textContent?.trim() ?? '');
        }
      }

      for (const columnIndex of periodGradeColumnIndices) {
        const cell = row.querySelectorAll('td')[columnIndex];
        periodGrades.push((cell?.textContent?.trim() ?? '').split('/').pop().trim());
      }

      for (let pgIndex = 0; pgIndex < periodGradeColumnIndices.length; pgIndex++) {
        const [averageGrade, totalScore] = calculateAverageGrade(grades[pgIndex]);
        const studentName = row.querySelectorAll('td')?.[1]?.textContent.split(',')?.[0]?.trim() ?? '';

        const avgCell = document.createElement('td');
        avgCell.style.cssText = 'width:20px;padding:0 2px';
        avgCell.textContent = averageGrade;
        avgCell.title = studentName;
        avgCell.style.backgroundColor = gradePalette[parseInt(averageGrade)] || '#fff';
        row.insertBefore(avgCell, row.children[periodGradeColumnIndices[pgIndex] + pgIndex * 2]);

        const sumCell = document.createElement('td');
        sumCell.style.cssText = 'width:20px;padding:0 2px';
        sumCell.textContent = totalScore;
        sumCell.title = studentName;
        if (!totalColumnsAndScores[pgIndex]) totalColumnsAndScores[pgIndex] = [];
        totalColumnsAndScores[pgIndex].push([sumCell, totalScore]);
        row.insertBefore(sumCell, row.children[periodGradeColumnIndices[pgIndex] + pgIndex * 2]);
      }

      if (finalGradeHeader && !usedFinalGradeAsPeriodGrade) {
        const periodGradeCell = document.createElement('td');
        periodGradeCell.style.padding = '0 2px';
        periodGradeCell.textContent = periodGrades.join(' / ');
        row.insertBefore(periodGradeCell, row.children[finalGradeHeader.cellIndex - 1]);
      }
    });

    for (let pgIndex = 0; pgIndex < periodGradeColumnIndices.length; pgIndex++) {
      const scores = totalColumnsAndScores[pgIndex] ?? [];
      const secondBest = scores.map(([, s]) => s).sort((a, b) => b - a)[1] ?? 1;

      for (const [cell, score] of scores) {
        const n = score / secondBest;
        const color = n > 0.6
          ? `rgb(${255 - n * 76}, 255, ${255 - n * 76})`
          : `rgb(255, ${255 - n * 76}, ${255 - n * 76})`;
        cell.style.backgroundColor = color;
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function columnBackgroundColors() {
  const coloredColumns = {};
  [...document.querySelectorAll('.tahvel-table thead th.bordered')]
    .filter(h => h.style.cssText.includes('background:') && !h.style.cssText.startsWith('background: rgb(250, 250, 250);'))
    .forEach(h => (coloredColumns[Array.from(h.parentElement.children).indexOf(h)] = h.style.cssText.split(';')[0]));

  for (const [columnIndex, bg] of Object.entries(coloredColumns)) {
    const rgbValues = bg.match(/\d+/g).map(Number);
    const alpha = Math.min(...rgbValues) < 120 ? 0.2 : 0.5;
    document.querySelectorAll(`.tahvel-table tbody tr td:nth-child(${Number(columnIndex) + 1})`).forEach(td => {
      td.style.background = `rgba(${rgbValues[0]}, ${rgbValues[1]}, ${rgbValues[2]}, ${alpha})`;
    });
  }
}
