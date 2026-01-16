import { RoomDetails } from '../datasets/RoomDetails';

if (typeof GM_log === 'function') console.log = GM_log;

(function () {
  'use strict';
  console.log('Tahvel Customization script started');

  // Use API based on current origin, needed for tahveltp.edu.ee
  const TAHVEL_API_URL = window.location.origin + '/hois_back';

  // get 31 of december of previous year, for õppetoetus (manually enable) TODO needs improvement in september
  let oppetoetus = false; // Will change class-teacher (rühmajuhataja) raport to get previous semester data needed for grant, this is WIP and needs programmer attention

  //#region Angular hooking WIP
  /*setTimeout(() => {

    // Hook into AngularJS to get notified when the app changes content
    const angular = unsafeWindow.angular;
    if (!angular) return;

    let $injector = angular.element(document.getElementsByTagName("body")).injector()
    console.log("injector", $injector)
    let Menu = $injector.get("Menu")
    console.log("Menu", Menu)

    } , 5000)*/

  // Inject CSS
  const style = document.createElement('style');
  style.textContent = `
        /* Hinnete dropdown oleks pikem*/
        md-select-menu, md-select-menu md-content {
            max-height: 300px;
        }
        /* rühmajuhataja aruande tabelis nimed scrolliks kaasa */
        .tertiary-table student-group-teacher-table tbody td:nth-child(2) {
            position: sticky;
            left: 0;
            background: white; /* Prevents content from being hidden under scrolling elements */
            z-index: 2; /* Ensures it stays above other cells */
        }
    `;
  document.head.appendChild(style);

  // Some global variables assigned through XHR interceptors. These variables are not cleaned between dynamic view changes.
  // If possible validate the data before using it. For example, the studentId in the URL should match the currentStudent.id
  let currentStudent = null;
  let currentClassTeacherReport = null;
  let currentStudentModules = null;

  //#region Entry point to scripts and MutationObserver config

  // Trigger when Angular app changes content
  observeTargetChange(document.body, () => {
    // Update page title based on the last breadcrumb
    // If possible add ID from the URL to differentiate between multiple tabs
    let firstPath = window.location.href.match(/#\/([^\?\/]*)/)?.[1];
    let id = window.location.href.match(/\/(\d+)\//)?.[1] ?? '';
    id = id.length > 0 ? ` #${id}` : '';
    let lastBreadcrumb =
      document.querySelector('#breadcrumb-wrapper > span:last-child')?.textContent.trim() || firstPath || 'Tahvel';
    document.title = lastBreadcrumb + id;

    // Add average grade column and entry tooltips to journal
    if (window.location.href.indexOf('journal') > -1) {
      const journalTableRows = document.querySelectorAll('.tahvel-table tr');
      // const journalTableRows = document.querySelectorAll('.journalTable tr');
      if (journalTableRows?.length > 2 && !isAlreadyApplied(journalTableRows[1])) {
        console.log('In journal, add average grade column');
        addAverageGradeColumn();
        journalEntryTooltips();
        columnBackgroundColors();
        addAppliedMarker(journalTableRows[1]);
      }

      // Journal edit popup
      // Add listener to homework description input and entryType
      let homeworkDesc = document.querySelector("[ng-model='journalEntry.homework']");
      if (homeworkDesc && !isAlreadyApplied(homeworkDesc)) {
        console.log('In journal edit, add homework description listener');
        journalEntryNotifyStudent(homeworkDesc);
      }
      // Add batch absent button
      let batchGrade = document.querySelector('.mass-grade');
      console.log(batchGrade);
      if (batchGrade && batchGrade.textContent.includes('Hinde korraga') && !isAlreadyApplied(batchGrade)) {
        journalEntryBatchAbsent(batchGrade);
        addAppliedMarker(batchGrade);
      }
    }

    // Append age to PIN in student list view
    if (window.location.href.indexOf('students') > -1) {
      let table = document.querySelector('.md-table');
      let marker = document.querySelector('.md-table tbody > tr > td:nth-child(1)');
      if (table && !isAlreadyApplied(marker)) {
        //observeTargetChange(document.querySelector(".md-table"), appendAgeToPin);
        console.log('In students, append age to PIN');
        appendAgeToPin();
        addAppliedMarker(marker);
      }
    }

    // Sooritamise järjekorras aruande filtrid + neg. hinnete arv
    // Admin/tugitöötaja saab õpilase profiilis näha negatiivsete hinnete kokkuvõtet vahekaardil "Sooritamise järjekorras"
    let studentId = window.location.href.match(/students\/(\d+)/)?.[1];
    if (
      /students\/.*\/results/.test(window.location.href) &&
      document.querySelector(`.md-active[aria-label='Sooritamise järjekorras']`)
    ) {
      let table = document.querySelector(`[ng-show="resultsCurrentNavItem === 'student.inOrderOfPassing'"]`);
      let tableRows = table.querySelectorAll('tbody tr');
      if (table && tableRows.length > 5 && !isAlreadyApplied(table)) {
        negativeResultsToolsInStudentProfile(table, studentId);
        addAppliedMarker(table);
      }
    }

    // Admin/tugitöötaja saab õpilase profiilis "Õppekava täitmine" vahekaardil avada mooduli protokolli ja päevikut
    if (
      /students\/.*\/results/.test(window.location.href) &&
      document.querySelector(`.md-active[aria-label='Õppekava täitmine']`)
    ) {
      let firstModule = document.querySelector('.hois-collapse-parent div:first-of-type > span');
      if (firstModule && !isAlreadyApplied(firstModule)) {
        console.log(
          'In student profile, add module and journal links',
          currentStudent?.id != studentId,
          currentStudent?.id,
          studentId
        );
        if (currentStudent?.id == studentId) {
          addAppliedMarker(firstModule);
          studentProfileModuleAndJournalLinks(studentId);
        }
      }
    }

    // Rühmajuhataja aruande täiendused
    if (window.location.href.indexOf('reports/studentgroupteacher') > -1) {
      // Update Rühmajuhendaja aruanne parameters after group selection
      let groupSelect = document.querySelector(`md-autocomplete[md-floating-label="Õpperühm"] input`);
      if (groupSelect && !isAlreadyApplied(groupSelect)) {
        console.log('In Rühmajuhendaja aruanne, update parameters after group selection');
        groupSelect.addEventListener('change', () => {
          setTimeout(() => {
            // Account for autofill
            updateRJAParameters(groupSelect.value);
          }, 200);
        });
        addAppliedMarker(groupSelect);
      }
      // Same as previous, but teachers have different UI for group selection
      let groupSelectOptions = [...document.querySelectorAll(`md-option[ng-value="studentGroup"]`)];
      if (groupSelectOptions.length && !isAlreadyApplied(groupSelectOptions[0])) {
        console.log('In Rühmajuhendaja aruanne, update parameters after group selection');
        groupSelectOptions.forEach(option => {
          option.addEventListener('click', () => {
            setTimeout(() => {
              // Account for autofill
              updateRJAParameters(groupSelect.value);
            }, 200);
          });
        });
        addAppliedMarker(groupSelectOptions[0]);
      }

      // Rühmajuhataja aruandes toob koondandmed tabeli ette, lisab negatiivsed hinded
      let table = document.querySelector('.student-group-teacher-table');
      // Wait until tabel is loaded, check by body row count and check if last header column is "Hilinemisi"
      let isTableLoaded = table && table.querySelector('tbody tr:first-child td:nth-child(2) span:not([class])');
      if (isTableLoaded && !isAlreadyApplied(table)) {
        console.log('In Rühmajuhendaja aruanne, add summary data to table');
        addSummaryDataToRJA(table);
        addAppliedMarker(table);
      }
    }

    // Päevikute nimekirjas on tänased päevikud kõige ees
    if (window.location.href.indexOf('#/journals?_menu') > -1) {
      let myJournals = document.querySelector('#main-content > div:nth-of-type(2)');
      if (myJournals && !isAlreadyApplied(myJournals)) {
        console.log("In journals list, add today's journals first");
        myJournals = addMyJournals();
        if (myJournals) addAppliedMarker(myJournals);
      }
    }

    // Vabade ruumide tabelile täiendavad veerud: kohtade arv, arvutite arv, pindala, tahvel, OS
    if (location.hash.startsWith('#/lessonplans/rooms')) {
      observeTargetChange(document.body, () => {
        injectSeatInfoToColumn(RoomDetails);
      });
    }
  });

  function observeTargetChange(targetNode, callback) {
    const observer = new MutationObserver((mutationsList, observer) => {
      for (let mutation of mutationsList) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Pause the observer to avoid userscript changes triggering the observer again
          observer.disconnect();

          callback();

          // Resume observing
          observer.observe(targetNode, { childList: true, subtree: true });
          return;
        }
      }
    });
    observer.observe(targetNode, { childList: true, subtree: true });
    return observer;
  }

  function addAppliedMarker(element) {
    if (!element) return;
    element.dataset.userscriptApplied = true;
  }
  function isAlreadyApplied(element) {
    if (!element) return false;
    return element.dataset.userscriptApplied === 'true';
  }
  //#endregion

  //#region Average grade column in journal
  const gradePalette = {
    5: '#b3ffb3', // Light green
    4: '#b3ffb3', // Light green
    3: '#ffffb3', // Light yellow
    2: '#ffb3b3', // Light red
    1: '#ffb3b3', // Light red
    0: '#ffb3b3', // Light red
  };
  // Function to calculate the average grade
  function calculateAverageGrade(grades) {
    let total = 0;
    let count = 0;

    // Loop through each grade
    grades.forEach(grade => {
      let lastGrade = grade.trim().split('/').pop().trim();
      if (lastGrade === 'MA' || lastGrade === 'X') lastGrade = '0';
      const parsedGrade = parseFloat(lastGrade);

      // Check if parsing was successful
      if (!isNaN(parsedGrade)) {
        total += parsedGrade;
        count++;
      }
    });

    // Calculate the average grade with 1 decimal place
    const averageGrade = count > 0 ? (total / count).toFixed(1) : '0.0';

    return [averageGrade, total];
  }

  // Function to add the narrow column
  function addAverageGradeColumn() {
    const observer = new MutationObserver(() => {
      // Find grade table
      const gradeTable = document.querySelector('#studentTable');

      if (gradeTable) {
        observer.disconnect();
        console.log('Found table!');

        // Find the table header cells which are not the period/final grade columns
        const tableHeaders = gradeTable.querySelectorAll(
          '.tahvel-table th.header-cell:not([style*="background-color: rgb(224, 231, 255)"]):not([style*="background-color: rgb(249, 168, 212)"])'
        );

        // Find Perioodi hinne and Lõpptulemus headers
        const periodGradeHeaders = gradeTable.querySelectorAll(
          '.tahvel-table th[style*="background-color: rgb(224, 231, 255)"]'
        );
        const finalGradeHeader = gradeTable.querySelector('.tahvel-table th[style*="background-color: rgb(249, 168, 212)"]');

        // Get the index of each grade column
        /*
                const gradeColumnIndices = Array.from(tableHeaders).map(header => {
                    const columnIndex = Array.from(header.parentNode.parentNode.children).indexOf(header.parentNode);
                    return columnIndex;
                });
                */
        const gradeColumnIndices = Array.from(tableHeaders).map(th => th.cellIndex);

        // Get the indexes of the Perioodi hinne columns
        /*
                let periodGradeColumnIndices = Array.from(periodGradeHeaders).map(header => {
                    const columnIndex = Array.from(header.parentNode.parentNode.children).indexOf(header.parentNode);
                    return columnIndex;
                });
                */
        let periodGradeColumnIndices = Array.from(periodGradeHeaders).map(th => th.cellIndex);

        console.log(periodGradeColumnIndices);

        let usedFinalGradeAsPeriodGrade = false;
        if (periodGradeColumnIndices.length === 0) {
          if (finalGradeHeader) {
            periodGradeColumnIndices = [finalGradeHeader.cellIndex];
            usedFinalGradeAsPeriodGrade = true;
          } else {
            periodGradeColumnIndices = [gradeTable.querySelectorAll('.tahvel-table thead th').length - 1];
            usedFinalGradeAsPeriodGrade = true;
          }
        }
        console.log('Period grade columns', periodGradeColumnIndices);

        // Get all the rows in the table
        const rows = gradeTable.querySelectorAll('.tahvel-table tr');
        const headerRow = rows[0];

        // Remove existing custom headers, because Angular will re-render only the table rows
        [...gradeTable.querySelectorAll('.tahvel-table th[aria-label*="Keskmine hinne"]')].forEach(header =>
          header.remove()
        );
        [...gradeTable.querySelectorAll('.tahvel-table th[aria-label*="Hinnete summa"]')].forEach(header => header.remove());
        [...gradeTable.querySelectorAll('.tahvel-table th[aria-label*="Perioodide hinded"]')].forEach(header =>
          header.remove()
        );

        for (let i = 0; i < periodGradeColumnIndices.length; i++) {
          const narrowColumnHeader = document.createElement('th');
          narrowColumnHeader.textContent = 'Keskm.';
          narrowColumnHeader.setAttribute('aria-label', 'Keskmine hinne');
          narrowColumnHeader.style.width = '20px'; // Set the width of the narrow column
          narrowColumnHeader.style.padding = '0 2px';
          narrowColumnHeader.style.backgroundColor = '#e2e4f4';
          headerRow.insertBefore(narrowColumnHeader, headerRow.children[periodGradeColumnIndices[i] + i * 2]);

          const totalColumnHeader = document.createElement('th');
          totalColumnHeader.textContent = 'Summa';
          totalColumnHeader.setAttribute('aria-label', 'Hinnete summa');
          totalColumnHeader.style.width = '20px'; // Set the width of the narrow column
          totalColumnHeader.style.padding = '0 2px';
          totalColumnHeader.style.backgroundColor = '#e2e4f4';
          headerRow.insertBefore(totalColumnHeader, headerRow.children[periodGradeColumnIndices[i] + i * 2]);
        }

        if (finalGradeHeader && !usedFinalGradeAsPeriodGrade) {
          const periodGradesHeader = document.createElement('th');
          periodGradesHeader.textContent = 'Perioodide hinded';
          periodGradesHeader.setAttribute('aria-label', 'Perioodide hinded');
          periodGradesHeader.style.width = '20px'; // Set the width of the narrow column
          periodGradesHeader.style.padding = '0 2px';
          periodGradesHeader.style.backgroundColor = '#f7b0c8';
          headerRow.insertBefore(periodGradesHeader, finalGradeHeader);
        }

        // Loop through each row
        /** @type {[HTMLTableCellElement, number][]}  [td DOM, totalScore] */
        let totalColumnsAndScores = [];
        rows.forEach((row, rowIndex) => {
          // Skip the header row
          if (rowIndex === 0) return;

          // if mouse hover over the row, then change border color to thicker 2-3px
          row.addEventListener('mouseover', function () {
            this.style.outline = '2px solid #000';
            this.style.outlineOffset = '-2px';
          });
          row.addEventListener('mouseout', function () {
            this.style.outline = 'unset';
          });

          /** @type {string[][]} First level is period, second is grades as a string with history "X / 3 / 5" */
          let grades = [];
          let periodGrades = [];
          for (let i = 0; i < periodGradeColumnIndices.length; i++) {
            grades[i] = [];
          }

          // Extract the grades for the current row, grouped by period
          let currentPeriodIndex = 0;
          gradeColumnIndices.forEach(columnIndex => {
            if (columnIndex > periodGradeColumnIndices[currentPeriodIndex]) {
              currentPeriodIndex++;
            }
            if (currentPeriodIndex < periodGradeColumnIndices.length) {
              const gradeCell = row.querySelectorAll('td')[columnIndex];
              const gradeText = gradeCell?.textContent?.trim() ?? '';
              grades[currentPeriodIndex].push(gradeText);
            }
          });

          // Extract period grades
          periodGradeColumnIndices.forEach((columnIndex, index) => {
            const gradeCell = row.querySelectorAll('td')[columnIndex];
            const gradeText = gradeCell?.textContent?.trim() ?? '';
            periodGrades.push(gradeText.trim().split('/').pop().trim());
          });

          // Calculate the average grade, insert result as a new cell in the row
          for (let pgIndex = 0; pgIndex < periodGradeColumnIndices.length; pgIndex++) {
            const [averageGrade, totalScore] = calculateAverageGrade(grades[pgIndex]);

            // Create the narrow column cell for average grade
            const narrowColumnCell = document.createElement('td');
            narrowColumnCell.style.width = '20px'; // Set the width of the narrow column
            narrowColumnCell.style.padding = '0 2px';
            narrowColumnCell.textContent = averageGrade;
            // set the title to first column text before comma
            narrowColumnCell.title = row.querySelectorAll('td')?.[1]?.textContent.split(',')?.[0]?.trim() ?? '';

            // Set the background color based on the grade
            narrowColumnCell.style.backgroundColor = gradePalette[parseInt(averageGrade)] || '#fff';

            // Append the narrow column cell to the row
            row.insertBefore(narrowColumnCell, row.children[periodGradeColumnIndices[pgIndex] + pgIndex * 2]);

            // Create the narrow column cell for total score
            const totalColumn = document.createElement('td');
            totalColumn.style.width = '20px'; // Set the width of the narrow column
            totalColumn.style.padding = '0 2px';
            totalColumn.textContent = totalScore;
            // set the title to first column text before comma
            totalColumn.title = row.querySelectorAll('td')?.[1]?.textContent.split(',')?.[0]?.trim() ?? '';

            if (totalColumnsAndScores[pgIndex] === undefined) {
              totalColumnsAndScores[pgIndex] = [];
            }
            totalColumnsAndScores[pgIndex].push([totalColumn, totalScore]);

            // Append the narrow column cell to the row
            row.insertBefore(totalColumn, row.children[periodGradeColumnIndices[pgIndex] + pgIndex * 2]);
          }

          // Create the column cell for period
          if (finalGradeHeader && !usedFinalGradeAsPeriodGrade) {
            const periodGradeCell = document.createElement('td');
            periodGradeCell.style.padding = '0 2px';
            periodGradeCell.textContent = periodGrades?.join(' / ') ?? '';
            row.insertBefore(periodGradeCell, row.children[finalGradeHeader.cellIndex - 1]);
          }
        });

        for (let pgIndex = 0; pgIndex < periodGradeColumnIndices.length; pgIndex++) {
          // Find the second best total score
          const secondBestTotalScore = totalColumnsAndScores[pgIndex]
            .map(([totalColumn, totalScore]) => totalScore)
            .sort((a, b) => b - a)[1];

          totalColumnsAndScores[pgIndex].forEach(([totalColumn, totalScore]) => {
            // Normalize single totalScore related to bestTotalScore
            const normalizedTotalScore = totalScore / secondBestTotalScore;
            // Make color from green to white to red based on normalizedTotalScore
            // 179, 255, 179
            // 255, 179, 179
            let color = '';
            if (normalizedTotalScore > 0.6)
              color = `rgb(${255 - normalizedTotalScore * 76}, 255, ${255 - normalizedTotalScore * 76})`;
            else color = `rgb(255, ${255 - normalizedTotalScore * 76}, ${255 - normalizedTotalScore * 76})`;

            // Set the background color based on the grade
            totalColumn.style.backgroundColor = color || '#fff';
          });
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function columnBackgroundColors() {
    let coloredColumns = {};
    [...document.querySelectorAll('.tahvel-table thead th.bordered')]
      .filter(h => h.style.cssText.includes('background:') && !h.style.cssText.startsWith('background: rgb(250, 250, 250);'))
      .forEach(h => (coloredColumns[Array.from(h.parentElement.children).indexOf(h)] = h.style.cssText.split(';')[0]));

    Object.entries(coloredColumns).forEach(([columnIndex, bg]) => {
      document.querySelectorAll(`.tahvel-table tbody tr td:nth-child(${Number(columnIndex) + 1})`).forEach(td => {
        const rgbValues = bg.match(/\d+/g).map(Number);
        let alpha = Math.min(...rgbValues) < 120 ? 0.2 : 0.5;
        td.style.background = `rgba(${rgbValues[0]}, ${rgbValues[1]}, ${rgbValues[2]}, ${alpha})`;
      });
    });
  }
  //#endregion

  //#region Päevikus hiirega kuupäeva peale liikumine näitab tunni kirjeldust
  async function journalEntryTooltips() {
    let journalId = window.location.href.match(/journal\/(\d+)/)[1];
    if (!journalId) {
      return;
    }
    let entryDOMs = document.querySelectorAll(`[ng-if^="journalEntry.entryType.code"]`);
    if (entryDOMs.length === 0) {
      return;
    }

    let table = entryDOMs[0];
    while (table.tagName !== 'TABLE') {
      table = table.parentElement;
    }
    let tableBody = table?.querySelector('tbody');
    let headerRow = table.querySelector('thead tr');

    // TODO cached fetch to avoid multiple requests during re-renders
    let response1 = await fetch(`${TAHVEL_API_URL}/journals/${journalId}/journalEntry?lang=ET&page=0&size=100`, {
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Microsoft Edge";v="122"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'x-requested-with': 'XMLHttpRequest',
      },
      referrer: `${window.location.origin}/`,
      referrerPolicy: 'strict-origin-when-cross-origin',
      body: null,
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
    });
    let dataEntries = await response1.json();
    let response2 = await fetch(`${TAHVEL_API_URL}/journals/${journalId}/journalEntriesByDate?allStudents=false`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.5',
        'X-Requested-With': 'XMLHttpRequest',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
      },
      referrer: `${window.location.origin}/`,
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
    });
    let journalEntries = await response2.json();
    let domIndex = 0;
    let skipHeaders = ['Nr', 'Õppija, Õpperühm', 'Keskm.', 'Summa'];
    journalEntries.forEach((dateEntry, entryIndex) => {
      domIndex++;
      let content = headerRow.children[domIndex].textContent;
      while (skipHeaders.includes(content)) {
        domIndex++;
        content = headerRow.children[domIndex].textContent;
      }
      let entry = dataEntries.content.find(dataEntry => dataEntry.id === dateEntry.id);
      let el = entryDOMs[entryIndex];
      let entryType = SissekandedEnum[entry.entryType];
      if (entry.nameEt !== entryType) entryType += ': ' + entry.nameEt;
      let tooltipContent = `<b>${entryType}</b><br>${entry.content?.replaceAll('\n', '<br>') ?? ''}`;
      if (entry.homework) {
        let duedate = entry.homeworkDuedate ? new Date(entry.homeworkDuedate).toLocaleDateString('et') : '';
        tooltipContent += `<br><br><b>Kodutöö ${duedate}</b><br><br>${entry.homework?.replaceAll('\n', '<br>') ?? ''}`;
      }
      let tooltip = createTooltip(el, tooltipContent);

      el.addEventListener('mousemove', event => {
        tooltip.style.display = 'block';
        tooltip.style.top = event.clientY + 20 + window.scrollY + 'px';
        tooltip.style.left = event.clientX - el.getBoundingClientRect().width / 2 + 'px';
      });
      el.addEventListener('mouseout', () => {
        if (tooltip.style.display === 'block') tooltip.style.display = 'none';
      });

      // find the index of the first th
      let closestTH = el.parentElement;
      while (closestTH && closestTH.tagName !== 'TH') {
        closestTH = closestTH.parentElement;
      }
      // Go through all rows and get the element at the same index
      for (let i = 0; i < tableBody.children.length; i++) {
        let el = tableBody.children[i].children[domIndex].querySelector('div.layout-row > div');
        if (!el) continue;

        el.addEventListener('mousemove', event => {
          tooltip.style.display = 'block';
          tooltip.style.top = event.clientY + 46 + window.scrollY + 'px';
          tooltip.style.left = event.clientX - el.getBoundingClientRect().width / 2 + 'px';
        });
        el.addEventListener('mouseout', () => {
          if (tooltip.style.display === 'block') tooltip.style.display = 'none';
        });
      }
    });

    function createTooltip(element, content) {
      let clone;
      if (content === undefined) {
        clone = element.cloneNode(true);
      } else {
        clone = document.createElement('div');
        clone.innerHTML = content;
      }
      clone.style.display = 'none';
      clone.style.position = 'absolute';
      clone.style.zIndex = 1000;
      clone.style.backgroundColor = 'white';
      clone.style.padding = '5px';
      clone.style.maxWidth = '500px';
      clone.style.pointerEvents = 'none';
      document.body.appendChild(clone);
      return clone;
    }
  }
  //#endregion

  //#region Päeviku kandes õpilase teavitamine kodutööst
  function journalEntryNotifyStudent(homeworkDesc) {
    let isTestCheckbox = document.querySelector("[ng-model='journalEntry.isTest']");
    homeworkDesc.addEventListener('input', () => {
      if (isTestCheckbox.getAttribute('aria-checked') === (homeworkDesc.value.trim().length > 0 ? 'false' : 'true')) {
        isTestCheckbox.click();
      }
    });
    addAppliedMarker(homeworkDesc);

    let entryTypeOptions = document.querySelectorAll(`[value^="SISSEKANNE_"]`);
    entryTypeOptions.forEach(option => {
      option.addEventListener('click', () => {
        let hasHomeworkDescription = homeworkDesc.value.trim().length > 0;
        if (
          isTestCheckbox.getAttribute('aria-checked') ===
          (option.value === 'SISSEKANNE_H' || hasHomeworkDescription ? 'false' : 'true')
        ) {
          isTestCheckbox.click();
        }
      });
    });
  }
  //#endregion

  //#region Päeviku kandes puudumiste korraga märkimine
  function journalEntryBatchAbsent(siblingContainer) {
    let batchAbsent = document.createElement('a');
    batchAbsent.href = '#';
    batchAbsent.textContent = ' | Märgi kõik puudujaks';
    batchAbsent.style.color = 'blue';
    batchAbsent.style.cursor = 'pointer';

    batchAbsent.addEventListener('click', event => {
      event.preventDefault();
      let absentCheckboxes = [...document.querySelectorAll('checkbox[formcontrolname="absenceWithoutReason"] button')];
      let allChecked = absentCheckboxes.every(btn => btn.matches(':has(div.checked)') === true);

      absentCheckboxes.forEach(btn => {
        if (allChecked == true) {
          if (btn.matches(':has(div.checked)') === true) {
            btn.click();
          }
        } else {
          if (btn.matches(':has(div.checked)') === false) {
            btn.click();
          }
        }
      });

      // Update the button text just for the clarity. But query DOM again, because some checkboxes get removed when students are excused
      absentCheckboxes = [...document.querySelectorAll('checkbox[formcontrolname="absenceWithoutReason"] button')];
      allChecked = absentCheckboxes.every(btn => btn.matches(':has(div.checked)') === true);
      batchAbsent.textContent = allChecked ? ' | Märgi kõik kohalolijaks' : ' | Märgi kõik puudujaks';
    });

    //siblingContainer.parentElement.appendChild(document.createElement("br"));
    siblingContainer.appendChild(batchAbsent);
  }
  //#endregion

  //#region Student list and detail view enhancements
  function calculateAgeFromPin(pin) {
    // pin is in format 39210050229 (SYYMMDDNNNC), S is century and sex, 3 is 20th century male, 4 is 20st century female, 5 is 21st century
    const century = parseInt(pin.substring(0, 1));
    const year = parseInt(pin.substring(1, 3));
    const month = parseInt(pin.substring(3, 5));
    const day = parseInt(pin.substring(5, 7));

    const baseYear = century === 3 || century === 4 ? 1900 : 2000;
    const birthDate = new Date(baseYear + year, month - 1, day);
    const ageDifMs = Date.now() - birthDate.getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }

  function appendAgeToPin() {
    let elements = [];

    // Students list view table
    let columnHeader = document.querySelector("[md-order-by='person.idcode']");
    if (columnHeader) {
      let columnNumber = Array.from(columnHeader.parentElement.children).indexOf(columnHeader);
      elements = Array.from(
        columnHeader.parentElement.parentElement.parentElement.querySelectorAll(
          'tbody > tr > td:nth-child(' + (columnNumber + 1) + ')'
        )
      );
    }

    elements.forEach(element => {
      const pin = element.textContent;
      const age = calculateAgeFromPin(pin);
      // if age is less than 18 make the span bold
      element.innerHTML = `${pin} <span style="font-weight: ${age < 18 ? 'bold' : 'normal'}">(${age})</span>`;
    });
  }
  //#endregion

  //#region Õpilase profiilil "Sooritamise järjekorras" vahekaardil filtrid + neg. hinnete arv
  function negativeResultsToolsInStudentProfile(table, studentId) {
    const tableHeaders = table.querySelectorAll('thead th');
    const tableRows = table.querySelectorAll('tbody tr');

    // Count negative final grades
    let totalGrades = 0;
    let negativeGrades = 0;
    tableRows.forEach(row => {
      let type = row.querySelector('td:nth-child(2)').textContent.trim();
      let grade = row.querySelector('td:nth-child(3)').textContent.trim();
      if (['MA', 'X', '1', '2'].includes(grade) && type === 'Lõpptulemus') {
        negativeGrades++;
      }
      if (['MA', 'X', '1', '2', '3', '4', '5', 'A'].includes(grade) && type === 'Lõpptulemus') {
        totalGrades++;
      }
    });
    let negativeGradesCounter = document.createElement('span');
    let negativeGradesPercentage = totalGrades > 0 ? (negativeGrades / totalGrades) * 100 : 0;
    negativeGradesCounter.textContent = `Negatiivseid lõpptulemusi: ${negativeGrades} (~${negativeGradesPercentage.toFixed(0)}%)`;

    // Add filter activation buttons before the table
    let onlyNegativeGradesToggle = document.createElement('button');
    onlyNegativeGradesToggle.textContent = 'Näita neg. hindeid';
    onlyNegativeGradesToggle.classList.add('md-button', 'md-raised');
    onlyNegativeGradesToggle.style.marginRight = '10px';
    onlyNegativeGradesToggle.dataset.active = 'false';
    onlyNegativeGradesToggle.addEventListener('click', () => {
      let active = onlyNegativeGradesToggle.dataset.active === 'true';
      onlyNegativeGradesToggle.dataset.active = !active;
      onlyNegativeGradesToggle.textContent = active ? 'Näita neg. hindeid' : 'Näita kõiki hindeid';
      if (active) {
        tableRows.forEach(row => {
          row.style.display = '';
        });
      } else {
        tableRows.forEach(row => {
          let type = row.querySelector('td:nth-child(2)').textContent.trim();
          let grade = row.querySelector('td:nth-child(3)').textContent.trim();
          if (!['MA', 'X', '1', '2'].includes(grade) || type !== 'Lõpptulemus') {
            row.style.display = 'none';
          }
        });
      }
    });

    // Hide unnecessary columns
    let hideColumns = [1, 3];
    let hideColumnsToggle = document.createElement('button');
    hideColumnsToggle.textContent = 'Peida mittevajalikud veerud';
    hideColumnsToggle.classList.add('md-button', 'md-raised');
    hideColumnsToggle.style.marginRight = '10px';
    hideColumnsToggle.dataset.active = 'false';
    hideColumnsToggle.addEventListener('click', () => {
      let active = hideColumnsToggle.dataset.active === 'true';
      hideColumnsToggle.dataset.active = !active;
      hideColumnsToggle.textContent = active ? 'Peida mittevajalikud veerud' : 'Näita kõiki veerge';
      if (active) {
        tableRows.forEach(row => {
          hideColumns.forEach(index => {
            row.children[index].style.display = '';
            tableHeaders[index].style.display = '';
          });
        });
      } else {
        tableRows.forEach(row => {
          hideColumns.forEach(index => {
            row.children[index].style.display = 'none';
            tableHeaders[index].style.display = 'none';
          });
        });
      }
    });

    // Show journal links in the table
    let journalLinkToggle = document.createElement('button');
    journalLinkToggle.textContent = 'Lisa päeviku lingid';
    journalLinkToggle.classList.add('md-button', 'md-raised');
    journalLinkToggle.style.marginRight = '10px';
    journalLinkToggle.addEventListener('click', () => {
      fetch(`${TAHVEL_API_URL}/students/${studentId}/vocationalConnectedEntities`, {
        headers: { accept: 'application/json' },
      })
        .then(r => r.json())
        .then(data => {
          tableRows.forEach(row => {
            let subject = row.querySelector('td:nth-child(1)').textContent.trim().toLowerCase();
            data.forEach(journal => {
              if (journal.type === 'journal' && subject.startsWith(journal.nameEt.toLowerCase())) {
                let journalLink = document.createElement('button');
                journalLink.addEventListener('click', () => {
                  window.open(`#/journal/${journal.entityId}/edit`, '_blank');
                });
                journalLink.textContent = 'Päevik';
                row.querySelector('td:nth-child(1)').appendChild(journalLink);
              }
            });
          });
          journalLinkToggle.disabled = true;
        });
    });

    table.parentElement.insertBefore(onlyNegativeGradesToggle, table);
    table.parentElement.insertBefore(hideColumnsToggle, table);
    table.parentElement.insertBefore(journalLinkToggle, table);
    table.parentElement.insertBefore(negativeGradesCounter, table);
  }
  //#endregion

  //#region Admin/tugitöötaja saab õpilase profiilis "Õppekava täitmine" vahekaardil avada mooduli protokolli ja päevikut
  async function studentProfileModuleAndJournalLinks(studentId) {
    const curriculumVersionId = currentStudent?.curriculumVersion?.id;
    const groupCode = currentStudent?.curriculumVersion?.code;
    const modulesDom = document.querySelectorAll(
      '.hois-collapse-parent div:not(.subtext):not([ng-if]):first-of-type > span'
    );
    const journalsDom = document.querySelectorAll('.hois-collapse-body .tahvel-table td:first-of-type > span');

    // Query moduleProtocols
    let moduleProtocolsResponse = await fetch(
      `${TAHVEL_API_URL}/moduleProtocols?isVocational=true&curriculumVersion=${curriculumVersionId}&lang=ET&page=0&size=75`,
      { headers: { accept: 'application/json' } }
    );
    let moduleProtocols = await moduleProtocolsResponse.json();
    modulesDom.forEach(moduleDom => {
      // remove last part of module name that is in brackets, search from the end of the string
      let moduleName = moduleDom.textContent.trim().replace(/\s*\([^)]*\)$/, '');

      // find matching moduleProtocols and add a links to protocols
      moduleProtocols.content
        .filter(
          mp => mp.studentGroups.includes(groupCode) && mp.curriculumVersionOccupationModules?.[0]?.nameEt === moduleName
        )
        .forEach(mp => {
          // insert a tag with href=`https://tahvel.edu.ee/#/moduleProtocols/module/129756/edit`  ${m.id}?
          let moduleLink = document.createElement('a');
          moduleLink.href = `#/moduleProtocols/module/${mp.id}/edit`;
          moduleLink.target = '_blank';
          moduleLink.textContent = mp.id;
          moduleLink.style.paddingRight = '5px';
          moduleLink.style.fontWeight = 'bold';
          moduleLink.style.color = 'var(--color-new-primary-blue-1)';
          moduleLink.style.textDecoration = 'none';
          moduleDom.appendChild(moduleLink);
        });

      // btn/link to create a new module protocol
      let moduleData = currentStudentModules.curriculumModules.find(m => m.curriculumModule.nameEt === moduleName);
      if (moduleData) {
        let newModuleLink = document.createElement('a');
        newModuleLink.addEventListener('click', async () => {
          newModuleLink.style.pointerEvents = 'none';
          newModuleLink.style.color = 'gray';
          newModuleLink.textContent = 'Laeb...';
          // perpare data and show it in confirm dialog
          let studyYearResponse = await fetch(`${TAHVEL_API_URL}/school/studyYear/current-or-next-dto`, {
            credentials: 'include',
            headers: { Accept: 'application/json, text/plain, */*' },
            method: 'GET',
          });
          let studyYear = await studyYearResponse.json();
          let studentsResponse = await fetch(
            `${TAHVEL_API_URL}/moduleProtocols/occupationModule/${studyYear.id}/${moduleData.id}`,
            { credentials: 'include', headers: { Accept: 'application/json, text/plain, */*' }, method: 'GET' }
          );
          let students = await studentsResponse.json();
          let moduleName = moduleData.curriculumModule.nameEt;
          if (!(currentStudent.curriculumVersion.id && studyYear.id && students.teacher.id, moduleData.id)) {
            console.log('Module data', moduleData);
            console.log('Students data', students);
            console.log('Study year data', studyYear);
            console.log('Current student data', currentStudent);
            alert('Tekkis viga, vaata konsooli.');
            // restore button
            newModuleLink.style.pointerEvents = '';
            newModuleLink.style.color = 'var(--color-new-primary-blue-1)';
            newModuleLink.textContent = 'Uus protokoll';
            return;
          }

          let confirmText = `Oled loomas uut protokolli moodulile ${moduleName}. Moodulile määratakse õppeaasta ${studyYear.nameEt}, õpetajaks ${students.teacher.nameEt} ja lisatakse ${students.occupationModuleStudents.length} õpilast.`;
          if (confirm(confirmText)) {
            let newModuleResponse = await fetch(`${TAHVEL_API_URL}/moduleProtocols`, {
              credentials: 'include',
              headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json;charset=utf-8',
                'X-XSRF-TOKEN': getCsrfToken(),
              },
              body: JSON.stringify({
                protocolVdata: {
                  curriculumVersionOccupationModule: moduleData.id,
                  curriculumVersion: currentStudent.curriculumVersion.id,
                  studyYear: studyYear.id,
                  teacher: students.teacher.id,
                },
                protocolStudents: students.occupationModuleStudents.map(s => ({ studentId: s.studentId })),
                type: 'module',
                isBasic: false,
                isSecondary: false,
                isHigher: false,
                isVocational: true,
              }),
              method: 'POST',
            });
            let newModule = await newModuleResponse.json();
            // open the module in a new tab
            window.open(`#/moduleProtocols/module/${newModule.id}/edit`, '_blank');
            // restore button
            newModuleLink.style.pointerEvents = '';
            newModuleLink.style.color = 'var(--color-new-primary-blue-1)';
            newModuleLink.textContent = 'Uus protokoll';
          }
        });
        newModuleLink.textContent = 'Uus protokoll';
        newModuleLink.style.paddingRight = '5px';
        newModuleLink.style.color = 'var(--color-new-primary-blue-1)';
        newModuleLink.style.textDecoration = 'none';
        newModuleLink.style.textTransform = 'none';
        newModuleLink.style.border = '1px solid var(--color-new-primary-blue-1)';
        newModuleLink.style.whiteSpace = 'nowrap';
        moduleDom.appendChild(newModuleLink);
      }
    });

    // Query journals
    let journalsResponse = await fetch(`${TAHVEL_API_URL}/students/${studentId}/vocationalConnectedEntities`, {
      headers: { accept: 'application/json' },
    });
    let vocationalConnectedEntities = await journalsResponse.json();
    journalsDom.forEach(journal => {
      // remove last part of journal name that is in brackets, search from the end of the string
      let journalName = journal.textContent.trim().replace(/\s*\([^)]*\)$/, '');

      // find matching journals and add a links
      vocationalConnectedEntities
        .filter(e => e.type === 'journal' && e.nameEt === journalName)
        .forEach(e => {
          // insert a tag with target="_blank" href=`https://tahvel.edu.ee/#/journal/${e.entityId}/edit`  content=e.entityId
          let journalLink = document.createElement('a');
          journalLink.href = `#/journal/${e.entityId}/edit`;
          journalLink.target = '_blank';
          journalLink.textContent = e.entityId;
          journalLink.style.paddingRight = '5px';
          journal.appendChild(journalLink);
        });
    });
  }
  //#endregion

  //#region Rühmajuhendaja aruanne
  function updateRJAParameters(event) {
    let group = event;
    if (typeof group === 'object' && group.nameEt) group = group.nameEt;
    //document.querySelector(`[ng-click="toggleShowAllParameters()"]`).click();

    // get the year number from group and set the date to 1 of august of that year
    let year = parseInt(group.match(/\d+/)[0]) + 2000;
    let date = new Date(year, 7, 1);

    // get 31 of december of previous year, for õppetoetus (manually enable) TODO needs improvement in september
    let previousPeriodYear = new Date().getFullYear() - 1;
    let endDate = new Date(previousPeriodYear, 11, 31);

    // checkboxes in order, 1 for checked, 0 for unchecked
    let rjaEntryTypes = [1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    // checkboxes for õppetoetus (manually enable)
    if (oppetoetus) {
      rjaEntryTypes = [1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0];
    }
    // loop to remove checkmarks from disabled checkboxes after they are enabled from the previous run
    for (let i = 0; i < 4; i++) {
      document.querySelectorAll(`[ng-show="formState.showAllParameters"] md-checkbox`).forEach((input, index) => {
        let inputState = input.getAttribute('aria-checked') === 'true' ? 1 : 0;
        if (inputState ^ rjaEntryTypes[index]) input.click();
      });
    }

    let dateInput = document.querySelector(`[ng-model="criteria.from"] input`);
    dateInput.click();
    dateInput.value = '';
    let startDate = date.toLocaleDateString('et', { day: '2-digit', month: '2-digit', year: 'numeric' });
    simulateTyping(dateInput, startDate, 10, 10);

    // for õppetoetus (manually enable)
    if (oppetoetus) {
      let dateInput2 = document.querySelector(`[ng-model="criteria.thru"] input`);
      dateInput2.click();
      dateInput2.value = '';
      let endDateStr = endDate.toLocaleDateString('et', { day: '2-digit', month: '2-digit', year: 'numeric' });
      simulateTyping(dateInput2, endDateStr, 10, 10);
    }

    document.querySelector(`[ng-model="criteria.studyYear"]`).click();
    setTimeout(() => {
      document.querySelector(`.md-select-menu-container.md-active.md-clickable md-option`).click();
    }, 120);
  }
  //#endregion

  //#region Rühmajuhataja aruandes toob koondandmed tabeli ette, lisab negatiivsed hinded
  function addSummaryDataToRJA(table) {
    // Prepare negative grade data to be inserted into the table
    const newColumnsToBeAdded = 6;
    const periodGradeClassifier = 'R';
    const finalGradeClassifier = 'L';
    let studentGradesMap = new Map();
    currentClassTeacherReport.students.forEach(student => {
      let totalFinalGrades = 0;
      let totalPeriodGrades = 0;
      let negativeFinalGrades = 0;
      let negativePeriodGrades = 0;
      student.resultColumns.forEach(resultColumn => {
        let fresult = resultColumn?.journalResult?.results;
        if (fresult?.length) {
          fresult.forEach(result => {
            if (result.entryType.endsWith(periodGradeClassifier)) {
              if (
                result.grade.code.endsWith('MA') ||
                result.grade.code.endsWith('X') ||
                result.grade.code.endsWith('1') ||
                result.grade.code.endsWith('2')
              ) {
                negativeFinalGrades++;
              }
              totalFinalGrades++;
            } else if (result.entryType.endsWith(finalGradeClassifier)) {
              if (
                result.grade.code.endsWith('MA') ||
                result.grade.code.endsWith('X') ||
                result.grade.code.endsWith('1') ||
                result.grade.code.endsWith('2')
              ) {
                negativePeriodGrades++;
              }
              totalPeriodGrades++;
            }
          });
        }
      });
      studentGradesMap.set(student.fullname, {
        totalPeriodGrades,
        negativePeriodGrades,
        totalFinalGrades,
        negativeFinalGrades,
      });
    });

    // Site has 3 rows inside thead, I want to select the last column of every row in thead. On the thrid row, get last x th elements, based on first row colspan number
    table = document.querySelector('.student-group-teacher-table');
    const columnDataOffset = 2;
    let headerRows = table.querySelectorAll('thead tr');
    let headerSummaryColumn = headerRows[0].querySelector('th:last-child');
    let headerSummaryColumn2 = headerRows[1].querySelector('th:last-child');
    let colspan = parseInt(headerSummaryColumn.getAttribute('colspan'));
    let headerCells = headerRows[2].querySelectorAll('th');
    let lastCells = Array.from(headerCells).slice(-colspan);
    let lastCellIndex = Array.from(headerCells).indexOf(lastCells[0]);

    // Move last 7 cells to the beginning of the table based on lastCellIndex, after 2 column, both for header and body
    // Notice that first two rows in thead are merged using colspan
    headerRows[0].insertBefore(headerSummaryColumn, headerRows[0].children[1]);
    headerRows[1].insertBefore(headerSummaryColumn2, headerRows[1].children[1]);

    let bodyRows = table.querySelectorAll('tbody tr');
    lastCells.forEach((cell, ci) => {
      headerRows[2].insertBefore(cell, headerRows[columnDataOffset].children[columnDataOffset + ci]);
      bodyRows.forEach(row => {
        row.insertBefore(row.children[lastCellIndex + ci], row.children[columnDataOffset + ci]);
      });
    });

    // Add negative grade count and percentage columns to the summary
    bodyRows.forEach(row => {
      let studentName = row.children[columnDataOffset - 1]
        ?.querySelector('span:not([class]):not([ng-if])')
        ?.textContent.trim();
      if (studentGradesMap.has(studentName)) {
        const { totalPeriodGrades, negativePeriodGrades, totalFinalGrades, negativeFinalGrades } =
          studentGradesMap.get(studentName);
        let negativePeriodGradeCell = document.createElement('td');
        negativePeriodGradeCell.textContent = negativePeriodGrades;
        let negativePeriodGradePercentageCell = document.createElement('td');
        negativePeriodGradePercentageCell.textContent = ((negativePeriodGrades / totalPeriodGrades) * 100).toFixed(1) + '%';
        let negativeFinalGradeCell = document.createElement('td');
        negativeFinalGradeCell.textContent = negativeFinalGrades;
        let negativeFinalGradePercentageCell = document.createElement('td');
        let percentage = (negativeFinalGrades / totalFinalGrades) * 100;
        negativeFinalGradePercentageCell.textContent = percentage.toFixed(1) + '%';
        // set color based on percentage, 0 green, 0-10 yellow, 10-30 orange, 30+ red white text, 50+ black bg white text
        negativeFinalGradePercentageCell.style.backgroundColor =
          percentage > 50
            ? 'black'
            : percentage > 30
              ? '#ff3333'
              : percentage > 10
                ? 'orange'
                : percentage > 0
                  ? 'yellow'
                  : '#92D293';
        negativeFinalGradePercentageCell.style.color = percentage > 30 ? 'white' : 'black';
        row.insertBefore(negativeFinalGradePercentageCell, row.children[columnDataOffset + colspan]);
        row.insertBefore(negativeFinalGradeCell, row.children[columnDataOffset + colspan]);
        row.insertBefore(negativePeriodGradePercentageCell, row.children[columnDataOffset + colspan]);
        row.insertBefore(negativePeriodGradeCell, row.children[columnDataOffset + colspan]);
      }
    });

    // Update summary header colspans
    headerSummaryColumn.setAttribute('colspan', colspan + newColumnsToBeAdded);
    headerSummaryColumn2.setAttribute('colspan', colspan + newColumnsToBeAdded);
    // Insert new header cells
    let negativePeriodGradeHeader = document.createElement('th');
    negativePeriodGradeHeader.textContent = 'Neg. perioodi hinded';
    let negativePeriodGradePercentageHeader = document.createElement('th');
    negativePeriodGradePercentageHeader.textContent = 'Neg. perioodi %';
    let negativeFinalGradeHeader = document.createElement('th');
    negativeFinalGradeHeader.textContent = 'Neg. lõpuhinded';
    let negativeFinalGradePercentageHeader = document.createElement('th');
    negativeFinalGradePercentageHeader.textContent = 'Neg. lõpuhinde %';
    headerRows[2].insertBefore(negativeFinalGradePercentageHeader, headerRows[2].children[columnDataOffset + colspan]);
    headerRows[2].insertBefore(negativeFinalGradeHeader, headerRows[2].children[columnDataOffset + colspan]);
    headerRows[2].insertBefore(negativePeriodGradePercentageHeader, headerRows[2].children[columnDataOffset + colspan]);
    headerRows[2].insertBefore(negativePeriodGradeHeader, headerRows[2].children[columnDataOffset + colspan]);
  }
  //#endregion

  //#region Päeviku nimekirja vaate täiendused
  function addMyJournals() {
    const schoolId = 14;
    const teacherId = JSON.parse(localStorage.getItem('currentTeacherId'));
    if (!teacherId && !document.querySelector('#main-content')) {
      return null;
    }
    let mainContent = document.querySelector('#main-content');
    let myJournals = document.createElement('div');
    myJournals.classList.add('layout-padding');
    let label = document.createElement('label');
    label.textContent = 'Tänased tunnid';
    label.classList.add('md-title-small');
    myJournals.appendChild(label);

    // prepare start and end dates for this week, from monday to sunday
    let today = new Date();
    //today = new Date("2024-11-07"); // for mockup
    let todayStr = today.toISOString().split('T')[0];

    let day = today.getDay();
    let diff = today.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
    // format the dates to yyyy-mm-ddT00:00:00Z
    let monday = new Date(today.setDate(diff)).toISOString().split('T')[0] + 'T00:00:00Z';
    let sunday = new Date(today.setDate(diff + 6)).toISOString().split('T')[0] + 'T00:00:00Z';

    // Query this week timetable
    fetch(
      `${TAHVEL_API_URL}/timetableevents/timetableByTeacher/${schoolId}?from=${monday}&lang=ET&teachers=${teacherId}&thru=${sunday}`,
      { headers: { accept: 'application/json' } }
    )
      .then(r => r.json())
      .then(timetable => {
        let alreadyAdded = [];
        let todaysEvents = timetable.timetableEvents.filter(te => te.journalId && te.date.startsWith(todayStr));
        todaysEvents.forEach(te => {
          // Filter out events that are today, skip duplicates
          if (alreadyAdded.includes(te.journalId)) {
            return;
          }
          alreadyAdded.push(te.journalId);

          // Add a link to the journal
          let room = te.rooms.length > 0 ? te.rooms[0].roomCode : '';
          let studentGroups = te.studentGroups.map(sg => sg.code).join(', ');

          let journalLink = document.createElement('a');
          journalLink.href = `#/journal/${te.journalId}/edit`;
          //journalLink.target = "_blank";
          journalLink.textContent = te.nameEt + ' ' + room + ' ' + studentGroups;
          journalLink.style.paddingBottom = '5px';
          journalLink.style.display = 'block';
          myJournals.appendChild(journalLink);
        });

        if (alreadyAdded.length === 0) {
          let noEvents = document.createElement('i');
          noEvents.textContent = 'Tänaseid päevikuid ei leitud';
          noEvents.style.display = 'block';
          myJournals.appendChild(noEvents);
        }
      });

    mainContent.firstChild.after(myJournals);
    return myJournals;
  }
  //#endregion

  //#region Vabade ruumide tabelile täiendavad veerud: kohtade arv, arvutite arv, pindala, tahvel, OS
  function cloneCellStyle(fromEl, toEl) {
    const computedStyle = window.getComputedStyle(fromEl);
    toEl.style.padding = computedStyle.padding;
    toEl.style.font = computedStyle.font;
    toEl.style.verticalAlign = computedStyle.verticalAlign;
    toEl.style.lineHeight = computedStyle.lineHeight;
    toEl.style.height = computedStyle.height;
    toEl.style.borderTop = computedStyle.borderTop;
    toEl.style.borderBottom = computedStyle.borderBottom;
    toEl.style.textAlign = computedStyle.textAlign;
  }

  function injectSeatInfoToColumn(roomData) {
    const table = document.querySelector('table.md-table');
    const firstRow = table?.querySelector('tbody tr');
    const headerRow = table?.querySelector('thead tr');

    if (!table || !firstRow) return;

    // Check if headers need to be injected
    if (!isAlreadyApplied(headerRow)) {
      // Lisa uus päise veerg: Arvuteid (positsioon 3)
      const computersHeader = document.createElement('th');
      computersHeader.textContent = 'Arvuteid';
      headerRow.insertBefore(computersHeader, headerRow.children[3]);
      cloneCellStyle(headerRow.children[2], computersHeader);

      // Lisa uus päise veerg: Pindala (positsioon 4)
      const areaHeader = document.createElement('th');
      areaHeader.textContent = 'Pindala';
      headerRow.insertBefore(areaHeader, headerRow.children[4]);
      cloneCellStyle(headerRow.children[2], areaHeader);

      // Lisa uus päise veerg: Tahvel (positsioon 5)
      const boardHeader = document.createElement('th');
      boardHeader.textContent = 'Tahvel';
      headerRow.insertBefore(boardHeader, headerRow.children[5]);
      cloneCellStyle(headerRow.children[2], boardHeader);

      // Lisa uus päise veerg: OS (positsioon 6)
      const osHeader = document.createElement('th');
      osHeader.textContent = 'OS';
      headerRow.insertBefore(osHeader, headerRow.children[6]);
      cloneCellStyle(headerRow.children[2], osHeader);

      addAppliedMarker(headerRow);
    }

    // Check if data needs to be processed (check first row for content changes)
    if (!isAlreadyApplied(firstRow)) {
      const rows = table.querySelectorAll('tbody tr');
      console.log('Injecting seat info into room table');

      // Adjust index if already applied, 4 new columns added
      const headerCells = table.querySelectorAll('thead th');
      const headers = Array.from(headerCells).map(th =>
        th.textContent.trim().replace(/\n/g, '').replace(/\s+/g, ' ').toLowerCase()
      );

      const roomColIndex = headers.findIndex(text => text === 'ruum');
      const numberOfNewColumnsBeforeSeatsCol = 4;
      const seatsColIndex = headers.findIndex(text => text === 'kohtadearv') - numberOfNewColumnsBeforeSeatsCol;
      console.log('roomColIndex:', roomColIndex, 'seatsColIndex:', seatsColIndex);

      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const roomCell = cells[roomColIndex];
        const roomText = roomCell?.textContent.trim() ?? '';

        const match = roomData.find(r => r.roomNumber === roomText);

        // Täida kohtade arv, kui match leitud
        if (match && cells[seatsColIndex] && seatsColIndex !== -1) {
          cells[seatsColIndex].textContent = `${match.seats}`;
        }

        // Lisa uus lahter: arvutite arv
        const computersCell = document.createElement('td');
        computersCell.textContent = match?.computers ?? '';
        row.insertBefore(computersCell, row.children[3]);
        cloneCellStyle(row.children[2], computersCell);

        // Lisa uus lahter: pindala
        const areaCell = document.createElement('td');
        areaCell.textContent = match?.area ? `${match.area}m²` : '';
        row.insertBefore(areaCell, row.children[4]);
        cloneCellStyle(row.children[2], areaCell);

        // Lisa uus lahter: tahvel
        const boardCell = document.createElement('td');
        boardCell.textContent = match?.board ?? '';
        row.insertBefore(boardCell, row.children[5]);
        cloneCellStyle(row.children[2], boardCell);

        // Lisa uus lahter: os
        const osCell = document.createElement('td');
        osCell.textContent = match?.os ?? '';
        row.insertBefore(osCell, row.children[6]);
        cloneCellStyle(row.children[2], osCell);
      });

      // Mark first row as processed to detect content changes
      addAppliedMarker(firstRow);
    }
  }
  //#endregion

  //#region XHR intercept to avoid duplicate requests in some cases
  let xhrInterceptors = [];
  /**
   * @param {function(url:string):boolean} filterFn
   * @param {function(data:any):void} callback
   */
  function addXHRInterceptor(filterFn, callback) {
    xhrInterceptors.push({ filterFn, callback });
  }

  // Store the original open and send methods
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  // Override the open method to capture the request URL
  XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
    this._requestURL = url; // Store the request URL for later use
    this._requestMethod = method; // Optionally store the method too (GET, POST, etc.)

    // Call the original open method
    return originalOpen.apply(this, arguments);
  };

  // Override the send method to intercept the request and access the stored URL
  XMLHttpRequest.prototype.send = function (body) {
    const xhrInstance = this;

    // Add an event listener to capture the response after the request completes
    this.addEventListener('readystatechange', function () {
      if (xhrInstance.readyState === XMLHttpRequest.DONE) {
        //console.log('XHR Intercepted:');
        //console.log('Request URL:', xhrInstance._requestURL);  // Access the stored URL
        //console.log('Response Status:', xhrInstance.status);
        //console.log('Response Body:', xhrInstance.responseText);

        xhrInterceptors.forEach(interceptor => {
          if (interceptor.filterFn(xhrInstance._requestURL)) {
            try {
              interceptor.callback(JSON.parse(xhrInstance.responseText));
            } catch (e) {
              interceptor.callback(xhrInstance.responseText);
            }
          }
        });
      }
    });

    // Call the original send method, preserving any existing logic
    return originalSend.apply(this, arguments);
  };
  //#endregion

  //#region XHR interceptors
  // Detect current logged in user and get necessary id's and store them in localstorage
  addXHRInterceptor(
    url => url.includes('hois_back/changeUser') || url.includes('hois_back/user'),
    data => {
      console.log('currentTeacherId:', data.teacher);
      if (data?.teacher) {
        localStorage.setItem('currentTeacherId', JSON.stringify(data.teacher));
      }
      if (data?.school?.id) {
        localStorage.setItem('schoolId', JSON.stringify(data.school.id));
      }
      // Collecting userscript usage statistics, once an hour
      if (data?.name || data?.fullname) {
        let lastUsage = localStorage.getItem('lastUsage');
        if (!lastUsage || Date.now() - lastUsage > 3600000) {
          localStorage.setItem('lastUsage', Date.now());
          //fetch("https://api.countapi.xyz/hit/tahvel-userscripts/" + data.?name + "_" + data.?fullname);
        }
      }
    }
  );

  // Rühmajuhataja aruanne
  addXHRInterceptor(
    url => url.includes('hois_back/reports/studentgroupteacher'),
    data => {
      // Download class-teacher raport for grants as a JSON
      if (oppetoetus) {
        let a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
        let fileName = document.querySelector('[aria-label="Õpperühm"]').value ?? 'class-teacher-report';
        a.download = `${fileName}.json`;
        a.click();
      }

      currentClassTeacherReport = data;
    }
  );

  // Get current student data, https://tahvel.edu.ee/hois_back/students/12345
  addXHRInterceptor(
    url => url.match(/hois_back\/students\/\d+$/) !== null,
    data => {
      currentStudent = data;
    }
  );
  //#endregion

  //#region Student modules
  addXHRInterceptor(
    url => url.match(/hois_back\/students\/\d+\/vocationalResults$/),
    data => {
      currentStudentModules = data;
    }
  );
})();

/**
 * Ma ei tea veel kas teha hardcoded eesliidese järgi pikkused või teha gruppide päringu ajal arvutus ja cacheda see localstorage-sse.
 * https://tahvel.edu.ee/hois_back/autocomplete/studentgroups?lang=ET
 */
function getAllGroupDurations(groups) {
  let durations = {};
  groups.forEach(data => {
    const groupCode = data.nameEt.split('-')[0];

    // Calculate duration in years
    const validFrom = new Date(data.validFrom);
    const validThru = new Date(data.validThru);
    const durationMilliseconds = validThru - validFrom;
    const durationYears = durationMilliseconds / (1000 * 60 * 60 * 24 * 365.25);
    durations[groupCode] = durationYears;
    //allgroups.push({ groupCode, durationYears, data })
  });
  return durations;
}

function simulateTyping(inputElement, text, latency, interResponseTime) {
  inputElement.value = text;
  inputElement.dispatchEvent(new Event('input', { bubbles: true }));
}

function hook(scope, original, after) {
  return function () {
    original.apply(scope, arguments);
    try {
      after.apply(scope, arguments);
    } catch (e) {
      console.error(e);
    }
  };
}

const SissekandedEnum = {
  SISSEKANNE_EX: 'Eksam',
  SISSEKANNE_E: 'E-õpe',
  SISSEKANNE_H: 'Hindamine',
  SISSEKANNE_HO: 'Hoolsus',
  SISSEKANNE_I: 'Iseseisev töö',
  SISSEKANNE_C: 'Kontrolltöö',
  SISSEKANNE_KU: 'Kursuse hinne',
  SISSEKANNE_K: 'Käitumine',
  SISSEKANNE_L: 'Lõpptulemus',
  SISSEKANNE_R: 'Perioodi hinne',
  SISSEKANNE_P: 'Praktiline töö',
  SISSEKANNE_T: 'Tund',
  SISSEKANNE_O: 'Õpiväljund',
};

function getCsrfToken() {
  const match = document.cookie.match(new RegExp('(^| )XSRF-TOKEN=([^;]+)'));
  if (match) {
    return decodeURIComponent(match[2]);
  }
  return null;
}
