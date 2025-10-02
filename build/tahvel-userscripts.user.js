// ==UserScript==
// @name         Täiendatud Tahvel Õpetajale
// @namespace    https://tahvel.edu.ee/
// @version      1.2.7
// @description  Tahvlile mõned UI täiendused, mis parandavad tundide sisestamist ja hindamist.
// @author       Timo Triisa
// @match        https://tahvel.edu.ee/*
// @updateURL    https://raw.githubusercontent.com/Tallinna-Polutehnikum/tahvel-userscripts/main/build/tahvel-userscripts.user.js
// @downloadURL  https://raw.githubusercontent.com/Tallinna-Polutehnikum/tahvel-userscripts/main/build/tahvel-userscripts.user.js
// @grant        GM_log
// @require      https://cdn.jsdelivr.net/npm/chart.js
// ==/UserScript==
(() => {
  // src/features/randomRequest.js
  setInterval(() => {
    fetch("https://tahvel.edu.ee/hois_back/user", {
      method: "GET",
      credentials: "include",
      headers: {
        "accept": "application/json, text/plain, */*"
      }
    });
    console.log("session extended at: " + /* @__PURE__ */ new Date());
  }, 12e4);

  // src/version.js
  var version = "1.2.7";

  // src/features/usageLogger.js
  setTimeout(async () => {
    const response = await fetch(`https://tahvel.edu.ee/hois_back/user`);
    const userData = await response.json();
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    const raw = JSON.stringify({
      "user": userData.fullname,
      "version": version
    });
    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow"
    };
    const today = /* @__PURE__ */ new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const numericDate = `${year}${month.toString().padStart(2, "0")}${day.toString().padStart(2, "0")}`;
    if (!["ROLL_T", "ROLL_X", "ROLL_L"].includes(userData.roleCode)) {
      if (!localStorage.getItem("lastPost") || numericDate - localStorage.getItem("lastPost") >= 1) {
        localStorage.setItem("lastPost", numericDate);
        fetch("https://boringreallife.com/api/tahvel/last-usage", requestOptions).then((response2) => response2.text()).then((result) => console.log(result)).catch((error) => console.error(error));
      }
    }
  }, 0);

  // src/features/teachers.js
  if (typeof GM_log === "function")
    console.log = GM_log;
  (function() {
    "use strict";
    console.log("Tahvel Customization script started");
    let oppetoetus = false;
    const style = document.createElement("style");
    style.textContent = `
        /* Hinnete dropdown oleks pikem*/
        md-select-menu, md-select-menu md-content {
            max-height: 300px;
        }
        /* r\xFChmajuhataja aruande tabelis nimed scrolliks kaasa */
        .tertiary-table student-group-teacher-table tbody td:nth-child(2) {
            position: sticky;
            left: 0;
            background: white; /* Prevents content from being hidden under scrolling elements */
            z-index: 2; /* Ensures it stays above other cells */
        }
    `;
    document.head.appendChild(style);
    let currentStudent = null;
    let currentClassTeacherReport = null;
    let currentStudentModules = null;
    observeTargetChange(document.body, () => {
      let firstPath = window.location.href.match(/#\/([^\?\/]*)/)?.[1];
      let id = window.location.href.match(/\/(\d+)\//)?.[1] ?? "";
      id = id.length > 0 ? ` #${id}` : "";
      let lastBreadcrumb = document.querySelector("#breadcrumb-wrapper > span:last-child")?.textContent.trim() || firstPath || "Tahvel";
      document.title = lastBreadcrumb + id;
      if (window.location.href.indexOf("journal") > -1) {
        const journalTableRows = document.querySelectorAll(".tahvel-table tr");
        if (journalTableRows?.length > 2 && !isAlreadyApplied(journalTableRows[1])) {
          console.log("In journal, add average grade column");
          addAverageGradeColumn();
          journalEntryTooltips();
          columnBackgroundColors();
          addAppliedMarker(journalTableRows[1]);
        }
        let homeworkDesc = document.querySelector("[ng-model='journalEntry.homework']");
        if (homeworkDesc && !isAlreadyApplied(homeworkDesc)) {
          console.log("In journal edit, add homework description listener");
          journalEntryNotifyStudent(homeworkDesc);
        }
        let batchGrade = document.querySelector(".mass-grade");
        console.log(batchGrade);
        if (batchGrade && batchGrade.textContent.includes("Hinde korraga") && !isAlreadyApplied(batchGrade)) {
          journalEntryBatchAbsent(batchGrade);
          addAppliedMarker(batchGrade);
        }
      }
      if (window.location.href.indexOf("students") > -1) {
        let table = document.querySelector(".md-table");
        let marker = document.querySelector(".md-table tbody > tr > td:nth-child(1)");
        if (table && !isAlreadyApplied(marker)) {
          console.log("In students, append age to PIN");
          appendAgeToPin();
          addAppliedMarker(marker);
        }
      }
      let studentId = window.location.href.match(/students\/(\d+)/)?.[1];
      if (/students\/.*\/results/.test(window.location.href) && document.querySelector(`.md-active[aria-label='Sooritamise j\xE4rjekorras']`)) {
        let table = document.querySelector(`[ng-show="resultsCurrentNavItem === 'student.inOrderOfPassing'"]`);
        let tableRows = table.querySelectorAll("tbody tr");
        if (table && tableRows.length > 5 && !isAlreadyApplied(table)) {
          negativeResultsToolsInStudentProfile(table, studentId);
          addAppliedMarker(table);
        }
      }
      if (/students\/.*\/results/.test(window.location.href) && document.querySelector(`.md-active[aria-label='\xD5ppekava t\xE4itmine']`)) {
        let firstModule = document.querySelector(".hois-collapse-parent div:first-of-type > span");
        if (firstModule && !isAlreadyApplied(firstModule)) {
          console.log("In student profile, add module and journal links", currentStudent?.id != studentId, currentStudent?.id, studentId);
          if (currentStudent?.id == studentId) {
            addAppliedMarker(firstModule);
            studentProfileModuleAndJournalLinks(studentId);
          }
        }
        ;
      }
      if (window.location.href.indexOf("reports/studentgroupteacher") > -1) {
        let groupSelect = document.querySelector(`md-autocomplete[md-floating-label="\xD5pper\xFChm"] input`);
        if (groupSelect && !isAlreadyApplied(groupSelect)) {
          console.log("In R\xFChmajuhendaja aruanne, update parameters after group selection");
          groupSelect.addEventListener("change", () => {
            setTimeout(() => {
              updateRJAParameters(groupSelect.value);
            }, 200);
          });
          addAppliedMarker(groupSelect);
        }
        let groupSelectOptions = [...document.querySelectorAll(`md-option[ng-value="studentGroup"]`)];
        if (groupSelectOptions.length && !isAlreadyApplied(groupSelectOptions[0])) {
          console.log("In R\xFChmajuhendaja aruanne, update parameters after group selection");
          groupSelectOptions.forEach((option) => {
            option.addEventListener("click", () => {
              setTimeout(() => {
                updateRJAParameters(groupSelect.value);
              }, 200);
            });
          });
          addAppliedMarker(groupSelectOptions[0]);
        }
        let table = document.querySelector(".student-group-teacher-table");
        let isTableLoaded = table && table.querySelector("tbody tr:first-child td:nth-child(2) span:not([class])");
        if (isTableLoaded && !isAlreadyApplied(table)) {
          console.log("In R\xFChmajuhendaja aruanne, add summary data to table");
          addSummaryDataToRJA(table);
          addAppliedMarker(table);
        }
      }
      if (window.location.href.indexOf("#/journals?_menu") > -1) {
        let myJournals = document.querySelector("#main-content > div:nth-of-type(2)");
        if (myJournals && !isAlreadyApplied(myJournals)) {
          console.log("In journals list, add today's journals first");
          myJournals = addMyJournals();
          if (myJournals)
            addAppliedMarker(myJournals);
        }
      }
    });
    function observeTargetChange(targetNode, callback) {
      const observer = new MutationObserver((mutationsList, observer2) => {
        for (let mutation of mutationsList) {
          if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
            observer2.disconnect();
            callback();
            observer2.observe(targetNode, { childList: true, subtree: true });
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
      return element.dataset.userscriptApplied === "true";
    }
    const gradePalette = {
      5: "#b3ffb3",
      // Light green
      4: "#b3ffb3",
      // Light green
      3: "#ffffb3",
      // Light yellow
      2: "#ffb3b3",
      // Light red
      1: "#ffb3b3",
      // Light red
      0: "#ffb3b3"
      // Light red
    };
    function calculateAverageGrade(grades) {
      let total = 0;
      let count = 0;
      grades.forEach((grade) => {
        let lastGrade = grade.trim().split("/").pop().trim();
        if (lastGrade === "MA" || lastGrade === "X")
          lastGrade = "0";
        const parsedGrade = parseFloat(lastGrade);
        if (!isNaN(parsedGrade)) {
          total += parsedGrade;
          count++;
        }
      });
      const averageGrade = count > 0 ? (total / count).toFixed(1) : "0.0";
      return [averageGrade, total];
    }
    function addAverageGradeColumn() {
      const observer = new MutationObserver(() => {
        const gradeTable = document.querySelector("#studentTable");
        if (gradeTable) {
          observer.disconnect();
          console.log("Found table!");
          const tableHeaders = gradeTable.querySelectorAll('.tahvel-table th.header-cell:not([style*="background-color: rgb(224, 231, 255)"]):not([style*="background-color: rgb(249, 168, 212)"])');
          const periodGradeHeaders = gradeTable.querySelectorAll('.tahvel-table th[style*="background-color: rgb(224, 231, 255)"]');
          const finalGradeHeader = gradeTable.querySelector('.tahvel-table th[style*="background-color: rgb(249, 168, 212)"]');
          const gradeColumnIndices = Array.from(tableHeaders).map((th) => th.cellIndex);
          let periodGradeColumnIndices = Array.from(periodGradeHeaders).map((th) => th.cellIndex);
          console.log(periodGradeColumnIndices);
          let usedFinalGradeAsPeriodGrade = false;
          if (periodGradeColumnIndices.length === 0) {
            if (finalGradeHeader) {
              periodGradeColumnIndices = [finalGradeHeader.cellIndex];
              usedFinalGradeAsPeriodGrade = true;
            } else {
              periodGradeColumnIndices = [gradeTable.querySelectorAll(".tahvel-table thead th").length - 1];
              usedFinalGradeAsPeriodGrade = true;
            }
          }
          console.log("Period grade columns", periodGradeColumnIndices);
          const rows = gradeTable.querySelectorAll(".tahvel-table tr");
          const headerRow = rows[0];
          [...gradeTable.querySelectorAll('.tahvel-table th[aria-label*="Keskmine hinne"]')].forEach((header) => header.remove());
          [...gradeTable.querySelectorAll('.tahvel-table th[aria-label*="Hinnete summa"]')].forEach((header) => header.remove());
          [...gradeTable.querySelectorAll('.tahvel-table th[aria-label*="Perioodide hinded"]')].forEach((header) => header.remove());
          for (let i = 0; i < periodGradeColumnIndices.length; i++) {
            const narrowColumnHeader = document.createElement("th");
            narrowColumnHeader.textContent = "Keskm.";
            narrowColumnHeader.setAttribute("aria-label", "Keskmine hinne");
            narrowColumnHeader.style.width = "20px";
            narrowColumnHeader.style.padding = "0 2px";
            narrowColumnHeader.style.backgroundColor = "#e2e4f4";
            headerRow.insertBefore(narrowColumnHeader, headerRow.children[periodGradeColumnIndices[i] + i * 2]);
            const totalColumnHeader = document.createElement("th");
            totalColumnHeader.textContent = "Summa";
            totalColumnHeader.setAttribute("aria-label", "Hinnete summa");
            totalColumnHeader.style.width = "20px";
            totalColumnHeader.style.padding = "0 2px";
            totalColumnHeader.style.backgroundColor = "#e2e4f4";
            headerRow.insertBefore(totalColumnHeader, headerRow.children[periodGradeColumnIndices[i] + i * 2]);
          }
          if (finalGradeHeader && !usedFinalGradeAsPeriodGrade) {
            const periodGradesHeader = document.createElement("th");
            periodGradesHeader.textContent = "Perioodide hinded";
            periodGradesHeader.setAttribute("aria-label", "Perioodide hinded");
            periodGradesHeader.style.width = "20px";
            periodGradesHeader.style.padding = "0 2px";
            periodGradesHeader.style.backgroundColor = "#f7b0c8";
            headerRow.insertBefore(periodGradesHeader, finalGradeHeader);
          }
          let totalColumnsAndScores = [];
          rows.forEach((row, rowIndex) => {
            if (rowIndex === 0) return;
            row.addEventListener("mouseover", function() {
              this.style.outline = "2px solid #000";
              this.style.outlineOffset = "-2px";
            });
            row.addEventListener("mouseout", function() {
              this.style.outline = "unset";
            });
            let grades = [];
            let periodGrades = [];
            for (let i = 0; i < periodGradeColumnIndices.length; i++) {
              grades[i] = [];
            }
            let currentPeriodIndex = 0;
            gradeColumnIndices.forEach((columnIndex) => {
              if (columnIndex > periodGradeColumnIndices[currentPeriodIndex]) {
                currentPeriodIndex++;
              }
              if (currentPeriodIndex < periodGradeColumnIndices.length) {
                const gradeCell = row.querySelectorAll("td")[columnIndex];
                const gradeText = gradeCell?.textContent?.trim() ?? "";
                grades[currentPeriodIndex].push(gradeText);
              }
            });
            periodGradeColumnIndices.forEach((columnIndex, index) => {
              const gradeCell = row.querySelectorAll("td")[columnIndex];
              const gradeText = gradeCell?.textContent?.trim() ?? "";
              periodGrades.push(gradeText.trim().split("/").pop().trim());
            });
            for (let pgIndex = 0; pgIndex < periodGradeColumnIndices.length; pgIndex++) {
              const [averageGrade, totalScore] = calculateAverageGrade(grades[pgIndex]);
              const narrowColumnCell = document.createElement("td");
              narrowColumnCell.style.width = "20px";
              narrowColumnCell.style.padding = "0 2px";
              narrowColumnCell.textContent = averageGrade;
              narrowColumnCell.title = row.querySelectorAll("td")?.[1]?.textContent.split(",")?.[0]?.trim() ?? "";
              narrowColumnCell.style.backgroundColor = gradePalette[parseInt(averageGrade)] || "#fff";
              row.insertBefore(narrowColumnCell, row.children[periodGradeColumnIndices[pgIndex] + pgIndex * 2]);
              const totalColumn = document.createElement("td");
              totalColumn.style.width = "20px";
              totalColumn.style.padding = "0 2px";
              totalColumn.textContent = totalScore;
              totalColumn.title = row.querySelectorAll("td")?.[1]?.textContent.split(",")?.[0]?.trim() ?? "";
              if (totalColumnsAndScores[pgIndex] === void 0) {
                totalColumnsAndScores[pgIndex] = [];
              }
              totalColumnsAndScores[pgIndex].push([totalColumn, totalScore]);
              row.insertBefore(totalColumn, row.children[periodGradeColumnIndices[pgIndex] + pgIndex * 2]);
            }
            if (finalGradeHeader && !usedFinalGradeAsPeriodGrade) {
              const periodGradeCell = document.createElement("td");
              periodGradeCell.style.padding = "0 2px";
              periodGradeCell.textContent = periodGrades?.join(" / ") ?? "";
              row.insertBefore(periodGradeCell, row.children[finalGradeHeader.cellIndex - 1]);
            }
          });
          for (let pgIndex = 0; pgIndex < periodGradeColumnIndices.length; pgIndex++) {
            const secondBestTotalScore = totalColumnsAndScores[pgIndex].map(([totalColumn, totalScore]) => totalScore).sort((a, b) => b - a)[1];
            totalColumnsAndScores[pgIndex].forEach(([totalColumn, totalScore]) => {
              const normalizedTotalScore = totalScore / secondBestTotalScore;
              let color = "";
              if (normalizedTotalScore > 0.6)
                color = `rgb(${255 - normalizedTotalScore * 76}, 255, ${255 - normalizedTotalScore * 76})`;
              else
                color = `rgb(255, ${255 - normalizedTotalScore * 76}, ${255 - normalizedTotalScore * 76})`;
              totalColumn.style.backgroundColor = color || "#fff";
            });
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    function columnBackgroundColors() {
      let coloredColumns = {};
      [...document.querySelectorAll(".tahvel-table thead th.bordered")].filter((h) => h.style.cssText.includes("background:") && !h.style.cssText.startsWith("background: rgb(250, 250, 250);")).forEach((h) => coloredColumns[Array.from(h.parentElement.children).indexOf(h)] = h.style.cssText.split(";")[0]);
      Object.entries(coloredColumns).forEach(([columnIndex, bg]) => {
        document.querySelectorAll(`.tahvel-table tbody tr td:nth-child(${Number(columnIndex) + 1})`).forEach((td) => {
          const rgbValues = bg.match(/\d+/g).map(Number);
          let alpha = Math.min(...rgbValues) < 120 ? 0.2 : 0.5;
          td.style.background = `rgba(${rgbValues[0]}, ${rgbValues[1]}, ${rgbValues[2]}, ${alpha})`;
        });
      });
    }
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
      while (table.tagName !== "TABLE") {
        table = table.parentElement;
      }
      let tableBody = table?.querySelector("tbody");
      let headerRow = table.querySelector("thead tr");
      let response1 = await fetch(`https://tahvel.edu.ee/hois_back/journals/${journalId}/journalEntry?lang=ET&page=0&size=100`, {
        "headers": {
          "accept": "application/json, text/plain, */*",
          "accept-language": "en-US,en;q=0.9",
          "sec-ch-ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Microsoft Edge";v="122"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "x-requested-with": "XMLHttpRequest"
        },
        "referrer": "https://tahvel.edu.ee/",
        "referrerPolicy": "strict-origin-when-cross-origin",
        "body": null,
        "method": "GET",
        "mode": "cors",
        "credentials": "include"
      });
      let dataEntries = await response1.json();
      let response2 = await fetch(`https://tahvel.edu.ee/hois_back/journals/${journalId}/journalEntriesByDate?allStudents=false`, {
        "headers": {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.5",
          "X-Requested-With": "XMLHttpRequest",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
          "Pragma": "no-cache",
          "Cache-Control": "no-cache"
        },
        "referrer": "https://tahvel.edu.ee/",
        "method": "GET",
        "mode": "cors",
        "credentials": "include"
      });
      let journalEntries = await response2.json();
      let domIndex = 0;
      let skipHeaders = ["Nr", "\xD5ppija, \xD5pper\xFChm", "Keskm.", "Summa"];
      journalEntries.forEach((dateEntry, entryIndex) => {
        domIndex++;
        let content = headerRow.children[domIndex].textContent;
        while (skipHeaders.includes(content)) {
          domIndex++;
          content = headerRow.children[domIndex].textContent;
        }
        let entry = dataEntries.content.find((dataEntry) => dataEntry.id === dateEntry.id);
        let el = entryDOMs[entryIndex];
        let entryType = SissekandedEnum[entry.entryType];
        if (entry.nameEt !== entryType)
          entryType += ": " + entry.nameEt;
        let tooltipContent = `<b>${entryType}</b><br>${entry.content?.replaceAll("\n", "<br>") ?? ""}`;
        if (entry.homework) {
          let duedate = entry.homeworkDuedate ? new Date(entry.homeworkDuedate).toLocaleDateString("et") : "";
          tooltipContent += `<br><br><b>Kodut\xF6\xF6 ${duedate}</b><br><br>${entry.homework?.replaceAll("\n", "<br>") ?? ""}`;
        }
        let tooltip = createTooltip(el, tooltipContent);
        el.addEventListener("mousemove", (event) => {
          tooltip.style.display = "block";
          tooltip.style.top = event.clientY + 20 + window.scrollY + "px";
          tooltip.style.left = event.clientX - el.getBoundingClientRect().width / 2 + "px";
        });
        el.addEventListener("mouseout", () => {
          if (tooltip.style.display === "block")
            tooltip.style.display = "none";
        });
        let closestTH = el.parentElement;
        while (closestTH && closestTH.tagName !== "TH") {
          closestTH = closestTH.parentElement;
        }
        for (let i = 0; i < tableBody.children.length; i++) {
          let el2 = tableBody.children[i].children[domIndex].querySelector("div.layout-row > div");
          if (!el2) continue;
          el2.addEventListener("mousemove", (event) => {
            tooltip.style.display = "block";
            tooltip.style.top = event.clientY + 46 + window.scrollY + "px";
            tooltip.style.left = event.clientX - el2.getBoundingClientRect().width / 2 + "px";
          });
          el2.addEventListener("mouseout", () => {
            if (tooltip.style.display === "block")
              tooltip.style.display = "none";
          });
        }
      });
      function createTooltip(element, content) {
        let clone;
        if (content === void 0) {
          clone = element.cloneNode(true);
        } else {
          clone = document.createElement("div");
          clone.innerHTML = content;
        }
        clone.style.display = "none";
        clone.style.position = "absolute";
        clone.style.zIndex = 1e3;
        clone.style.backgroundColor = "white";
        clone.style.padding = "5px";
        clone.style.maxWidth = "500px";
        clone.style.pointerEvents = "none";
        document.body.appendChild(clone);
        return clone;
      }
    }
    function journalEntryNotifyStudent(homeworkDesc) {
      let isTestCheckbox = document.querySelector("[ng-model='journalEntry.isTest']");
      homeworkDesc.addEventListener("input", () => {
        if (isTestCheckbox.getAttribute("aria-checked") === (homeworkDesc.value.trim().length > 0 ? "false" : "true")) {
          isTestCheckbox.click();
        }
      });
      addAppliedMarker(homeworkDesc);
      let entryTypeOptions = document.querySelectorAll(`[value^="SISSEKANNE_"]`);
      entryTypeOptions.forEach((option) => {
        option.addEventListener("click", () => {
          let hasHomeworkDescription = homeworkDesc.value.trim().length > 0;
          if (isTestCheckbox.getAttribute("aria-checked") === (option.value === "SISSEKANNE_H" || hasHomeworkDescription ? "false" : "true")) {
            isTestCheckbox.click();
          }
        });
      });
    }
    function journalEntryBatchAbsent(siblingContainer) {
      let batchAbsent = document.createElement("a");
      batchAbsent.href = "#";
      batchAbsent.textContent = " | M\xE4rgi k\xF5ik puudujaks";
      batchAbsent.style.color = "blue";
      batchAbsent.style.cursor = "pointer";
      batchAbsent.addEventListener("click", (event) => {
        event.preventDefault();
        let absentCheckboxes = [...document.querySelectorAll('checkbox[formcontrolname="absenceWithoutReason"] button')];
        let allChecked = absentCheckboxes.every((btn) => btn.matches(":has(div.checked)") === true);
        absentCheckboxes.forEach((btn) => {
          if (allChecked == true) {
            if (btn.matches(":has(div.checked)") === true) {
              btn.click();
            }
          } else {
            if (btn.matches(":has(div.checked)") === false) {
              btn.click();
            }
          }
        });
        absentCheckboxes = [...document.querySelectorAll('checkbox[formcontrolname="absenceWithoutReason"] button')];
        allChecked = absentCheckboxes.every((btn) => btn.matches(":has(div.checked)") === true);
        batchAbsent.textContent = allChecked ? " | M\xE4rgi k\xF5ik kohalolijaks" : " | M\xE4rgi k\xF5ik puudujaks";
      });
      siblingContainer.appendChild(batchAbsent);
    }
    function calculateAgeFromPin(pin) {
      const century = parseInt(pin.substring(0, 1));
      const year = parseInt(pin.substring(1, 3));
      const month = parseInt(pin.substring(3, 5));
      const day = parseInt(pin.substring(5, 7));
      const baseYear = century === 3 || century === 4 ? 1900 : 2e3;
      const birthDate = new Date(baseYear + year, month - 1, day);
      const ageDifMs = Date.now() - birthDate.getTime();
      const ageDate = new Date(ageDifMs);
      return Math.abs(ageDate.getUTCFullYear() - 1970);
    }
    function appendAgeToPin() {
      let elements = [];
      let columnHeader = document.querySelector("[md-order-by='person.idcode']");
      if (columnHeader) {
        let columnNumber = Array.from(columnHeader.parentElement.children).indexOf(columnHeader);
        elements = Array.from(columnHeader.parentElement.parentElement.parentElement.querySelectorAll("tbody > tr > td:nth-child(" + (columnNumber + 1) + ")"));
      }
      elements.forEach((element) => {
        const pin = element.textContent;
        const age = calculateAgeFromPin(pin);
        element.innerHTML = `${pin} <span style="font-weight: ${age < 18 ? "bold" : "normal"}">(${age})</span>`;
      });
    }
    function negativeResultsToolsInStudentProfile(table, studentId) {
      const tableHeaders = table.querySelectorAll("thead th");
      const tableRows = table.querySelectorAll("tbody tr");
      let negativeGrades = 0;
      tableRows.forEach((row) => {
        let type = row.querySelector("td:nth-child(2)").textContent.trim();
        let grade = row.querySelector("td:nth-child(3)").textContent.trim();
        if (["MA", "X", "1", "2"].includes(grade) && type === "L\xF5pptulemus") {
          negativeGrades++;
        }
      });
      let negativeGradesCounter = document.createElement("span");
      negativeGradesCounter.textContent = `Negatiivseid l\xF5pptulemusi: ${negativeGrades}`;
      let onlyNegativeGradesToggle = document.createElement("button");
      onlyNegativeGradesToggle.textContent = "N\xE4ita neg. hindeid";
      onlyNegativeGradesToggle.classList.add("md-button", "md-raised");
      onlyNegativeGradesToggle.style.marginRight = "10px";
      onlyNegativeGradesToggle.dataset.active = "false";
      onlyNegativeGradesToggle.addEventListener("click", () => {
        let active = onlyNegativeGradesToggle.dataset.active === "true";
        onlyNegativeGradesToggle.dataset.active = !active;
        onlyNegativeGradesToggle.textContent = active ? "N\xE4ita neg. hindeid" : "N\xE4ita k\xF5iki hindeid";
        if (active) {
          (function() {
            "use strict";
          })();
          tableRows.forEach((row) => {
            row.style.display = "";
          });
        } else {
          tableRows.forEach((row) => {
            let type = row.querySelector("td:nth-child(2)").textContent.trim();
            let grade = row.querySelector("td:nth-child(3)").textContent.trim();
            if (!["MA", "X", "1", "2"].includes(grade) || type !== "L\xF5pptulemus") {
              row.style.display = "none";
            }
          });
        }
      });
      let hideColumns = [1, 3];
      let hideColumnsToggle = document.createElement("button");
      hideColumnsToggle.textContent = "Peida mittevajalikud veerud";
      hideColumnsToggle.classList.add("md-button", "md-raised");
      hideColumnsToggle.style.marginRight = "10px";
      hideColumnsToggle.dataset.active = "false";
      hideColumnsToggle.addEventListener("click", () => {
        let active = hideColumnsToggle.dataset.active === "true";
        hideColumnsToggle.dataset.active = !active;
        hideColumnsToggle.textContent = active ? "Peida mittevajalikud veerud" : "N\xE4ita k\xF5iki veerge";
        if (active) {
          tableRows.forEach((row) => {
            hideColumns.forEach((index) => {
              row.children[index].style.display = "";
              tableHeaders[index].style.display = "";
            });
          });
        } else {
          tableRows.forEach((row) => {
            hideColumns.forEach((index) => {
              row.children[index].style.display = "none";
              tableHeaders[index].style.display = "none";
            });
          });
        }
      });
      let journalLinkToggle = document.createElement("button");
      journalLinkToggle.textContent = "Lisa p\xE4eviku lingid";
      journalLinkToggle.classList.add("md-button", "md-raised");
      journalLinkToggle.style.marginRight = "10px";
      journalLinkToggle.addEventListener("click", () => {
        fetch(`https://tahvel.edu.ee/hois_back/students/${studentId}/vocationalConnectedEntities`, {
          headers: {
            "accept": "application/json"
          }
        }).then((r) => r.json()).then((data) => {
          tableRows.forEach((row) => {
            let subject = row.querySelector("td:nth-child(1)").textContent.trim().toLowerCase();
            data.forEach((journal) => {
              if (journal.type === "journal" && subject.startsWith(journal.nameEt.toLowerCase())) {
                let journalLink = document.createElement("button");
                journalLink.addEventListener("click", () => {
                  window.open(`#/journal/${journal.entityId}/edit`, "_blank");
                });
                journalLink.textContent = "P\xE4evik";
                row.querySelector("td:nth-child(1)").appendChild(journalLink);
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
    async function studentProfileModuleAndJournalLinks(studentId) {
      const curriculumVersionId = currentStudent?.curriculumVersion?.id;
      const groupCode = currentStudent?.curriculumVersion?.code;
      const modulesDom = document.querySelectorAll(".hois-collapse-parent div:not(.subtext):not([ng-if]):first-of-type > span");
      const journalsDom = document.querySelectorAll(".hois-collapse-body .tahvel-table td:first-of-type > span");
      let moduleProtocolsResponse = await fetch(`https://tahvel.edu.ee/hois_back/moduleProtocols?isVocational=true&curriculumVersion=${curriculumVersionId}&lang=ET&page=0&size=75`, {
        headers: { "accept": "application/json" }
      });
      let moduleProtocols = await moduleProtocolsResponse.json();
      modulesDom.forEach((moduleDom) => {
        let moduleName = moduleDom.textContent.trim().replace(/\s*\([^)]*\)$/, "");
        moduleProtocols.content.filter((mp) => mp.studentGroups.includes(groupCode) && mp.curriculumVersionOccupationModules?.[0]?.nameEt === moduleName).forEach((mp) => {
          let moduleLink = document.createElement("a");
          moduleLink.href = `#/moduleProtocols/module/${mp.id}/edit`;
          moduleLink.target = "_blank";
          moduleLink.textContent = mp.id;
          moduleLink.style.paddingRight = "5px";
          moduleLink.style.fontWeight = "bold";
          moduleLink.style.color = "var(--color-new-primary-blue-1)";
          moduleLink.style.textDecoration = "none";
          moduleDom.appendChild(moduleLink);
        });
        let moduleData = currentStudentModules.curriculumModules.find((m) => m.curriculumModule.nameEt === moduleName);
        if (moduleData) {
          let newModuleLink = document.createElement("a");
          newModuleLink.addEventListener("click", async () => {
            newModuleLink.style.pointerEvents = "none";
            newModuleLink.style.color = "gray";
            newModuleLink.textContent = "Laeb...";
            let studyYearResponse = await fetch("https://tahvel.edu.ee/hois_back/school/studyYear/current-or-next-dto", {
              "credentials": "include",
              "headers": { "Accept": "application/json, text/plain, */*" },
              "method": "GET"
            });
            let studyYear = await studyYearResponse.json();
            let studentsResponse = await await fetch(`https://tahvel.edu.ee/hois_back/moduleProtocols/occupationModule/${studyYear.id}/${moduleData.id}`, {
              "credentials": "include",
              "headers": { "Accept": "application/json, text/plain, */*" },
              "method": "GET"
            });
            let students = await studentsResponse.json();
            let moduleName2 = moduleData.curriculumModule.nameEt;
            if (!(currentStudent.curriculumVersion.id && studyYear.id && students.teacher.id, moduleData.id)) {
              console.log("Module data", moduleData);
              console.log("Students data", students);
              console.log("Study year data", studyYear);
              console.log("Current student data", currentStudent);
              alert("Tekkis viga, vaata konsooli.");
              newModuleLink.style.pointerEvents = "";
              newModuleLink.style.color = "var(--color-new-primary-blue-1)";
              newModuleLink.textContent = "Uus protokoll";
              return;
            }
            let confirmText = `Oled loomas uut protokolli moodulile ${moduleName2}. Moodulile m\xE4\xE4ratakse \xF5ppeaasta ${studyYear.nameEt}, \xF5petajaks ${students.teacher.nameEt} ja lisatakse ${students.occupationModuleStudents.length} \xF5pilast.`;
            if (confirm(confirmText)) {
              let newModuleResponse = await fetch("https://tahvel.edu.ee/hois_back/moduleProtocols", {
                "credentials": "include",
                "headers": {
                  "Accept": "application/json, text/plain, */*",
                  "Content-Type": "application/json;charset=utf-8",
                  "X-XSRF-TOKEN": getCsrfToken()
                },
                "body": JSON.stringify({
                  "protocolVdata": {
                    "curriculumVersionOccupationModule": moduleData.id,
                    "curriculumVersion": currentStudent.curriculumVersion.id,
                    "studyYear": studyYear.id,
                    "teacher": students.teacher.id
                  },
                  "protocolStudents": students.occupationModuleStudents.map((s) => ({ studentId: s.studentId })),
                  "type": "module",
                  "isBasic": false,
                  "isSecondary": false,
                  "isHigher": false,
                  "isVocational": true
                }),
                "method": "POST"
              });
              let newModule = await newModuleResponse.json();
              window.open(`#/moduleProtocols/module/${newModule.id}/edit`, "_blank");
              newModuleLink.style.pointerEvents = "";
              newModuleLink.style.color = "var(--color-new-primary-blue-1)";
              newModuleLink.textContent = "Uus protokoll";
            }
          });
          newModuleLink.textContent = "Uus protokoll";
          newModuleLink.style.paddingRight = "5px";
          newModuleLink.style.color = "var(--color-new-primary-blue-1)";
          newModuleLink.style.textDecoration = "none";
          newModuleLink.style.textTransform = "none";
          newModuleLink.style.border = "1px solid var(--color-new-primary-blue-1)";
          newModuleLink.style.whiteSpace = "nowrap";
          moduleDom.appendChild(newModuleLink);
        }
      });
      let journalsResponse = await fetch(`https://tahvel.edu.ee/hois_back/students/${studentId}/vocationalConnectedEntities`, {
        headers: { "accept": "application/json" }
      });
      let vocationalConnectedEntities = await journalsResponse.json();
      journalsDom.forEach((journal) => {
        let journalName = journal.textContent.trim().replace(/\s*\([^)]*\)$/, "");
        vocationalConnectedEntities.filter((e) => e.type === "journal" && e.nameEt === journalName).forEach((e) => {
          let journalLink = document.createElement("a");
          journalLink.href = `#/journal/${e.entityId}/edit`;
          journalLink.target = "_blank";
          journalLink.textContent = e.entityId;
          journalLink.style.paddingRight = "5px";
          journal.appendChild(journalLink);
        });
      });
    }
    function updateRJAParameters(event) {
      let group = event;
      if (typeof group === "object" && group.nameEt)
        group = group.nameEt;
      let year = parseInt(group.match(/\d+/)[0]) + 2e3;
      let date = new Date(year, 7, 1);
      let previousPeriodYear = (/* @__PURE__ */ new Date()).getFullYear() - 1;
      let endDate = new Date(previousPeriodYear, 11, 31);
      let rjaEntryTypes = [1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      if (oppetoetus) {
        rjaEntryTypes = [1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0];
      }
      for (let i = 0; i < 4; i++) {
        document.querySelectorAll(`[ng-show="formState.showAllParameters"] md-checkbox`).forEach((input, index) => {
          let inputState = input.getAttribute("aria-checked") === "true" ? 1 : 0;
          if (inputState ^ rjaEntryTypes[index])
            input.click();
        });
      }
      let dateInput = document.querySelector(`[ng-model="criteria.from"] input`);
      dateInput.click();
      dateInput.value = "";
      let startDate = date.toLocaleDateString("et", { day: "2-digit", month: "2-digit", year: "numeric" });
      simulateTyping(dateInput, startDate, 10, 10);
      if (oppetoetus) {
        let dateInput2 = document.querySelector(`[ng-model="criteria.thru"] input`);
        dateInput2.click();
        dateInput2.value = "";
        let endDateStr = endDate.toLocaleDateString("et", { day: "2-digit", month: "2-digit", year: "numeric" });
        simulateTyping(dateInput2, endDateStr, 10, 10);
      }
      document.querySelector(`[ng-model="criteria.studyYear"]`).click();
      setTimeout(() => {
        document.querySelector(`.md-select-menu-container.md-active.md-clickable md-option`).click();
      }, 120);
    }
    function addSummaryDataToRJA(table) {
      const newColumnsToBeAdded = 6;
      const periodGradeClassifier = "R";
      const finalGradeClassifier = "L";
      let studentGradesMap = /* @__PURE__ */ new Map();
      currentClassTeacherReport.students.forEach((student) => {
        let totalFinalGrades = 0;
        let totalPeriodGrades = 0;
        let negativeFinalGrades = 0;
        let negativePeriodGrades = 0;
        student.resultColumns.forEach((resultColumn) => {
          let fresult = resultColumn?.journalResult?.results;
          if (fresult?.length) {
            fresult.forEach((result) => {
              if (result.entryType.endsWith(periodGradeClassifier)) {
                if (result.grade.code.endsWith("MA") || result.grade.code.endsWith("X") || result.grade.code.endsWith("1") || result.grade.code.endsWith("2")) {
                  negativeFinalGrades++;
                }
                totalFinalGrades++;
              } else if (result.entryType.endsWith(finalGradeClassifier)) {
                if (result.grade.code.endsWith("MA") || result.grade.code.endsWith("X") || result.grade.code.endsWith("1") || result.grade.code.endsWith("2")) {
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
          negativeFinalGrades
        });
      });
      table = document.querySelector(".student-group-teacher-table");
      const columnDataOffset = 2;
      let headerRows = table.querySelectorAll("thead tr");
      let headerSummaryColumn = headerRows[0].querySelector("th:last-child");
      let headerSummaryColumn2 = headerRows[1].querySelector("th:last-child");
      let colspan = parseInt(headerSummaryColumn.getAttribute("colspan"));
      let headerCells = headerRows[2].querySelectorAll("th");
      let lastCells = Array.from(headerCells).slice(-colspan);
      let lastCellIndex = Array.from(headerCells).indexOf(lastCells[0]);
      headerRows[0].insertBefore(headerSummaryColumn, headerRows[0].children[1]);
      headerRows[1].insertBefore(headerSummaryColumn2, headerRows[1].children[1]);
      let bodyRows = table.querySelectorAll("tbody tr");
      lastCells.forEach((cell, ci) => {
        headerRows[2].insertBefore(cell, headerRows[columnDataOffset].children[columnDataOffset + ci]);
        bodyRows.forEach((row) => {
          row.insertBefore(row.children[lastCellIndex + ci], row.children[columnDataOffset + ci]);
        });
      });
      bodyRows.forEach((row) => {
        let studentName = row.children[columnDataOffset - 1]?.querySelector("span:not([class]):not([ng-if])")?.textContent.trim();
        if (studentGradesMap.has(studentName)) {
          const { totalPeriodGrades, negativePeriodGrades, totalFinalGrades, negativeFinalGrades } = studentGradesMap.get(studentName);
          let negativePeriodGradeCell = document.createElement("td");
          negativePeriodGradeCell.textContent = negativePeriodGrades;
          let negativePeriodGradePercentageCell = document.createElement("td");
          negativePeriodGradePercentageCell.textContent = (negativePeriodGrades / totalPeriodGrades * 100).toFixed(1) + "%";
          let negativeFinalGradeCell = document.createElement("td");
          negativeFinalGradeCell.textContent = negativeFinalGrades;
          let negativeFinalGradePercentageCell = document.createElement("td");
          let percentage = negativeFinalGrades / totalFinalGrades * 100;
          negativeFinalGradePercentageCell.textContent = percentage.toFixed(1) + "%";
          negativeFinalGradePercentageCell.style.backgroundColor = percentage > 50 ? "black" : percentage > 30 ? "#ff3333" : percentage > 10 ? "orange" : percentage > 0 ? "yellow" : "#92D293";
          negativeFinalGradePercentageCell.style.color = percentage > 30 ? "white" : "black";
          row.insertBefore(negativeFinalGradePercentageCell, row.children[columnDataOffset + colspan]);
          row.insertBefore(negativeFinalGradeCell, row.children[columnDataOffset + colspan]);
          row.insertBefore(negativePeriodGradePercentageCell, row.children[columnDataOffset + colspan]);
          row.insertBefore(negativePeriodGradeCell, row.children[columnDataOffset + colspan]);
        }
      });
      headerSummaryColumn.setAttribute("colspan", colspan + newColumnsToBeAdded);
      headerSummaryColumn2.setAttribute("colspan", colspan + newColumnsToBeAdded);
      let negativePeriodGradeHeader = document.createElement("th");
      negativePeriodGradeHeader.textContent = "Neg. perioodi hinded";
      let negativePeriodGradePercentageHeader = document.createElement("th");
      negativePeriodGradePercentageHeader.textContent = "Neg. perioodi %";
      let negativeFinalGradeHeader = document.createElement("th");
      negativeFinalGradeHeader.textContent = "Neg. l\xF5puhinded";
      let negativeFinalGradePercentageHeader = document.createElement("th");
      negativeFinalGradePercentageHeader.textContent = "Neg. l\xF5puhinde %";
      headerRows[2].insertBefore(negativeFinalGradePercentageHeader, headerRows[2].children[columnDataOffset + colspan]);
      headerRows[2].insertBefore(negativeFinalGradeHeader, headerRows[2].children[columnDataOffset + colspan]);
      headerRows[2].insertBefore(negativePeriodGradePercentageHeader, headerRows[2].children[columnDataOffset + colspan]);
      headerRows[2].insertBefore(negativePeriodGradeHeader, headerRows[2].children[columnDataOffset + colspan]);
    }
    function addMyJournals() {
      const schoolId = 14;
      const teacherId = JSON.parse(localStorage.getItem("currentTeacherId"));
      if (!teacherId && !document.querySelector("#main-content")) {
        return null;
      }
      let mainContent = document.querySelector("#main-content");
      let myJournals = document.createElement("div");
      myJournals.classList.add("layout-padding");
      let label = document.createElement("label");
      label.textContent = "T\xE4nased tunnid";
      label.classList.add("md-title-small");
      myJournals.appendChild(label);
      let today = /* @__PURE__ */ new Date();
      let todayStr = today.toISOString().split("T")[0];
      let day = today.getDay();
      let diff = today.getDate() - day + (day == 0 ? -6 : 1);
      let monday = new Date(today.setDate(diff)).toISOString().split("T")[0] + "T00:00:00Z";
      let sunday = new Date(today.setDate(diff + 6)).toISOString().split("T")[0] + "T00:00:00Z";
      fetch(`https://tahvel.edu.ee/hois_back/timetableevents/timetableByTeacher/${schoolId}?from=${monday}&lang=ET&teachers=${teacherId}&thru=${sunday}`, {
        headers: {
          "accept": "application/json"
        }
      }).then((r) => r.json()).then((timetable) => {
        let alreadyAdded = [];
        let todaysEvents = timetable.timetableEvents.filter((te) => te.journalId && te.date.startsWith(todayStr));
        todaysEvents.forEach((te) => {
          if (alreadyAdded.includes(te.journalId)) {
            return;
          }
          alreadyAdded.push(te.journalId);
          let room = te.rooms.length > 0 ? te.rooms[0].roomCode : "";
          let studentGroups = te.studentGroups.map((sg) => sg.code).join(", ");
          let journalLink = document.createElement("a");
          journalLink.href = `#/journal/${te.journalId}/edit`;
          journalLink.textContent = te.nameEt + " " + room + " " + studentGroups;
          journalLink.style.paddingBottom = "5px";
          journalLink.style.display = "block";
          myJournals.appendChild(journalLink);
        });
        if (alreadyAdded.length === 0) {
          let noEvents = document.createElement("i");
          noEvents.textContent = "T\xE4naseid p\xE4evikuid ei leitud";
          noEvents.style.display = "block";
          myJournals.appendChild(noEvents);
        }
      });
      mainContent.firstChild.after(myJournals);
      return myJournals;
    }
    let xhrInterceptors = [];
    function addXHRInterceptor(filterFn, callback) {
      xhrInterceptors.push({ filterFn, callback });
    }
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
      this._requestURL = url;
      this._requestMethod = method;
      return originalOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function(body) {
      const xhrInstance = this;
      this.addEventListener("readystatechange", function() {
        if (xhrInstance.readyState === XMLHttpRequest.DONE) {
          xhrInterceptors.forEach((interceptor) => {
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
      return originalSend.apply(this, arguments);
    };
    addXHRInterceptor((url) => url.includes("hois_back/changeUser") || url.includes("hois_back/user"), (data) => {
      console.log("currentTeacherId:", data.teacher);
      if (data?.teacher) {
        localStorage.setItem("currentTeacherId", JSON.stringify(data.teacher));
      }
      if (data?.school?.id) {
        localStorage.setItem("schoolId", JSON.stringify(data.school.id));
      }
      if (data?.name || data?.fullname) {
        let lastUsage = localStorage.getItem("lastUsage");
        if (!lastUsage || Date.now() - lastUsage > 36e5) {
          localStorage.setItem("lastUsage", Date.now());
        }
      }
    });
    addXHRInterceptor((url) => url.includes("hois_back/reports/studentgroupteacher"), (data) => {
      if (oppetoetus) {
        let a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
        let fileName = document.querySelector('[aria-label="\xD5pper\xFChm"]').value ?? "class-teacher-report";
        a.download = `${fileName}.json`;
        a.click();
      }
      currentClassTeacherReport = data;
    });
    addXHRInterceptor((url) => url.match(/hois_back\/students\/\d+$/) !== null, (data) => {
      currentStudent = data;
    });
    addXHRInterceptor((url) => url.match(/hois_back\/students\/\d+\/vocationalResults$/), (data) => {
      currentStudentModules = data;
    });
  })();
  function simulateTyping(inputElement, text, latency, interResponseTime) {
    inputElement.value = text;
    inputElement.dispatchEvent(new Event("input", { bubbles: true }));
  }
  var SissekandedEnum = {
    "SISSEKANNE_EX": "Eksam",
    "SISSEKANNE_E": "E-\xF5pe",
    "SISSEKANNE_H": "Hindamine",
    "SISSEKANNE_HO": "Hoolsus",
    "SISSEKANNE_I": "Iseseisev t\xF6\xF6",
    "SISSEKANNE_C": "Kontrollt\xF6\xF6",
    "SISSEKANNE_KU": "Kursuse hinne",
    "SISSEKANNE_K": "K\xE4itumine",
    "SISSEKANNE_L": "L\xF5pptulemus",
    "SISSEKANNE_R": "Perioodi hinne",
    "SISSEKANNE_P": "Praktiline t\xF6\xF6",
    "SISSEKANNE_T": "Tund",
    "SISSEKANNE_O": "\xD5piv\xE4ljund"
  };
  function getCsrfToken() {
    const match = document.cookie.match(new RegExp("(^| )XSRF-TOKEN=([^;]+)"));
    if (match) {
      return decodeURIComponent(match[2]);
    }
    return null;
  }

  // src/features/gradeHistory.js
  var exampleData = {
    grades: [
      { date: "29.09", negativeGrades: "1", fineGrades: "3", goodGrades: "5", greatGrades: "5" },
      { date: "07.10", negativeGrades: "2", fineGrades: "4", goodGrades: "6", greatGrades: "6" },
      { date: "14.10", negativeGrades: "1", fineGrades: "4", goodGrades: "7", greatGrades: "7" },
      { date: "21.10", negativeGrades: "3", fineGrades: "5", goodGrades: "8", greatGrades: "8" },
      { date: "28.10", negativeGrades: "2", fineGrades: "5", goodGrades: "9", greatGrades: "9" },
      { date: "04.11", negativeGrades: "4", fineGrades: "6", goodGrades: "10", greatGrades: "10" },
      { date: "11.11", negativeGrades: "2", fineGrades: "6", goodGrades: "11", greatGrades: "11" },
      { date: "18.11", negativeGrades: "3", fineGrades: "7", goodGrades: "12", greatGrades: "12" },
      { date: "25.11", negativeGrades: "1", fineGrades: "7", goodGrades: "13", greatGrades: "13" },
      { date: "02.12", negativeGrades: "2", fineGrades: "8", goodGrades: "14", greatGrades: "14" },
      { date: "09.12", negativeGrades: "3", fineGrades: "8", goodGrades: "15", greatGrades: "15" },
      { date: "16.12", negativeGrades: "2", fineGrades: "9", goodGrades: "16", greatGrades: "16" },
      { date: "23.12", negativeGrades: "5", fineGrades: "9", goodGrades: "17", greatGrades: "17" },
      { date: "30.12", negativeGrades: "6", fineGrades: "10", goodGrades: "18", greatGrades: "18" },
      { date: "06.01", negativeGrades: "8", fineGrades: "11", goodGrades: "19", greatGrades: "19" },
      { date: "13.01", negativeGrades: "10", fineGrades: "12", goodGrades: "20", greatGrades: "20" },
      { date: "20.01", negativeGrades: "9", fineGrades: "13", goodGrades: "21", greatGrades: "21" },
      { date: "27.01", negativeGrades: "7", fineGrades: "14", goodGrades: "22", greatGrades: "22" },
      { date: "03.02", negativeGrades: "6", fineGrades: "15", goodGrades: "23", greatGrades: "23" },
      { date: "10.02", negativeGrades: "5", fineGrades: "16", goodGrades: "24", greatGrades: "24" },
      { date: "17.02", negativeGrades: "4", fineGrades: "17", goodGrades: "25", greatGrades: "25" },
      { date: "24.02", negativeGrades: "3", fineGrades: "18", goodGrades: "26", greatGrades: "26" },
      { date: "03.03", negativeGrades: "2", fineGrades: "19", goodGrades: "27", greatGrades: "27" },
      { date: "10.03", negativeGrades: "2", fineGrades: "20", goodGrades: "28", greatGrades: "28" },
      { date: "17.03", negativeGrades: "1", fineGrades: "21", goodGrades: "29", greatGrades: "29" }
    ],
    absences: [
      { date: "29.09", withReason: "2", noReason: "1", metric: "90" },
      { date: "29.09", withReason: "3", noReason: "2", metric: "80" },
      { date: "29.09", withReason: "4", noReason: "3", metric: "70" },
      { date: "29.09", withReason: "5", noReason: "4", metric: "60" }
    ]
  };
  var hash = window.location.hash;
  var simpleMode = true;
  var graphType = "grades";
  function createGraph() {
    if (hash.includes("/results") || hash.includes("/myResults")) {
      const init = () => {
        const mainContent = document.querySelector("#main-content");
        const fieldSet = mainContent?.querySelector("fieldset");
        if (mainContent && fieldSet) {
          let graph = mainContent.querySelector("#gradeHistoryGraph");
          if (!graph) {
            graph = createGraphElements(fieldSet);
          }
          initChart(graph);
          return true;
        }
        return false;
      };
      if (!init()) {
        const observer = new MutationObserver(() => {
          if (init()) {
            observer.disconnect();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }
  }
  createGraph();
  window.addEventListener("hashchange", () => {
    hash = window.location.hash;
    createGraph();
  });
  function processData(data) {
    let processedData = {
      grades: {
        dates: [],
        negativeGrades: [],
        positiveGrades: [],
        fineGrades: [],
        goodGrades: [],
        greatGrades: [],
        gradeTotal: []
      },
      absences: {
        dates: [],
        noReason: [],
        withReason: [],
        absencesTotal: [],
        lessons: []
      }
    };
    data.grades.forEach((e) => {
      processedData.grades.dates.push(e.date);
      processedData.grades.negativeGrades.push(e.negativeGrades);
      processedData.grades.positiveGrades.push(+e.fineGrades + +e.goodGrades + +e.greatGrades);
      processedData.grades.fineGrades.push(e.fineGrades);
      processedData.grades.goodGrades.push(e.goodGrades);
      processedData.grades.greatGrades.push(e.greatGrades);
      processedData.grades.gradeTotal.push(+e.negativeGrades + +e.fineGrades + +e.goodGrades + +e.greatGrades);
    });
    data.absences.forEach((e) => {
      processedData.absences.dates.push(e.date);
      processedData.absences.noReason.push(e.noReason);
      processedData.absences.withReason.push(e.withReason);
      processedData.absences.absencesTotal.push(+e.noReason + +e.withReason);
      processedData.absences.lessons.push((+e.noReason + +e.withReason) * 100 / +e.metric);
    });
    return processedData;
  }
  function graphData(data, graphType2) {
    let datasetSimple = [
      { label: "negatiivseid hindeid", data: data.grades.negativeGrades, borderWidth: 2, borderColor: "#eb3b5a", backgroundColor: "#fc5c65", fill: true, stack: "grades" },
      { label: "positiivseid hindeid", data: data.grades.positiveGrades, borderWidth: 2, borderColor: "#20bf6b", backgroundColor: "#26de81", fill: true, stack: "grades" }
    ];
    let datasetAdvanced = [
      { label: "negatiivseid hindeid", data: data.grades.negativeGrades, borderWidth: 2, borderColor: "#eb3b5a", backgroundColor: "#fc5c65", fill: true, stack: "grades" },
      { label: "rahuldavaid hindeid", data: data.grades.fineGrades, borderWidth: 2, borderColor: "#fa8231", backgroundColor: "#fd9644", fill: true, stack: "grades" },
      { label: "h\xE4id hindeid", data: data.grades.goodGrades, borderWidth: 2, borderColor: "#f7b731", backgroundColor: "#fed330", fill: true, stack: "grades" },
      { label: "suurep\xE4raseid hindeid", data: data.grades.greatGrades, borderWidth: 2, borderColor: "#20bf6b", backgroundColor: "#26de81", fill: true, stack: "grades" }
    ];
    if (graphType2 == "grades") {
      return {
        labels: data.grades.dates,
        datasets: [
          ...simpleMode ? datasetSimple : datasetAdvanced,
          {
            label: "hindeid kokku",
            data: data.grades.gradeTotal,
            borderColor: "#4b6584",
            backgroundColor: "#778ca3"
          }
        ]
      };
    } else if (graphType2 == "absences") {
      return {
        labels: data.absences.dates,
        datasets: [
          {
            label: "p\xF5hjuseta puudumised",
            data: data.absences.noReason,
            borderWidth: 2,
            borderColor: "#a5b1c2",
            backgroundColor: "#d1d8e0",
            fill: true,
            stack: "absences"
          },
          {
            label: "p\xF5hjusega puudumised",
            data: data.absences.withReason,
            borderWidth: 2,
            borderColor: "#3867d6",
            backgroundColor: "#4b7bec",
            fill: true,
            stack: "absences"
          },
          {
            label: "puudumisi kokku",
            data: data.absences.absencesTotal,
            borderColor: "#2d98da",
            backgroundColor: "#45aaf2",
            fill: true,
            stack: "none"
          },
          {
            label: "tunde kokku",
            data: data.absences.lessons,
            borderColor: "#4b6584",
            backgroundColor: "#778ca3",
            fill: true
          }
        ]
      };
    }
  }
  function createGraphElements(previousElement) {
    const gradeHistory = document.createElement("div");
    gradeHistory.style.border = "1px solid #d9d9d6";
    gradeHistory.style.margin = "2px";
    gradeHistory.id = "graphContainer";
    const graphControlls = document.createElement("div");
    const graphDataBtn = document.createElement("a");
    graphDataBtn.id = "graphDataBtn";
    graphDataBtn.className = "md-raised md-primary md-button md-ink-ripple";
    graphDataBtn.text = "Hinnete vaade";
    const graphModeBtn = document.createElement("a");
    graphModeBtn.id = "graphModeBtn";
    graphModeBtn.className = "md-raised md-secondary md-button md-ink-ripple";
    graphModeBtn.text = "Lihtne vaade";
    graphDataBtn.addEventListener("click", () => {
      graphType = graphType === "grades" ? "absences" : "grades";
      graphDataBtn.text = graphDataBtn.text === "Hinnete vaade" ? "Puudumiste vaade" : "Hinnete vaade";
      document.querySelector("#graphModeBtn").style.display = graphDataBtn.text === "Hinnete vaade" ? "inline-block" : "none";
      createGraph();
    });
    graphModeBtn.addEventListener("click", () => {
      simpleMode = !simpleMode;
      graphModeBtn.text = graphModeBtn.text === "Lihtne vaade" ? "T\xE4iustatud vaade" : "Lihtne vaade";
      createGraph();
    });
    graphControlls.appendChild(graphDataBtn);
    graphControlls.appendChild(graphModeBtn);
    const graph = document.createElement("canvas");
    graph.id = "gradeHistoryGraph";
    graph.height = 75;
    gradeHistory.appendChild(graphControlls);
    gradeHistory.appendChild(graph);
    previousElement.after(gradeHistory);
    return graph;
  }
  function initChart(graph) {
    let processedData = processData(exampleData, simpleMode);
    let myChart = Chart.getChart(graph);
    if (!myChart) {
      myChart = new Chart(graph, {
        type: "line",
        data: graphData(processedData, graphType),
        options: {
          plugins: {
            tooltip: {
              mode: "index",
              intersect: false
            },
            legend: {
              labels: {
                filter: (legendItem) => legendItem.text !== "hindeid kokku" && legendItem.text !== "puudumisi kokku"
              }
            }
          },
          scales: {
            y: {
              stacked: true
            }
          }
        }
      });
      return;
    }
    myChart.data = graphData(processedData, graphType);
    myChart.update();
  }
})();
