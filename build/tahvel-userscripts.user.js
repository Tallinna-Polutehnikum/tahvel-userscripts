// ==UserScript==
// @name         Täiendatud Tahvel Õpetajale
// @namespace    https://tahvel.edu.ee/
// @version      1.5.6
// @description  Tahvlile mõned UI täiendused, mis parandavad tundide sisestamist ja hindamist.
// @author       Timo Triisa, Sven Laht
// @match        https://tahvel.edu.ee/*
// @match        https://tahveltp.edu.ee/*
// @updateURL    https://bit.ly/tahvel-userscript
// @downloadURL  https://bit.ly/tahvel-userscript
// @grant        GM_log
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @require      https://cdn.jsdelivr.net/npm/chart.js
// ==/UserScript==

(() => {
  // src/modules/sessionKeepAlive.js
  setInterval(() => {
    fetch("https://tahvel.edu.ee/hois_back/user", {
      method: "GET",
      credentials: "include",
      headers: { accept: "application/json, text/plain, */*" }
    });
  }, 12e4);

  // src/version.js
  var version = "1.5.6";

  // src/modules/usageLogger.js
  setTimeout(async () => {
    const response = await fetch(`https://tahvel.edu.ee/hois_back/user`);
    const userData = await response.json();
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    const raw = JSON.stringify({ user: userData.fullname, version });
    const requestOptions = { method: "POST", headers: myHeaders, body: raw, redirect: "follow" };
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

  // src/core/xhrInterceptor.js
  var xhrInterceptors = [];
  function addXHRInterceptor(filterFn, callback) {
    xhrInterceptors.push({ filterFn, callback });
  }
  var originalOpen = XMLHttpRequest.prototype.open;
  var originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._requestURL = url;
    this._requestMethod = method;
    return originalOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    const xhr = this;
    this.addEventListener("readystatechange", function() {
      if (xhr.readyState !== XMLHttpRequest.DONE) return;
      for (const { filterFn, callback } of xhrInterceptors) {
        if (!filterFn(xhr._requestURL)) continue;
        try {
          callback(JSON.parse(xhr.responseText));
        } catch {
          callback(xhr.responseText);
        }
      }
    });
    return originalSend.apply(this, arguments);
  };
  var _currentStudent = null;
  var _currentClassTeacherReport = null;
  var _currentStudentModules = null;
  function getCurrentStudent() {
    return _currentStudent;
  }
  function getCurrentClassTeacherReport() {
    return _currentClassTeacherReport;
  }
  function getCurrentStudentModules() {
    return _currentStudentModules;
  }
  addXHRInterceptor(
    (url) => url.includes("hois_back/changeUser") || url.includes("hois_back/user"),
    (data) => {
      if (data?.teacher) {
        localStorage.setItem("currentTeacherId", JSON.stringify(data.teacher));
      }
      if (data?.school?.id) {
        localStorage.setItem("schoolId", JSON.stringify(data.school.id));
      }
    }
  );
  addXHRInterceptor(
    (url) => url.includes("hois_back/reports/studentgroupteacher"),
    (data) => {
      _currentClassTeacherReport = data;
    }
  );
  addXHRInterceptor(
    (url) => url.match(/hois_back\/students\/\d+$/) !== null,
    (data) => {
      _currentStudent = data;
    }
  );
  addXHRInterceptor(
    (url) => url.match(/hois_back\/students\/\d+\/vocationalResults$/) !== null,
    (data) => {
      _currentStudentModules = data;
    }
  );

  // src/core/settings.js
  var STORAGE_PREFIX = "tahvelUserscripts.features.";
  var registry = [];
  function registerFeature(descriptor) {
    registry.push(descriptor);
  }
  function isFeatureEnabled(id) {
    const stored = localStorage.getItem(STORAGE_PREFIX + id);
    if (stored !== null) return stored === "true";
    const topLevel = registry.find((f) => f.id === id);
    if (topLevel) return topLevel.defaultEnabled;
    for (const feature of registry) {
      const sub = (feature.settings ?? []).find((s) => s.id === id);
      if (sub) return sub.defaultEnabled;
    }
    return true;
  }
  function generateMenuItems() {
    if (typeof GM_registerMenuCommand !== "function") return;
    for (const feature of registry) {
      const enabled = isFeatureEnabled(feature.id);
      GM_registerMenuCommand(
        `${enabled ? "\u2713" : "\u2717"} ${feature.label}`,
        () => {
          localStorage.setItem(STORAGE_PREFIX + feature.id, String(!enabled));
          alert(`"${feature.label}" ${!enabled ? "lubatud" : "keelatud"}. Laadi leht uuesti.`);
        }
      );
      for (const sub of feature.settings ?? []) {
        const subEnabled = isFeatureEnabled(sub.id);
        GM_registerMenuCommand(
          `\xA0\xA0${subEnabled ? "\u2713" : "\u2717"} ${sub.label}`,
          () => {
            localStorage.setItem(STORAGE_PREFIX + sub.id, String(!subEnabled));
            alert(`"${sub.label}" ${!subEnabled ? "lubatud" : "keelatud"}. Laadi leht uuesti.`);
          }
        );
      }
    }
  }

  // src/core/observer.js
  var handlers = [];
  function registerFeatureHandler(handler) {
    handlers.push(handler);
  }
  function addAppliedMarker(element) {
    if (!element) return;
    element.dataset.userscriptApplied = "true";
  }
  function isAlreadyApplied(element) {
    if (!element) return false;
    return element.dataset.userscriptApplied === "true";
  }
  function observeTargetChange(targetNode, callback) {
    const observer = new MutationObserver((mutationsList, obs) => {
      for (const mutation of mutationsList) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          obs.disconnect();
          callback();
          obs.observe(targetNode, { childList: true, subtree: true });
          return;
        }
      }
    });
    observer.observe(targetNode, { childList: true, subtree: true });
    return observer;
  }
  function initObserver() {
    observeTargetChange(document.body, async () => {
      const url = window.location.href;
      const dom = document;
      for (const handler of handlers) {
        if (!isFeatureEnabled(handler.featureId)) {
          handler.cleanup?.(url, dom);
          continue;
        }
        if (handler.match(url, dom)) {
          await handler.run(url, dom);
        } else {
          handler.cleanup?.(url, dom);
        }
      }
    });
  }

  // src/modules/journal/averageGrade.js
  registerFeature({
    id: "journal.averageGrade",
    label: "P\xE4evikus keskmised hinded",
    description: "Lisab p\xE4eviku tabelisse keskmise hinde ja summa veerud perioodi- ja l\xF5pphinnete k\xF5rvale.",
    defaultEnabled: true
  });
  registerFeatureHandler({
    featureId: "journal.averageGrade",
    match: (url) => url.includes("journal"),
    run(_url, dom) {
      const journalTableRows = dom.querySelectorAll(".tahvel-table tr");
      if (journalTableRows?.length > 2 && !isAlreadyApplied(journalTableRows[1])) {
        addAverageGradeColumn();
        columnBackgroundColors();
        addAppliedMarker(journalTableRows[1]);
      }
    }
  });
  var gradePalette = {
    5: "#b3ffb3",
    4: "#b3ffb3",
    3: "#ffffb3",
    2: "#ffb3b3",
    1: "#ffb3b3",
    0: "#ffb3b3"
  };
  function calculateAverageGrade(grades) {
    let total = 0;
    let count = 0;
    for (const grade of grades) {
      let lastGrade = grade.trim().split("/").pop().trim();
      if (lastGrade === "MA" || lastGrade === "X") lastGrade = "0";
      const parsed = parseFloat(lastGrade);
      if (!isNaN(parsed)) {
        total += parsed;
        count++;
      }
    }
    return [count > 0 ? (total / count).toFixed(1) : "0.0", total];
  }
  function addAverageGradeColumn() {
    const observer = new MutationObserver(() => {
      const gradeTable = document.querySelector("#studentTable");
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
      const gradeColumnIndices = Array.from(tableHeaders).map((th) => th.cellIndex);
      let periodGradeColumnIndices = Array.from(periodGradeHeaders).map((th) => th.cellIndex);
      let usedFinalGradeAsPeriodGrade = false;
      if (periodGradeColumnIndices.length === 0) {
        if (finalGradeHeader) {
          periodGradeColumnIndices = [finalGradeHeader.cellIndex];
        } else {
          periodGradeColumnIndices = [gradeTable.querySelectorAll(".tahvel-table thead th").length - 1];
        }
        usedFinalGradeAsPeriodGrade = true;
      }
      const rows = gradeTable.querySelectorAll(".tahvel-table tr");
      const headerRow = rows[0];
      [...gradeTable.querySelectorAll('.tahvel-table th[aria-label*="Keskmine hinne"]')].forEach((h) => h.remove());
      [...gradeTable.querySelectorAll('.tahvel-table th[aria-label*="Hinnete summa"]')].forEach((h) => h.remove());
      [...gradeTable.querySelectorAll('.tahvel-table th[aria-label*="Perioodide hinded"]')].forEach((h) => h.remove());
      for (let i = 0; i < periodGradeColumnIndices.length; i++) {
        const avgHeader = document.createElement("th");
        avgHeader.textContent = "Keskm.";
        avgHeader.setAttribute("aria-label", "Keskmine hinne");
        avgHeader.style.cssText = "width:20px;padding:0 2px;background-color:#e2e4f4";
        headerRow.insertBefore(avgHeader, headerRow.children[periodGradeColumnIndices[i] + i * 2]);
        const sumHeader = document.createElement("th");
        sumHeader.textContent = "Summa";
        sumHeader.setAttribute("aria-label", "Hinnete summa");
        sumHeader.style.cssText = "width:20px;padding:0 2px;background-color:#e2e4f4";
        headerRow.insertBefore(sumHeader, headerRow.children[periodGradeColumnIndices[i] + i * 2]);
      }
      if (finalGradeHeader && !usedFinalGradeAsPeriodGrade) {
        const periodGradesHeader = document.createElement("th");
        periodGradesHeader.textContent = "Perioodide hinded";
        periodGradesHeader.setAttribute("aria-label", "Perioodide hinded");
        periodGradesHeader.style.cssText = "width:20px;padding:0 2px;background-color:#f7b0c8";
        headerRow.insertBefore(periodGradesHeader, finalGradeHeader);
      }
      const totalColumnsAndScores = [];
      rows.forEach((row, rowIndex) => {
        if (rowIndex === 0) return;
        row.addEventListener("mouseover", function() {
          this.style.outline = "2px solid #000";
          this.style.outlineOffset = "-2px";
        });
        row.addEventListener("mouseout", function() {
          this.style.outline = "unset";
        });
        const grades = Array.from({ length: periodGradeColumnIndices.length }, () => []);
        const periodGrades = [];
        let currentPeriodIndex = 0;
        for (const columnIndex of gradeColumnIndices) {
          if (columnIndex > periodGradeColumnIndices[currentPeriodIndex]) currentPeriodIndex++;
          if (currentPeriodIndex < periodGradeColumnIndices.length) {
            const cell = row.querySelectorAll("td")[columnIndex];
            grades[currentPeriodIndex].push(cell?.textContent?.trim() ?? "");
          }
        }
        for (const columnIndex of periodGradeColumnIndices) {
          const cell = row.querySelectorAll("td")[columnIndex];
          periodGrades.push((cell?.textContent?.trim() ?? "").split("/").pop().trim());
        }
        for (let pgIndex = 0; pgIndex < periodGradeColumnIndices.length; pgIndex++) {
          const [averageGrade, totalScore] = calculateAverageGrade(grades[pgIndex]);
          const studentName = row.querySelectorAll("td")?.[1]?.textContent.split(",")?.[0]?.trim() ?? "";
          const avgCell = document.createElement("td");
          avgCell.style.cssText = "width:20px;padding:0 2px";
          avgCell.textContent = averageGrade;
          avgCell.title = studentName;
          avgCell.style.backgroundColor = gradePalette[parseInt(averageGrade)] || "#fff";
          row.insertBefore(avgCell, row.children[periodGradeColumnIndices[pgIndex] + pgIndex * 2]);
          const sumCell = document.createElement("td");
          sumCell.style.cssText = "width:20px;padding:0 2px";
          sumCell.textContent = totalScore;
          sumCell.title = studentName;
          if (!totalColumnsAndScores[pgIndex]) totalColumnsAndScores[pgIndex] = [];
          totalColumnsAndScores[pgIndex].push([sumCell, totalScore]);
          row.insertBefore(sumCell, row.children[periodGradeColumnIndices[pgIndex] + pgIndex * 2]);
        }
        if (finalGradeHeader && !usedFinalGradeAsPeriodGrade) {
          const periodGradeCell = document.createElement("td");
          periodGradeCell.style.padding = "0 2px";
          periodGradeCell.textContent = periodGrades.join(" / ");
          row.insertBefore(periodGradeCell, row.children[finalGradeHeader.cellIndex - 1]);
        }
      });
      for (let pgIndex = 0; pgIndex < periodGradeColumnIndices.length; pgIndex++) {
        const scores = totalColumnsAndScores[pgIndex] ?? [];
        const secondBest = scores.map(([, s]) => s).sort((a, b) => b - a)[1] ?? 1;
        for (const [cell, score] of scores) {
          const n = score / secondBest;
          const color = n > 0.6 ? `rgb(${255 - n * 76}, 255, ${255 - n * 76})` : `rgb(255, ${255 - n * 76}, ${255 - n * 76})`;
          cell.style.backgroundColor = color;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function columnBackgroundColors() {
    const coloredColumns = {};
    [...document.querySelectorAll(".tahvel-table thead th.bordered")].filter((h) => h.style.cssText.includes("background:") && !h.style.cssText.startsWith("background: rgb(250, 250, 250);")).forEach((h) => coloredColumns[Array.from(h.parentElement.children).indexOf(h)] = h.style.cssText.split(";")[0]);
    for (const [columnIndex, bg] of Object.entries(coloredColumns)) {
      const rgbValues = bg.match(/\d+/g).map(Number);
      const alpha = Math.min(...rgbValues) < 120 ? 0.2 : 0.5;
      document.querySelectorAll(`.tahvel-table tbody tr td:nth-child(${Number(columnIndex) + 1})`).forEach((td) => {
        td.style.background = `rgba(${rgbValues[0]}, ${rgbValues[1]}, ${rgbValues[2]}, ${alpha})`;
      });
    }
  }

  // src/core/config.js
  var TAHVEL_API_URL = window.location.origin + "/hois_back";

  // src/modules/journal/utils.js
  var SissekandedEnum = {
    SISSEKANNE_EX: "Eksam",
    SISSEKANNE_E: "E-\xF5pe",
    SISSEKANNE_H: "Hindamine",
    SISSEKANNE_HO: "Hoolsus",
    SISSEKANNE_I: "Iseseisev t\xF6\xF6",
    SISSEKANNE_C: "Kontrollt\xF6\xF6",
    SISSEKANNE_KU: "Kursuse hinne",
    SISSEKANNE_K: "K\xE4itumine",
    SISSEKANNE_L: "L\xF5pptulemus",
    SISSEKANNE_R: "Perioodi hinne",
    SISSEKANNE_P: "Praktiline t\xF6\xF6",
    SISSEKANNE_T: "Tund",
    SISSEKANNE_O: "\xD5piv\xE4ljund"
  };

  // src/modules/journal/entryTooltips.js
  registerFeature({
    id: "journal.entryTooltips",
    label: "P\xE4eviku kande kirjeldused",
    description: "Hiirega kuup\xE4eva peale liikumisel n\xE4itab tunni kirjeldust ja kodut\xF6\xF6 infot.",
    defaultEnabled: true
  });
  registerFeatureHandler({
    featureId: "journal.entryTooltips",
    match: (url) => url.includes("journal"),
    run() {
      return journalEntryTooltips();
    }
  });
  async function journalEntryTooltips() {
    const journalId = window.location.href.match(/journal\/(\d+)/)?.[1];
    if (!journalId) return;
    const entryDOMs = document.querySelectorAll(`[ng-if^="journalEntry.entryType.code"]`);
    if (entryDOMs.length === 0) return;
    let table = entryDOMs[0];
    while (table.tagName !== "TABLE") table = table.parentElement;
    const tableBody = table?.querySelector("tbody");
    const headerRow = table.querySelector("thead tr");
    const [res1, res2] = await Promise.all([
      fetch(`${TAHVEL_API_URL}/journals/${journalId}/journalEntry?lang=ET&page=0&size=100`, {
        headers: { "accept": "application/json, text/plain, */*", "x-requested-with": "XMLHttpRequest" },
        method: "GET",
        mode: "cors",
        credentials: "include"
      }),
      fetch(`${TAHVEL_API_URL}/journals/${journalId}/journalEntriesByDate?allStudents=false`, {
        headers: { "Accept": "application/json, text/plain, */*", "X-Requested-With": "XMLHttpRequest" },
        method: "GET",
        mode: "cors",
        credentials: "include"
      })
    ]);
    const dataEntries = await res1.json();
    const journalEntries = await res2.json();
    const skipHeaders = ["Nr", "\xD5ppija, \xD5pper\xFChm", "Keskm.", "Summa"];
    let domIndex = 0;
    journalEntries.forEach((dateEntry, entryIndex) => {
      domIndex++;
      let content = headerRow.children[domIndex]?.textContent;
      while (content && skipHeaders.includes(content)) {
        domIndex++;
        content = headerRow.children[domIndex]?.textContent;
      }
      const entry = dataEntries.content.find((d) => d.id === dateEntry.id);
      if (!entry) return;
      const el = entryDOMs[entryIndex];
      const entryType = SissekandedEnum[entry.entryType] ?? entry.entryType;
      const typeLabel = entry.nameEt !== entryType ? `${entryType}: ${entry.nameEt}` : entryType;
      let tooltipHtml = `<b>${typeLabel}</b><br>${entry.content?.replaceAll("\n", "<br>") ?? ""}`;
      if (entry.homework) {
        const due = entry.homeworkDuedate ? new Date(entry.homeworkDuedate).toLocaleDateString("et") : "";
        tooltipHtml += `<br><br><b>Kodut\xF6\xF6 ${due}</b><br><br>${entry.homework?.replaceAll("\n", "<br>") ?? ""}`;
      }
      const tooltip = createTooltip(tooltipHtml);
      const attachTooltip = (target, offsetY) => {
        target.addEventListener("mousemove", (event) => {
          tooltip.style.display = "block";
          tooltip.style.top = event.clientY + offsetY + window.scrollY + "px";
          tooltip.style.left = event.clientX - target.getBoundingClientRect().width / 2 + "px";
        });
        target.addEventListener("mouseout", () => {
          if (tooltip.style.display === "block") tooltip.style.display = "none";
        });
      };
      attachTooltip(el, 20);
      for (let i = 0; i < tableBody.children.length; i++) {
        const cell = tableBody.children[i].children[domIndex]?.querySelector("div.layout-row > div");
        if (cell) attachTooltip(cell, 46);
      }
    });
  }
  function createTooltip(htmlContent) {
    const div = document.createElement("div");
    div.innerHTML = htmlContent;
    div.style.cssText = "display:none;position:absolute;z-index:1000;background:white;padding:5px;max-width:500px;pointer-events:none";
    document.body.appendChild(div);
    return div;
  }

  // src/modules/journal/batchAbsent.js
  registerFeature({
    id: "journal.batchAbsent",
    label: "K\xF5ik puudujaks korraga",
    description: "Lisab p\xE4eviku kande popupile nupu, mis m\xE4rgib k\xF5ik \xF5pilased korraga puudujaks v\xF5i kohalviibijateks.",
    defaultEnabled: true
  });
  registerFeatureHandler({
    featureId: "journal.batchAbsent",
    match: (url) => url.includes("journal"),
    run() {
      const batchGrade = document.querySelector(".mass-grade");
      if (batchGrade && batchGrade.textContent.includes("Hinde korraga") && !isAlreadyApplied(batchGrade)) {
        journalEntryBatchAbsent(batchGrade);
        addAppliedMarker(batchGrade);
      }
    }
  });
  function journalEntryBatchAbsent(siblingContainer) {
    const link = document.createElement("a");
    link.href = "#";
    link.textContent = " | M\xE4rgi k\xF5ik puudujaks";
    link.style.cssText = "color:blue;cursor:pointer";
    link.addEventListener("click", (event) => {
      event.preventDefault();
      let checkboxes = [...document.querySelectorAll('checkbox[formcontrolname="absenceWithoutReason"] button')];
      const allChecked = checkboxes.every((btn) => btn.matches(":has(div.checked)"));
      checkboxes.forEach((btn) => {
        if (allChecked) {
          if (btn.matches(":has(div.checked)")) btn.click();
        } else {
          if (!btn.matches(":has(div.checked)")) btn.click();
        }
      });
      checkboxes = [...document.querySelectorAll('checkbox[formcontrolname="absenceWithoutReason"] button')];
      const nowAllChecked = checkboxes.every((btn) => btn.matches(":has(div.checked)"));
      link.textContent = nowAllChecked ? " | M\xE4rgi k\xF5ik kohalolijaks" : " | M\xE4rgi k\xF5ik puudujaks";
    });
    siblingContainer.appendChild(link);
  }

  // src/modules/journal/notifyStudent.js
  registerFeature({
    id: "journal.notifyStudent",
    label: "Kodut\xF6\xF6 teavituse automaatika",
    description: "M\xE4rgib isTest kasti automaatselt kui kodut\xF6\xF6 kirjeldus on t\xE4idetud.",
    defaultEnabled: true
  });
  registerFeatureHandler({
    featureId: "journal.notifyStudent",
    match: (url) => url.includes("journal"),
    run() {
      const homeworkDesc = document.querySelector("[ng-model='journalEntry.homework']");
      if (homeworkDesc && !isAlreadyApplied(homeworkDesc)) {
        journalEntryNotifyStudent(homeworkDesc);
      }
    }
  });
  function journalEntryNotifyStudent(homeworkDesc) {
    const isTestCheckbox = document.querySelector("[ng-model='journalEntry.isTest']");
    homeworkDesc.addEventListener("input", () => {
      const hasHomework = homeworkDesc.value.trim().length > 0;
      if (isTestCheckbox.getAttribute("aria-checked") === (hasHomework ? "false" : "true")) {
        isTestCheckbox.click();
      }
    });
    addAppliedMarker(homeworkDesc);
    const entryTypeOptions = document.querySelectorAll(`[value^="SISSEKANNE_"]`);
    entryTypeOptions.forEach((option) => {
      option.addEventListener("click", () => {
        const hasHomework = homeworkDesc.value.trim().length > 0;
        const shouldBeChecked = option.value === "SISSEKANNE_H" || hasHomework;
        if (isTestCheckbox.getAttribute("aria-checked") === (shouldBeChecked ? "false" : "true")) {
          isTestCheckbox.click();
        }
      });
    });
  }

  // src/modules/studentProfile/agePin.js
  registerFeature({
    id: "studentProfile.agePin",
    label: "\xD5pilase vanus isikukoodi k\xF5rval",
    description: "Arvutab isikukoodist vanuse ja kuvab selle \xF5pilaste nimekirjas isikukoodi j\xE4rel.",
    defaultEnabled: true
  });
  registerFeatureHandler({
    featureId: "studentProfile.agePin",
    match: (url) => url.includes("students"),
    run(_url, dom) {
      const table = dom.querySelector(".md-table");
      const marker = dom.querySelector(".md-table tbody > tr > td:nth-child(1)");
      if (table && !isAlreadyApplied(marker)) {
        appendAgeToPin(dom);
        addAppliedMarker(marker);
      }
    }
  });
  function calculateAgeFromPin(pin) {
    const century = parseInt(pin.substring(0, 1));
    const year = parseInt(pin.substring(1, 3));
    const month = parseInt(pin.substring(3, 5));
    const day = parseInt(pin.substring(5, 7));
    const baseYear = century === 3 || century === 4 ? 1900 : 2e3;
    const birthDate = new Date(baseYear + year, month - 1, day);
    const ageMs = Date.now() - birthDate.getTime();
    return Math.abs(new Date(ageMs).getUTCFullYear() - 1970);
  }
  function appendAgeToPin(dom) {
    const columnHeader = dom.querySelector("[md-order-by='person.idcode']");
    if (!columnHeader) return;
    const columnNumber = Array.from(columnHeader.parentElement.children).indexOf(columnHeader);
    const cells = Array.from(
      columnHeader.parentElement.parentElement.parentElement.querySelectorAll(
        `tbody > tr > td:nth-child(${columnNumber + 1})`
      )
    );
    for (const cell of cells) {
      const pin = cell.textContent.trim();
      const age = calculateAgeFromPin(pin);
      cell.innerHTML = `${pin} <span style="font-weight:${age < 18 ? "bold" : "normal"}">(${age})</span>`;
    }
  }

  // src/modules/studentProfile/negativeResults.js
  registerFeature({
    id: "studentProfile.negativeResults",
    label: "Negatiivsete tulemuste t\xF6\xF6riistad",
    description: 'Lisab "Sooritamise j\xE4rjekorras" vahekaardile filtrid, peidab veerge ja n\xE4itab negatiivsete hinnete arvu.',
    defaultEnabled: true
  });
  registerFeatureHandler({
    featureId: "studentProfile.negativeResults",
    match: (url) => /students\/.*\/results/.test(url),
    run(url, dom) {
      const studentId = url.match(/students\/(\d+)/)?.[1];
      if (!dom.querySelector(`.md-active[aria-label='Sooritamise j\xE4rjekorras']`)) return;
      const table = dom.querySelector(`[ng-show="resultsCurrentNavItem === 'student.inOrderOfPassing'"]`);
      const tableRows = table?.querySelectorAll("tbody tr");
      if (table && tableRows?.length > 5 && !isAlreadyApplied(table)) {
        negativeResultsToolsInStudentProfile(table, tableRows, studentId);
        addAppliedMarker(table);
      }
    }
  });
  function negativeResultsToolsInStudentProfile(table, tableRows, studentId) {
    const tableHeaders = table.querySelectorAll("thead th");
    const NEGATIVE_GRADES = ["MA", "X", "1", "2"];
    const ALL_GRADES = [...NEGATIVE_GRADES, "3", "4", "5", "A"];
    let negativeGrades = 0;
    let totalGrades = 0;
    tableRows.forEach((row) => {
      const type = row.querySelector("td:nth-child(2)")?.textContent.trim();
      const grade = row.querySelector("td:nth-child(3)")?.textContent.trim();
      if (ALL_GRADES.includes(grade) && type === "L\xF5pptulemus") totalGrades++;
      if (NEGATIVE_GRADES.includes(grade) && type === "L\xF5pptulemus") negativeGrades++;
    });
    const pct = totalGrades > 0 ? (negativeGrades / totalGrades * 100).toFixed(0) : 0;
    const counter = document.createElement("span");
    counter.textContent = `Negatiivseid l\xF5pptulemusi: ${negativeGrades} (~${pct}%)`;
    const negToggle = document.createElement("button");
    negToggle.textContent = "N\xE4ita neg. hindeid";
    negToggle.classList.add("md-button", "md-raised");
    negToggle.style.marginRight = "10px";
    negToggle.dataset.active = "false";
    negToggle.addEventListener("click", () => {
      const active = negToggle.dataset.active === "true";
      negToggle.dataset.active = String(!active);
      negToggle.textContent = active ? "N\xE4ita neg. hindeid" : "N\xE4ita k\xF5iki hindeid";
      tableRows.forEach((row) => {
        const type = row.querySelector("td:nth-child(2)")?.textContent.trim();
        const grade = row.querySelector("td:nth-child(3)")?.textContent.trim();
        row.style.display = !active && (!NEGATIVE_GRADES.includes(grade) || type !== "L\xF5pptulemus") ? "none" : "";
      });
    });
    const hideColumns = [1, 3];
    const hideToggle = document.createElement("button");
    hideToggle.textContent = "Peida mittevajalikud veerud";
    hideToggle.classList.add("md-button", "md-raised");
    hideToggle.style.marginRight = "10px";
    hideToggle.dataset.active = "false";
    hideToggle.addEventListener("click", () => {
      const active = hideToggle.dataset.active === "true";
      hideToggle.dataset.active = String(!active);
      hideToggle.textContent = active ? "Peida mittevajalikud veerud" : "N\xE4ita k\xF5iki veerge";
      tableRows.forEach((row) => {
        hideColumns.forEach((i) => {
          row.children[i].style.display = active ? "" : "none";
          tableHeaders[i].style.display = active ? "" : "none";
        });
      });
    });
    const journalBtn = document.createElement("button");
    journalBtn.textContent = "Lisa p\xE4eviku lingid";
    journalBtn.classList.add("md-button", "md-raised");
    journalBtn.style.marginRight = "10px";
    journalBtn.addEventListener("click", () => {
      fetch(`${TAHVEL_API_URL}/students/${studentId}/vocationalConnectedEntities`, {
        headers: { accept: "application/json" }
      }).then((r) => r.json()).then((data) => {
        tableRows.forEach((row) => {
          const subject = row.querySelector("td:nth-child(1)")?.textContent.trim().toLowerCase();
          data.filter((e) => e.type === "journal" && subject?.startsWith(e.nameEt.toLowerCase())).forEach((e) => {
            const btn = document.createElement("button");
            btn.textContent = "P\xE4evik";
            btn.addEventListener("click", () => window.open(`#/journal/${e.entityId}/edit`, "_blank"));
            row.querySelector("td:nth-child(1)")?.appendChild(btn);
          });
        });
        journalBtn.disabled = true;
      });
    });
    table.parentElement.insertBefore(counter, table);
    table.parentElement.insertBefore(journalBtn, table);
    table.parentElement.insertBefore(hideToggle, table);
    table.parentElement.insertBefore(negToggle, table);
  }

  // src/utils/auth.js
  function getCsrfToken() {
    const match = document.cookie.match(new RegExp("(^| )XSRF-TOKEN=([^;]+)"));
    if (match) return decodeURIComponent(match[2]);
    return null;
  }

  // src/modules/studentProfile/moduleLinks.js
  registerFeature({
    id: "studentProfile.moduleLinks",
    label: "Mooduli protokollide ja p\xE4evikute lingid",
    description: 'Lisab "\xD5ppekava t\xE4itmine" vahekaardile lingid mooduli protokollidele ja p\xE4evikutele, ning nupu uue protokolli loomiseks.',
    defaultEnabled: true
  });
  registerFeatureHandler({
    featureId: "studentProfile.moduleLinks",
    match: (url) => /students\/.*\/results/.test(url),
    async run(url, dom) {
      if (!dom.querySelector(`.md-active[aria-label='\xD5ppekava t\xE4itmine']`)) return;
      const studentId = url.match(/students\/(\d+)/)?.[1];
      const firstModule = dom.querySelector(".hois-collapse-parent div:first-of-type > span");
      if (!firstModule || isAlreadyApplied(firstModule)) return;
      const currentStudent = getCurrentStudent();
      if (currentStudent?.id != studentId) return;
      addAppliedMarker(firstModule);
      await studentProfileModuleAndJournalLinks(studentId);
    }
  });
  async function studentProfileModuleAndJournalLinks(studentId) {
    const currentStudent = getCurrentStudent();
    const currentStudentModules = getCurrentStudentModules();
    const curriculumVersionId = currentStudent?.curriculumVersion?.id;
    const groupCode = currentStudent?.curriculumVersion?.code;
    const modulesDom = document.querySelectorAll(
      ".hois-collapse-parent div:not(.subtext):not([ng-if]):first-of-type > span"
    );
    const journalsDom = document.querySelectorAll(".hois-collapse-body .tahvel-table td:first-of-type > span");
    const moduleProtocolsResponse = await fetch(
      `${TAHVEL_API_URL}/moduleProtocols?isVocational=true&curriculumVersion=${curriculumVersionId}&lang=ET&page=0&size=75`,
      { headers: { accept: "application/json" } }
    );
    const moduleProtocols = await moduleProtocolsResponse.json();
    modulesDom.forEach((moduleDom) => {
      const moduleName = moduleDom.textContent.trim().replace(/\s*\([^)]*\)$/, "");
      moduleProtocols.content.filter(
        (mp) => mp.studentGroups.includes(groupCode) && mp.curriculumVersionOccupationModules?.[0]?.nameEt === moduleName
      ).forEach((mp) => {
        const a = document.createElement("a");
        a.href = `#/moduleProtocols/module/${mp.id}/edit`;
        a.target = "_blank";
        a.textContent = mp.id;
        a.style.cssText = "padding-right:5px;font-weight:bold;color:var(--color-new-primary-blue-1);text-decoration:none";
        moduleDom.appendChild(a);
      });
      const moduleData = currentStudentModules?.curriculumModules?.find(
        (m) => m.curriculumModule.nameEt === moduleName
      );
      if (!moduleData) return;
      const newLink = document.createElement("a");
      newLink.textContent = "Uus protokoll";
      newLink.style.cssText = "padding-right:5px;color:var(--color-new-primary-blue-1);text-decoration:none;text-transform:none;border:1px solid var(--color-new-primary-blue-1);white-space:nowrap";
      newLink.addEventListener("click", async () => {
        newLink.style.pointerEvents = "none";
        newLink.style.color = "gray";
        newLink.textContent = "Laeb...";
        const restore = () => {
          newLink.style.pointerEvents = "";
          newLink.style.color = "var(--color-new-primary-blue-1)";
          newLink.textContent = "Uus protokoll";
        };
        const studyYearRes = await fetch(`${TAHVEL_API_URL}/school/studyYear/current-or-next-dto`, {
          credentials: "include",
          headers: { Accept: "application/json, text/plain, */*" }
        });
        const studyYear = await studyYearRes.json();
        const studentsRes = await fetch(
          `${TAHVEL_API_URL}/moduleProtocols/occupationModule/${studyYear.id}/${moduleData.id}`,
          { credentials: "include", headers: { Accept: "application/json, text/plain, */*" } }
        );
        const students = await studentsRes.json();
        if (!(currentStudent.curriculumVersion.id && studyYear.id && students.teacher?.id && moduleData.id)) {
          console.error("Missing data for new protocol", { moduleData, students, studyYear, currentStudent });
          alert("Tekkis viga, vaata konsooli.");
          restore();
          return;
        }
        const confirmText = `Oled loomas uut protokolli moodulile ${moduleName}. Moodulile m\xE4\xE4ratakse \xF5ppeaasta ${studyYear.nameEt}, \xF5petajaks ${students.teacher.nameEt} ja lisatakse ${students.occupationModuleStudents.length} \xF5pilast.`;
        if (!confirm(confirmText)) {
          restore();
          return;
        }
        const newModuleRes = await fetch(`${TAHVEL_API_URL}/moduleProtocols`, {
          credentials: "include",
          headers: {
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json;charset=utf-8",
            "X-XSRF-TOKEN": getCsrfToken()
          },
          method: "POST",
          body: JSON.stringify({
            protocolVdata: {
              curriculumVersionOccupationModule: moduleData.id,
              curriculumVersion: currentStudent.curriculumVersion.id,
              studyYear: studyYear.id,
              teacher: students.teacher.id
            },
            protocolStudents: students.occupationModuleStudents.map((s) => ({ studentId: s.studentId })),
            type: "module",
            isBasic: false,
            isSecondary: false,
            isHigher: false,
            isVocational: true
          })
        });
        const newModule = await newModuleRes.json();
        window.open(`#/moduleProtocols/module/${newModule.id}/edit`, "_blank");
        restore();
      });
      moduleDom.appendChild(newLink);
    });
    const journalsRes = await fetch(
      `${TAHVEL_API_URL}/students/${studentId}/vocationalConnectedEntities`,
      { headers: { accept: "application/json" } }
    );
    const vocationalEntities = await journalsRes.json();
    journalsDom.forEach((journalDom) => {
      const journalName = journalDom.textContent.trim().replace(/\s*\([^)]*\)$/, "");
      vocationalEntities.filter((e) => e.type === "journal" && e.nameEt === journalName).forEach((e) => {
        const a = document.createElement("a");
        a.href = `#/journal/${e.entityId}/edit`;
        a.target = "_blank";
        a.textContent = e.entityId;
        a.style.paddingRight = "5px";
        journalDom.appendChild(a);
      });
    });
  }

  // src/utils/misc.js
  function simulateTyping(inputElement, text) {
    inputElement.value = text;
    inputElement.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // src/modules/rja/parameters.js
  registerFeature({
    id: "rja.parameters",
    label: "RJA: automaatsed parameetrid",
    description: "T\xE4idab r\xFChmajuhataja aruandes kuup\xE4eva ja kandete valikud automaatselt r\xFChma koodi p\xF5hjal.",
    defaultEnabled: true,
    settings: [
      {
        id: "rja.oppetoetus",
        label: "RJA: \xF5ppetoetuse re\u017Eiim",
        description: "Muudab kandete valikut ja l\xF5pukuup\xE4eva eelmise semestri andmete jaoks (\xF5ppetoetuse arvutamiseks).",
        defaultEnabled: false
      }
    ]
  });
  registerFeatureHandler({
    featureId: "rja.parameters",
    match: (url) => url.includes("reports/studentgroupteacher"),
    run(_url, dom) {
      const groupSelect = dom.querySelector(`md-autocomplete[md-floating-label="\xD5pper\xFChm"] input`);
      if (groupSelect && !isAlreadyApplied(groupSelect)) {
        groupSelect.addEventListener("change", () => {
          setTimeout(() => updateRJAParameters(groupSelect.value), 200);
        });
        addAppliedMarker(groupSelect);
      }
      const groupSelectOptions = [...dom.querySelectorAll(`md-option[ng-value="studentGroup"]`)];
      if (groupSelectOptions.length && !isAlreadyApplied(groupSelectOptions[0])) {
        groupSelectOptions.forEach((option) => {
          option.addEventListener("click", () => {
            setTimeout(() => updateRJAParameters(groupSelect?.value ?? ""), 200);
          });
        });
        addAppliedMarker(groupSelectOptions[0]);
      }
    }
  });
  function updateRJAParameters(group) {
    if (typeof group === "object" && group?.nameEt) group = group.nameEt;
    const year = parseInt(group.match(/\d+/)?.[0] ?? "0") + 2e3;
    const startDate = new Date(year, 7, 1);
    const oppetoetus = isFeatureEnabled("rja.oppetoetus");
    const rjaEntryTypes = oppetoetus ? [1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0] : [1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      document.querySelectorAll(`[ng-show="formState.showAllParameters"] md-checkbox`).forEach((input, index) => {
        const isChecked = input.getAttribute("aria-checked") === "true" ? 1 : 0;
        if (isChecked ^ rjaEntryTypes[index]) input.click();
      });
    }
    const dateInput = document.querySelector(`[ng-model="criteria.from"] input`);
    if (dateInput) {
      dateInput.click();
      dateInput.value = "";
      simulateTyping(dateInput, startDate.toLocaleDateString("et", { day: "2-digit", month: "2-digit", year: "numeric" }));
    }
    if (oppetoetus) {
      const endDate = new Date((/* @__PURE__ */ new Date()).getFullYear() - 1, 11, 31);
      const dateInput2 = document.querySelector(`[ng-model="criteria.thru"] input`);
      if (dateInput2) {
        dateInput2.click();
        dateInput2.value = "";
        simulateTyping(dateInput2, endDate.toLocaleDateString("et", { day: "2-digit", month: "2-digit", year: "numeric" }));
      }
    }
    document.querySelector(`[ng-model="criteria.studyYear"]`)?.click();
    setTimeout(() => {
      document.querySelector(`.md-select-menu-container.md-active.md-clickable md-option`)?.click();
    }, 120);
  }

  // src/modules/rja/summaryColumns.js
  registerFeature({
    id: "rja.summaryColumns",
    label: "RJA: negatiivsete hinnete kokkuv\xF5te",
    description: "Lisab r\xFChmajuhataja aruandesse negatiivsete perioodi- ja l\xF5puhinnete arvu ning protsendi veerud.",
    defaultEnabled: true,
    settings: [
      {
        id: "rja.oppetoetusDownload",
        label: "RJA: lae aruanne alla JSON-ina",
        description: "Laeb r\xFChmajuhataja aruande automaatselt alla JSON-failina (vajalik \xF5ppetoetuse pingeridade jaoks).",
        defaultEnabled: false
      }
    ]
  });
  addXHRInterceptor(
    (url) => url.includes("hois_back/reports/studentgroupteacher"),
    (data) => {
      if (!isFeatureEnabled("rja.oppetoetusDownload")) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
      const fileName = document.querySelector('[aria-label="\xD5pper\xFChm"]')?.value ?? "class-teacher-report";
      a.download = `${fileName}.json`;
      a.click();
    }
  );
  registerFeatureHandler({
    featureId: "rja.summaryColumns",
    match: (url) => url.includes("reports/studentgroupteacher"),
    run(_url, dom) {
      const table = dom.querySelector(".student-group-teacher-table");
      const isLoaded = table?.querySelector("tbody tr:first-child td:nth-child(2) span:not([class])");
      if (isLoaded && !isAlreadyApplied(table)) {
        addSummaryDataToRJA(table);
        addAppliedMarker(table);
      }
    }
  });
  var NEW_COLUMNS = 4;
  var PERIOD_CLASSIFIER = "R";
  var FINAL_CLASSIFIER = "L";
  var NEGATIVE_CODES = ["MA", "X", "1", "2"];
  function addSummaryDataToRJA(table) {
    const report = getCurrentClassTeacherReport();
    if (!report) return;
    const studentGradesMap = /* @__PURE__ */ new Map();
    report.students.forEach((student) => {
      let totalFinal = 0, totalPeriod = 0, negFinal = 0, negPeriod = 0;
      student.resultColumns.forEach((col) => {
        const results = col?.journalResult?.results;
        if (!results?.length) return;
        results.forEach((r) => {
          const code = r.grade?.code ?? "";
          const isNeg = NEGATIVE_CODES.some((n) => code.endsWith(n));
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
    const headerRows = table.querySelectorAll("thead tr");
    const summaryHeader0 = headerRows[0].querySelector("th:last-child");
    const summaryHeader1 = headerRows[1].querySelector("th:last-child");
    const colspan = parseInt(summaryHeader0.getAttribute("colspan"));
    const allHeaderCells = headerRows[2].querySelectorAll("th");
    const lastCells = Array.from(allHeaderCells).slice(-colspan);
    const lastCellIndex = Array.from(allHeaderCells).indexOf(lastCells[0]);
    headerRows[0].insertBefore(summaryHeader0, headerRows[0].children[1]);
    headerRows[1].insertBefore(summaryHeader1, headerRows[1].children[1]);
    const bodyRows = table.querySelectorAll("tbody tr");
    lastCells.forEach((cell, ci) => {
      headerRows[2].insertBefore(cell, headerRows[OFFSET].children[OFFSET + ci]);
      bodyRows.forEach((row) => {
        row.insertBefore(row.children[lastCellIndex + ci], row.children[OFFSET + ci]);
      });
    });
    bodyRows.forEach((row) => {
      const nameEl = row.children[OFFSET - 1]?.querySelector("span:not([class]):not([ng-if])");
      const studentName = nameEl?.textContent.trim();
      if (!studentGradesMap.has(studentName)) return;
      const { totalPeriod, negPeriod, totalFinal, negFinal } = studentGradesMap.get(studentName);
      const mkCell = (text) => {
        const td = document.createElement("td");
        td.textContent = text;
        return td;
      };
      const negPeriodCell = mkCell(negPeriod);
      const negPeriodPctCell = mkCell((negPeriod / totalPeriod * 100).toFixed(1) + "%");
      const negFinalCell = mkCell(negFinal);
      const negFinalPctCell = mkCell((negFinal / totalFinal * 100).toFixed(1) + "%");
      const pct = negFinal / totalFinal * 100;
      negFinalPctCell.style.backgroundColor = pct > 50 ? "black" : pct > 30 ? "#ff3333" : pct > 10 ? "orange" : pct > 0 ? "yellow" : "#92D293";
      negFinalPctCell.style.color = pct > 30 ? "white" : "black";
      const insertAt2 = OFFSET + colspan;
      row.insertBefore(negFinalPctCell, row.children[insertAt2]);
      row.insertBefore(negFinalCell, row.children[insertAt2]);
      row.insertBefore(negPeriodPctCell, row.children[insertAt2]);
      row.insertBefore(negPeriodCell, row.children[insertAt2]);
    });
    summaryHeader0.setAttribute("colspan", colspan + NEW_COLUMNS);
    summaryHeader1.setAttribute("colspan", colspan + NEW_COLUMNS);
    const insertAt = OFFSET + colspan;
    const headers = [
      "Neg. l\xF5puhinde %",
      "Neg. l\xF5puhinded",
      "Neg. perioodi %",
      "Neg. perioodi hinded"
    ];
    headers.forEach((text) => {
      const th = document.createElement("th");
      th.textContent = text;
      headerRows[2].insertBefore(th, headerRows[2].children[insertAt]);
    });
  }

  // src/modules/journalList/todayJournals.js
  registerFeature({
    id: "journalList.todayJournals",
    label: "T\xE4nased tunnid p\xE4evikute nimekirjas",
    description: "Lisab p\xE4evikute nimekirja \xFClaosasse t\xE4naste tundide lingid.",
    defaultEnabled: true
  });
  registerFeatureHandler({
    featureId: "journalList.todayJournals",
    match: (url) => url.includes("#/journals?_menu"),
    run(_url, dom) {
      const myJournals = dom.querySelector("#main-content > div:nth-of-type(2)");
      if (myJournals && !isAlreadyApplied(myJournals)) {
        const inserted = addMyJournals();
        if (inserted) addAppliedMarker(inserted);
      }
    }
  });
  function addMyJournals() {
    const schoolId = JSON.parse(localStorage.getItem("schoolId") ?? "null");
    const teacherId = JSON.parse(localStorage.getItem("currentTeacherId") ?? "null");
    if (!teacherId || !schoolId || !document.querySelector("#main-content")) return null;
    const mainContent = document.querySelector("#main-content");
    const container = document.createElement("div");
    container.classList.add("layout-padding");
    const label = document.createElement("label");
    label.textContent = "T\xE4nased tunnid";
    label.classList.add("md-title-small");
    container.appendChild(label);
    const today = /* @__PURE__ */ new Date();
    const todayStr = today.toISOString().split("T")[0];
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff)).toISOString().split("T")[0] + "T00:00:00Z";
    const sunday = new Date(today.setDate(diff + 6)).toISOString().split("T")[0] + "T00:00:00Z";
    fetch(
      `${TAHVEL_API_URL}/timetableevents/timetableByTeacher/${schoolId}?from=${monday}&lang=ET&teachers=${teacherId}&thru=${sunday}`,
      { headers: { accept: "application/json" } }
    ).then((r) => r.json()).then((timetable) => {
      const added = /* @__PURE__ */ new Set();
      const todaysEvents = timetable.timetableEvents.filter((te) => te.journalId && te.date.startsWith(todayStr));
      for (const te of todaysEvents) {
        if (added.has(te.journalId)) continue;
        added.add(te.journalId);
        const room = te.rooms?.[0]?.roomCode ?? "";
        const groups = te.studentGroups.map((sg) => sg.code).join(", ");
        const link = document.createElement("a");
        link.href = `#/journal/${te.journalId}/edit`;
        link.textContent = `${te.nameEt} ${room} ${groups}`.trim();
        link.style.cssText = "padding-bottom:5px;display:block";
        container.appendChild(link);
      }
      if (added.size === 0) {
        const empty = document.createElement("i");
        empty.textContent = "T\xE4naseid p\xE4evikuid ei leitud";
        empty.style.display = "block";
        container.appendChild(empty);
      }
    });
    mainContent.firstChild.after(container);
    return container;
  }

  // src/datasets/RoomDetails.js
  var RoomDetails = [
    { roomNumber: "A101", seats: "35", computers: "1", area: "36", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "A102", seats: "16", computers: "9", area: "58", board: "valgetahvel", os: "Windows" },
    { roomNumber: "A107", seats: "20", computers: "21", area: "72", board: "valgetahvel", os: "Windows" },
    { roomNumber: "A108", seats: "30", computers: "31", area: "66", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "A111", seats: "20", computers: "1", area: "36", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "A116", seats: "30", computers: "1", area: "38", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "A117", seats: "18", computers: "", area: "52", board: "", os: "Windows" },
    { roomNumber: "A118", seats: "20", computers: "", area: "58", board: "puudub", os: "Windows" },
    { roomNumber: "A201", seats: "34", computers: "1", area: "46", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "A202", seats: "50", computers: "1", area: "76", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "A209", seats: "30", computers: "1", area: "45", board: "valgetahvel", os: "Windows" },
    { roomNumber: "A210", seats: "24", computers: "23", area: "43", board: "", os: "Windows" },
    { roomNumber: "A213", seats: "16", computers: "", area: "48", board: "puudub", os: "" },
    { roomNumber: "A216", seats: "30", computers: "1", area: "38", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "A217", seats: "34", computers: "1", area: "52", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "A301", seats: "34", computers: "1", area: "46", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "A302", seats: "34", computers: "35", area: "75", board: "valgetahvel", os: "Windows" },
    { roomNumber: "A303", seats: "15", computers: "", area: "??", board: "", os: "" },
    { roomNumber: "A304", seats: "38", computers: "1", area: "54", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "A306", seats: "35", computers: "1", area: "56", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "A307", seats: "16", computers: "17", area: "55", board: "valgetahvel", os: "Windows" },
    { roomNumber: "A308", seats: "32", computers: "33", area: "53", board: "valgetahvel", os: "Windows" },
    { roomNumber: "A309", seats: "15", computers: "18", area: "51", board: "valgetahvel", os: "Windows" },
    { roomNumber: "A310", seats: "36", computers: "1", area: "45", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "A311", seats: "34", computers: "1", area: "36", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "A314", seats: "30", computers: "1", area: "38", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "A315", seats: "36", computers: "1", area: "52", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "A401", seats: "30", computers: "1", area: "46", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "A402", seats: "30", computers: "31", area: "78", board: "valgetahvel", os: "Windows" },
    { roomNumber: "A404", seats: "36", computers: "1", area: "55", board: "valgetahvel", os: "Windows" },
    { roomNumber: "A403", seats: "15", computers: "", area: "??", board: "", os: "" },
    { roomNumber: "A405", seats: "26", computers: "1", area: "45", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "A406", seats: "34", computers: "1", area: "42", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "A407", seats: "140", computers: "1", area: "163", board: "", os: "Windows" },
    { roomNumber: "A410", seats: "34", computers: "1", area: "57", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "A414", seats: "16", computers: "1", area: "38", board: "", os: "Windows" },
    { roomNumber: "A415", seats: "36", computers: "1", area: "52", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "A002", seats: "30", computers: "58", area: "139", board: "", os: "Windows" },
    { roomNumber: "A003", seats: "9", computers: "1", area: "30", board: "", os: "Windows" },
    { roomNumber: "A007a007b", seats: "7", computers: "", area: "20", board: "", os: "" },
    { roomNumber: "A008", seats: "20", computers: "1", area: "95", board: "", os: "Windows" },
    { roomNumber: "A008a", seats: "0", computers: "", area: "20", board: "", os: "" },
    { roomNumber: "A009", seats: "8", computers: "2", area: "37", board: "", os: "OS X" },
    { roomNumber: "A010", seats: "6", computers: "1", area: "47", board: "", os: "Windows" },
    { roomNumber: "B036038", seats: "0", computers: "", area: "78", board: "", os: "" },
    { roomNumber: "B046", seats: "30", computers: "20", area: "104", board: "valgetahvel", os: "Windows" },
    { roomNumber: "B047", seats: "0", computers: "1", area: "36", board: "valgetahvel", os: "Windows" },
    { roomNumber: "B100", seats: "36", computers: "", area: "369", board: "", os: "" },
    { roomNumber: "T411", seats: "30", computers: "31", area: "52", board: "puudub", os: "Windows" },
    { roomNumber: "T412", seats: "31", computers: "31", area: "65", board: "puudub", os: "Windows" },
    { roomNumber: "T413", seats: "0", computers: "", area: "100", board: "", os: "" },
    { roomNumber: "B113", seats: "40", computers: "16", area: "110", board: "", os: "Windows" },
    { roomNumber: "B116", seats: "2", computers: "", area: "", board: "", os: "" },
    { roomNumber: "B200", seats: "4", computers: "1", area: "46", board: "", os: "OS X" },
    { roomNumber: "B201", seats: "24", computers: "", area: "76", board: "", os: "OS X" },
    { roomNumber: "B202", seats: "7", computers: "", area: "37", board: "", os: "" },
    { roomNumber: "B204", seats: "4", computers: "", area: "37", board: "", os: "" },
    { roomNumber: "B206", seats: "20", computers: "21", area: "37", board: "valgetahvel", os: "OS X" },
    { roomNumber: "B207", seats: "8", computers: "", area: "37", board: "", os: "" },
    { roomNumber: "B210", seats: "12", computers: "12", area: "38", board: "valgetahvel", os: "OS X" },
    { roomNumber: "B211", seats: "32", computers: "1", area: "55", board: "valgetahvel", os: "OS X" },
    { roomNumber: "B306", seats: "25", computers: "27", area: "55", board: "valgetahvel", os: "OS X" },
    { roomNumber: "B307", seats: "31", computers: "31", area: "56", board: "valgetahvel", os: "Windows" },
    { roomNumber: "B315", seats: "20", computers: "21", area: "57", board: "valgetahvel", os: "Windows" },
    { roomNumber: "B316", seats: "16", computers: "17", area: "57", board: "valgetahvel", os: "Windows" },
    { roomNumber: "B317", seats: "10", computers: "", area: "38", board: "", os: "" },
    { roomNumber: "B318", seats: "18", computers: "19", area: "57", board: "valgetahvel", os: "Windows" },
    { roomNumber: "B405", seats: "32", computers: "1", area: "55", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "B407", seats: "32", computers: "", area: "56", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "B409", seats: "28", computers: "1", area: "56", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "B414", seats: "18", computers: "1", area: "38", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "B416", seats: "28", computers: "1", area: "57", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "B417", seats: "36", computers: "1", area: "57", board: "kriiditahvel", os: "Windows" },
    { roomNumber: "B508", seats: "8", computers: "4", area: "24", board: "", os: "OS X" },
    { roomNumber: "B510", seats: "16", computers: "16", area: "48", board: "", os: "OS X" },
    { roomNumber: "B511", seats: "8", computers: "8", area: "24", board: "", os: "OS X" },
    { roomNumber: "B512", seats: "8", computers: "8", area: "24", board: "", os: "OS X" },
    { roomNumber: "B513", seats: "8", computers: "", area: "25", board: "", os: "" }
  ];

  // src/modules/rooms/seatInfo.js
  registerFeature({
    id: "rooms.seatInfo",
    label: "Ruumide lisainfo (arvutid, pindala, tahvel, OS)",
    description: "Lisab vabade ruumide tabelisse arvutite arvu, pindala, tahvli ja operatsioonis\xFCsteemi veerud.",
    defaultEnabled: true
  });
  var roomsObserver = null;
  registerFeatureHandler({
    featureId: "rooms.seatInfo",
    match: (url) => url.includes("#/lessonplans/rooms") || location.hash.startsWith("#/lessonplans/rooms"),
    run() {
      if (roomsObserver) return;
      roomsObserver = observeTargetChange(document.body, () => {
        injectSeatInfoToColumn(RoomDetails);
      });
    },
    cleanup() {
      if (roomsObserver) {
        roomsObserver.disconnect();
        roomsObserver = null;
      }
    }
  });
  function cloneCellStyle(fromEl, toEl) {
    const s = window.getComputedStyle(fromEl);
    toEl.style.padding = s.padding;
    toEl.style.font = s.font;
    toEl.style.verticalAlign = s.verticalAlign;
    toEl.style.lineHeight = s.lineHeight;
    toEl.style.height = s.height;
    toEl.style.borderTop = s.borderTop;
    toEl.style.borderBottom = s.borderBottom;
    toEl.style.textAlign = s.textAlign;
  }
  function injectSeatInfoToColumn(roomData) {
    const table = document.querySelector("table.md-table");
    const firstRow = table?.querySelector("tbody tr");
    const headerRow = table?.querySelector("thead tr");
    if (!table || !firstRow) return;
    if (!isAlreadyApplied(headerRow)) {
      const insertHeader = (text, position, ref2) => {
        const th = document.createElement("th");
        th.textContent = text;
        headerRow.insertBefore(th, headerRow.children[position]);
        cloneCellStyle(ref2, th);
      };
      const ref = headerRow.children[2];
      insertHeader("Arvuteid", 3, ref);
      insertHeader("Pindala", 4, ref);
      insertHeader("Tahvel", 5, ref);
      insertHeader("OS", 6, ref);
      addAppliedMarker(headerRow);
    }
    if (isAlreadyApplied(firstRow)) return;
    const headerCells = table.querySelectorAll("thead th");
    const headers = Array.from(headerCells).map(
      (th) => th.textContent.trim().replace(/\s+/g, "").toLowerCase()
    );
    const roomColIndex = headers.findIndex((t) => t === "ruum");
    const seatsColIndex = headers.findIndex((t) => t === "kohtadearv") - 4;
    table.querySelectorAll("tbody tr").forEach((row) => {
      const cells = row.querySelectorAll("td");
      const roomText = cells[roomColIndex]?.textContent.trim() ?? "";
      const match = roomData.find((r) => r.roomNumber === roomText);
      if (match && seatsColIndex >= 0) cells[seatsColIndex].textContent = String(match.seats);
      const ref = row.children[2];
      const insertCell = (value, position) => {
        const td = document.createElement("td");
        td.textContent = value ?? "";
        row.insertBefore(td, row.children[position]);
        cloneCellStyle(ref, td);
      };
      insertCell(match?.computers, 3);
      insertCell(match?.area ? `${match.area}m\xB2` : "", 4);
      insertCell(match?.board, 5);
      insertCell(match?.os, 6);
    });
    addAppliedMarker(firstRow);
  }

  // src/auth/msal.js
  var Msal = class {
    #instance;
    #ready;
    constructor() {
      this.#ready = this.#loadScript().then(() => {
        this.#initMsal();
      });
    }
    get msalInstance() {
      return this.#instance;
    }
    get msalReady() {
      return this.#ready;
    }
    #initMsal() {
      const msalConfig = {
        auth: {
          clientId: void 0,
          authority: "https://login.microsoftonline.com/" + void 0,
          redirectUri: "https://tahvel.edu.ee/"
        },
        cache: { cacheLocation: "localStorage" }
      };
      this.#instance = new msal.PublicClientApplication(msalConfig);
    }
    #loadScript() {
      return new Promise((resolve) => {
        let gradeHistoryScript = document.getElementById("msal-script");
        function onMsalReady() {
          resolve();
        }
        if (!gradeHistoryScript) {
          gradeHistoryScript = document.createElement("script");
          gradeHistoryScript.id = "msal-script";
          gradeHistoryScript.src = "https://alcdn.msauth.net/browser/2.35.0/js/msal-browser.min.js";
          gradeHistoryScript.type = "text/javascript";
          gradeHistoryScript.onload = onMsalReady;
          document.body.appendChild(gradeHistoryScript);
        } else if (window.msal && window.PublicClientApplication) {
          resolve();
        } else {
          gradeHistoryScript.onload = onMsalReady;
        }
      });
    }
  };

  // src/auth/authentication.js
  var Authentication = class extends Msal {
    #accounts = [];
    constructor() {
      super();
      this.init();
    }
    async init() {
      await this.msalReady;
      this.#accounts = this.msalInstance.getAllAccounts();
    }
    async login() {
      await this.msalReady;
      await this.msalInstance.loginPopup({ scopes: ["user.read"] }).catch((error) => {
        console.error("Login failed:", error);
        return false;
      });
      this.#accounts = await this.msalInstance.getAllAccounts();
      return true;
    }
    checkAuth() {
      if (this.#accounts.length === 0) return false;
      this.msalInstance.setActiveAccount(this.#accounts[0]);
      try {
        this.msalInstance.acquireTokenSilent({ scopes: [void 0 + "/.default"], account: this.#accounts[0] });
        return true;
      } catch (error) {
        console.error("Token acquisition failed: ", error);
        return false;
      }
    }
    async getToken() {
      const silentRequest = { scopes: [void 0 + "/.default"], account: this.#accounts[0] };
      if (!this.checkAuth()) {
        this.login();
        return null;
      }
      try {
        const response = await this.msalInstance.acquireTokenSilent(silentRequest);
        return await response.accessToken;
      } catch (error) {
        console.error("Silent token acquisition failed: ", error);
        this.login();
        return null;
      }
    }
  };

  // src/modules/gradeHistory/graphComponents.js
  var GraphComponents = class {
    #graph;
    #login;
    #loading;
    #isLoginVisible = false;
    #isLoadingVisible = false;
    constructor({ graph, login, loading }) {
      if (!graph || !login || !loading) {
        console.error({ graph, login, loading });
        throw new Error("GraphComponents: missing DOM elements");
      }
      this.#graph = graph;
      this.#login = login;
      this.#loading = loading;
    }
    get graphComponent() {
      return this.#graph;
    }
    get isLoginVisible() {
      return this.#isLoginVisible;
    }
    get isLoadingVisible() {
      return this.#isLoadingVisible;
    }
    showLogin() {
      this.#isLoginVisible = true;
      this.#login.style.display = "flex";
    }
    hideLogin() {
      this.#isLoginVisible = false;
      this.#login.style.display = "none";
    }
    showLoading() {
      this.#isLoadingVisible = true;
      this.#loading.style.display = "flex";
    }
    hideLoading() {
      this.#isLoadingVisible = false;
      this.#loading.style.display = "none";
    }
  };

  // src/modules/gradeHistory/waitForElement.js
  async function waitForElement(selector) {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) return resolve(element);
      const observer = new MutationObserver(() => {
        const element2 = document.querySelector(selector);
        if (element2) {
          resolve(element2);
          observer.disconnect();
        }
        ;
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // src/modules/gradeHistory/getStudentId.js
  function getStudentId() {
    let id = null;
    const url = window.location.href;
    const match = url.match(/\/students\/(\d+)/);
    id = match ? match[1] : null;
    if (!id) {
      id = fetch("https://tahvel.edu.ee/hois_back/user", {
        method: "GET",
        credentials: "include",
        headers: { accept: "application/json, text/plain, */*" }
      }).then((res) => res.json()).then((data) => data.student);
    }
    return id;
  }

  // src/datasets/ExampleHistory.js
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
      { date: "13.01", negativeGrades: "9", fineGrades: "12", goodGrades: "20", greatGrades: "20" },
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
    finalGrades: [
      { date: "29.09", negativeFinalGrades: "1", fineFinalGrades: "3", goodFinalGrades: "5", greatFinalGrades: "5" },
      { date: "07.10", negativeFinalGrades: "2", fineFinalGrades: "4", goodFinalGrades: "6", greatFinalGrades: "6" },
      { date: "14.10", negativeFinalGrades: "1", fineFinalGrades: "4", goodFinalGrades: "7", greatFinalGrades: "7" },
      { date: "21.10", negativeFinalGrades: "3", fineFinalGrades: "5", goodFinalGrades: "8", greatFinalGrades: "8" },
      { date: "28.10", negativeFinalGrades: "2", fineFinalGrades: "5", goodFinalGrades: "9", greatFinalGrades: "9" },
      { date: "04.11", negativeFinalGrades: "4", fineFinalGrades: "6", goodFinalGrades: "10", greatFinalGrades: "10" },
      { date: "11.11", negativeFinalGrades: "2", fineFinalGrades: "6", goodFinalGrades: "11", greatFinalGrades: "11" },
      { date: "18.11", negativeFinalGrades: "3", fineFinalGrades: "7", goodFinalGrades: "12", greatFinalGrades: "12" },
      { date: "25.11", negativeFinalGrades: "1", fineFinalGrades: "7", goodFinalGrades: "13", greatFinalGrades: "13" },
      { date: "02.12", negativeFinalGrades: "2", fineFinalGrades: "8", goodFinalGrades: "14", greatFinalGrades: "14" },
      { date: "09.12", negativeFinalGrades: "3", fineFinalGrades: "8", goodFinalGrades: "15", greatFinalGrades: "15" },
      { date: "16.12", negativeFinalGrades: "2", fineFinalGrades: "9", goodFinalGrades: "16", greatFinalGrades: "16" },
      { date: "23.12", negativeFinalGrades: "5", fineFinalGrades: "9", goodFinalGrades: "17", greatFinalGrades: "17" },
      { date: "30.12", negativeFinalGrades: "6", fineFinalGrades: "10", goodFinalGrades: "18", greatFinalGrades: "18" },
      { date: "06.01", negativeFinalGrades: "8", fineFinalGrades: "11", goodFinalGrades: "19", greatFinalGrades: "19" },
      { date: "13.01", negativeFinalGrades: "9", fineFinalGrades: "12", goodFinalGrades: "20", greatFinalGrades: "20" },
      { date: "20.01", negativeFinalGrades: "9", fineFinalGrades: "13", goodFinalGrades: "21", greatFinalGrades: "21" },
      { date: "27.01", negativeFinalGrades: "7", fineFinalGrades: "14", goodFinalGrades: "22", greatFinalGrades: "22" },
      { date: "03.02", negativeFinalGrades: "6", fineFinalGrades: "15", goodFinalGrades: "23", greatFinalGrades: "23" },
      { date: "10.02", negativeFinalGrades: "5", fineFinalGrades: "16", goodFinalGrades: "24", greatFinalGrades: "24" },
      { date: "17.02", negativeFinalGrades: "4", fineFinalGrades: "17", goodFinalGrades: "25", greatFinalGrades: "25" },
      { date: "24.02", negativeFinalGrades: "3", fineFinalGrades: "18", goodFinalGrades: "26", greatFinalGrades: "26" },
      { date: "03.03", negativeFinalGrades: "2", fineFinalGrades: "19", goodFinalGrades: "27", greatFinalGrades: "27" },
      { date: "10.03", negativeFinalGrades: "2", fineFinalGrades: "20", goodFinalGrades: "28", greatFinalGrades: "28" },
      { date: "17.03", negativeFinalGrades: "1", fineFinalGrades: "21", goodFinalGrades: "29", greatFinalGrades: "29" }
    ],
    absences: [
      { date: "29.09", withReason: "2", noReason: "1", metric: "90" },
      { date: "07.10", withReason: "3", noReason: "2", metric: "80" },
      { date: "14.10", withReason: "4", noReason: "3", metric: "70" },
      { date: "21.10", withReason: "5", noReason: "4", metric: "60" }
    ]
  };

  // src/modules/gradeHistory/gradeHistory.css
  var gradeHistory_default = "#grade-history-container {\n  position: relative;\n  height: 400px;\n  margin: 2px;\n  border: 1px solid hsl(60, 4%, 85%);\n}\n\n#graph-container {\n  width: 100%;\n  height: 85%;\n}\n\n.grade-history-overlay {\n  position: absolute;\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  background: rgba(0, 0, 0, 0.4);\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  backdrop-filter: blur(2px); /* Modern browsers - blurs background */\n  z-index: 1;\n}\n\n.graph-login-container {\n  background: white;\n  padding: 15px;\n  border-radius: 8px;\n  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);\n  width: 300px;\n  height: 200px;\n  text-align: center;\n}\n\n.graph-spinner {\n  position: absolute;\n  left: 50%;\n  top: 50%;\n  z-index: 1;\n  width: 120px;\n  height: 120px;\n  margin: -76px 0 0 -76px;\n  border: 16px solid #f3f3f3;\n  border-radius: 50%;\n  border-top: 16px solid #3498db;\n  -webkit-animation: spin 2s linear infinite;\n  animation: spin 2s linear infinite;\n}\n\n@-webkit-keyframes spin {\n  0% { -webkit-transform: rotate(0deg); }\n  100% { -webkit-transform: rotate(360deg); }\n}\n\n@keyframes spin {\n  0% { transform: rotate(0deg); }\n  100% { transform: rotate(360deg); }\n}";

  // src/modules/gradeHistory/gradeHistory.html
  var gradeHistory_default2 = '<fieldset id="grade-history-container">\n  <legend>Ajalugu</legend>\n\n  <!-- Graph container -->\n  <div id="graph-container">\n    <div id="graph-controlls">\n      <a id="graph-metric-btn" class="md-raised md-primary md-button md-ink-ripple">\n        Puudumiste vaade\n      </a>\n\n      <a id="graph-scope-btn" class="md-raised md-primary md-button md-ink-ripple">\n        L\xF5pphinnete vaade\n      </a>\n\n      <a id="graph-mode-btn" class="md-raised md-secondary md-button md-ink-ripple">\n        T\xE4iustatud vaade\n      </a>\n    </div>\n\n    <canvas id="grade-history-graph" style="width: 100%; height: 100%; margin: 2px;"></canvas>\n  </div>\n\n  <!-- Login overlay -->\n  <div id="graph-login-overlay" class="grade-history-overlay" style="display: none;">\n    <div id="graph-login-container" class="graph-login-container">\n      <h1>Logi sisse hinnete ajaloo n\xE4gemiseks</h1>\n      <button id="graph-login-btn" class="md-raised md-primary md-button md-ink-ripple">Logi sisse</button>\n    </div>\n  </div>\n\n  <!-- Loading overlay -->\n  <div id="graph-loading-overlay" class="grade-history-overlay" style="display: none;">\n    <div id="graph-spinner" class="graph-spinner"></div>\n  </div>\n</fieldset>';

  // src/modules/gradeHistory/gradeHistory.js
  window.addEventListener("hashchange", gradeHistory);
  GM_addStyle(gradeHistory_default);
  var auth = new Authentication();
  var studentData = {};
  var components;
  var simpleMode = true;
  var graphType = "grades";
  var lastState = "grades";
  async function gradeHistory() {
    const hash = window.location.hash;
    if (!["/results", "/myResults"].some((page) => hash.includes(page))) return;
    if (document.querySelector("#grade-history-marker")) return;
    let marker = document.createElement("div");
    marker.setAttribute("id", "grade-history-marker");
    document.body.appendChild(marker);
    console.log("Initializing grade history feature...");
    await getGraphElements().then((elements) => {
      components = new GraphComponents({
        graph: elements.graph,
        login: elements.loginOverlay,
        loading: elements.loadingOverlay
      });
    });
    components.showLoading();
    if (!manageLogin()) {
      manageChart(components.graphComponent, processData(exampleData));
    } else {
      manageChart(components.graphComponent, await fetchGradeHistory());
    }
    components.hideLoading();
    console.log("Grade history feature initialized.");
  }
  function manageLogin() {
    if (!auth.checkAuth()) {
      components.showLogin();
      return false;
    }
    components.hideLogin();
    return true;
  }
  async function getGraphElements() {
    const fieldSet = await waitForElement("#main-content fieldset");
    if (fieldSet.querySelector("#grade-history-graph")) {
      return {
        graphComponent: fieldSet.querySelector("#grade-history-graph"),
        loginComponent: fieldSet.querySelector("#graph-login-overlay"),
        loadingComponent: fieldSet.querySelector("#graph-loading-overlay")
      };
    }
    ;
    return createGraphElements(fieldSet);
  }
  function createGraphElements(previousElement) {
    const template = document.createElement("template");
    template.innerHTML = gradeHistory_default2;
    const ui = template.content.firstElementChild;
    previousElement.after(ui);
    const graph = ui.querySelector("#grade-history-graph");
    const loginOverlay = ui.querySelector("#graph-login-overlay");
    const loadingOverlay = ui.querySelector("#graph-loading-overlay");
    ui.querySelector("#graph-metric-btn").addEventListener("click", () => {
      graphControllsFunction("graph-metric-btn");
    });
    ui.querySelector("#graph-scope-btn").addEventListener("click", () => {
      graphControllsFunction("graph-scope-btn");
    });
    ui.querySelector("#graph-mode-btn").addEventListener("click", () => {
      graphControllsFunction("graph-mode-btn");
    });
    ui.querySelector("#graph-login-btn").addEventListener("click", async () => {
      components.showLoading();
      components.hideLogin();
      let loginResult = await auth.login();
      if (loginResult) {
        if (!manageLogin()) {
          manageChart(components.graphComponent, processData(exampleData));
        } else {
          manageChart(components.graphComponent, await fetchGradeHistory());
        }
      }
      components.hideLoading();
    });
    return { graph, loginOverlay, loadingOverlay };
  }
  async function graphControllsFunction(button) {
    let tempLastState = "";
    if (["graph-metric-btn", "graph-scope-btn"].includes(button)) {
      tempLastState = graphType;
    }
    switch (button) {
      case "graph-metric-btn":
        graphType = ["grades", "finalGrades"].includes(graphType) ? "absences" : lastState;
        break;
      case "graph-scope-btn":
        graphType = graphType === "finalGrades" ? "grades" : "finalGrades";
        break;
      case "graph-mode-btn":
        simpleMode = !simpleMode;
        break;
    }
    lastState = tempLastState;
    let graphDataBtn = document.querySelector("#graph-metric-btn");
    graphDataBtn.text = graphType === "grades" || graphType === "finalGrades" ? "Puudumiste vaade" : "Hinnete vaade";
    let graphFinalDataBtn = document.querySelector("#graph-scope-btn");
    graphFinalDataBtn.text = graphType === "finalGrades" ? "Hinnete vaade" : "L\xF5pphindete vaade";
    graphFinalDataBtn.style.display = graphType === "absences" ? "none" : "inline-block";
    let graphModeBtn = document.querySelector("#graph-mode-btn");
    graphModeBtn.text = simpleMode ? "T\xE4iustatud vaade" : "Lihtne vaade";
    graphModeBtn.style.display = graphType === "absences" ? "none" : "inline-block";
    manageChart(components.graphComponent, await fetchGradeHistory());
  }
  function manageChart(graph, data) {
    const chartData = graphData(data, graphType);
    let myChart = Chart.getChart(graph);
    if (!myChart) {
      myChart = new Chart(graph, {
        type: "line",
        data: chartData,
        options: {
          plugins: {
            tooltip: {
              mode: "index",
              intersect: false,
              callbacks: {
                label: function(context) {
                  let label = context.dataset.label || "";
                  if (label && label === "puudumisi kokku") {
                    return label + ": " + context.parsed.y + " | " + data.absences.metrics[context.dataIndex] + "%";
                  }
                  if (label && label === "negatiivseid hindeid") {
                    return label + ": " + context.parsed.y + " | " + data.grades.negativeGradesMetric[context.dataIndex] + "%";
                  }
                  if (label && label === "negatiivseid l\xF5pphindeid") {
                    return label + ": " + context.parsed.y + " | " + data.finalGrades.negativeFinalGradesMetric[context.dataIndex] + "%";
                  }
                  return label + ": " + context.parsed.y;
                }
              }
            },
            legend: {
              labels: {
                filter: (legendItem) => legendItem.text !== "hindeid kokku" && legendItem.text !== "puudumisi kokku" && legendItem.text !== "l\xF5pphindeid kokku"
              }
            }
          },
          scales: { y: { stacked: true, beginAtZero: true } },
          responsive: true,
          maintainAspectRatio: false
        }
      });
      return;
    }
    myChart.data = chartData;
    myChart.update("none");
  }
  async function fetchGradeHistory() {
    try {
      const studentId = await getStudentId();
      if (studentData && studentData[studentId]) {
        return studentData[studentId];
      }
      const accessToken = await auth.getToken();
      const apiResponse = await fetch(void 0 + `/api/StudentRecord/Student/${studentId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
      }).then((res) => res.json());
      studentData[studentId] = processData(apiResponse);
      return studentData[studentId];
    } catch (error) {
      console.error("Error during fetchWithToken:", error);
      throw error;
    }
  }
  function processData(data) {
    let processedData = {
      grades: {
        dates: [],
        negativeGrades: [],
        positiveGrades: [],
        fineGrades: [],
        goodGrades: [],
        greatGrades: [],
        gradeTotal: [],
        negativeGradesMetric: []
      },
      finalGrades: {
        dates: [],
        negativeFinalGrades: [],
        positiveFinalGrades: [],
        fineFinalGrades: [],
        goodFinalGrades: [],
        greatFinalGrades: [],
        finalGradeTotal: [],
        negativeFinalGradesMetric: []
      },
      absences: { dates: [], noReason: [], withReason: [], absencesTotal: [], lessons: [], metrics: [] }
    };
    data.grades.forEach((e) => {
      processedData.grades.dates.push(e.date);
      processedData.grades.negativeGrades.push(e.negativeGrades);
      processedData.grades.positiveGrades.push(+e.fineGrades + +e.goodGrades + +e.greatGrades);
      processedData.grades.fineGrades.push(e.fineGrades);
      processedData.grades.goodGrades.push(e.goodGrades);
      processedData.grades.greatGrades.push(e.greatGrades);
      processedData.grades.gradeTotal.push(+e.negativeGrades + +e.fineGrades + +e.goodGrades + +e.greatGrades);
      processedData.grades.negativeGradesMetric.push(
        (+e.negativeGrades * 100 / +processedData.grades.gradeTotal.slice(-1)).toFixed(0)
      );
    });
    data.finalGrades.forEach((e) => {
      processedData.finalGrades.dates.push(e.date);
      processedData.finalGrades.negativeFinalGrades.push(e.negativeFinalGrades);
      processedData.finalGrades.positiveFinalGrades.push(+e.fineFinalGrades + +e.goodFinalGrades + +e.greatFinalGrades);
      processedData.finalGrades.fineFinalGrades.push(e.fineFinalGrades);
      processedData.finalGrades.goodFinalGrades.push(e.goodFinalGrades);
      processedData.finalGrades.greatFinalGrades.push(e.greatFinalGrades);
      processedData.finalGrades.finalGradeTotal.push(
        +e.negativeFinalGrades + +e.fineFinalGrades + +e.goodFinalGrades + +e.greatFinalGrades
      );
      processedData.finalGrades.negativeFinalGradesMetric.push(
        (+e.negativeFinalGrades * 100 / +processedData.finalGrades.finalGradeTotal.slice(-1)).toFixed(0)
      );
    });
    data.absences.forEach((e) => {
      processedData.absences.dates.push(e.date);
      processedData.absences.noReason.push(e.noReason);
      processedData.absences.withReason.push(e.withReason);
      processedData.absences.absencesTotal.push(+e.noReason + +e.withReason);
      processedData.absences.lessons.push(((+e.noReason + +e.withReason) * 100 / +e.metric).toFixed(0));
      processedData.absences.metrics.push(e.metric);
    });
    return processedData;
  }
  function graphData(data, graphType2) {
    let datasetSimple = [
      {
        label: "negatiivseid hindeid",
        data: data.grades.negativeGrades,
        borderWidth: 2,
        borderColor: "#eb3b5a",
        backgroundColor: "#fc5c65",
        fill: true,
        stack: "grades"
      },
      {
        label: "positiivseid hindeid",
        data: data.grades.positiveGrades,
        borderWidth: 2,
        borderColor: "#20bf6b",
        backgroundColor: "#26de81",
        fill: true,
        stack: "grades"
      }
    ];
    let datasetAdvanced = [
      {
        label: "negatiivseid hindeid",
        data: data.grades.negativeGrades,
        borderWidth: 2,
        borderColor: "#eb3b5a",
        backgroundColor: "#fc5c65",
        fill: true,
        stack: "grades"
      },
      {
        label: "rahuldavaid hindeid",
        data: data.grades.fineGrades,
        borderWidth: 2,
        borderColor: "#fa8231",
        backgroundColor: "#fd9644",
        fill: true,
        stack: "grades"
      },
      {
        label: "h\xE4id hindeid",
        data: data.grades.goodGrades,
        borderWidth: 2,
        borderColor: "#f7b731",
        backgroundColor: "#fed330",
        fill: true,
        stack: "grades"
      },
      {
        label: "suurep\xE4raseid hindeid",
        data: data.grades.greatGrades,
        borderWidth: 2,
        borderColor: "#20bf6b",
        backgroundColor: "#26de81",
        fill: true,
        stack: "grades"
      }
    ];
    let datasetFinalSimple = [
      {
        label: "negatiivseid l\xF5pphindeid",
        data: data.finalGrades.negativeFinalGrades,
        borderWidth: 2,
        borderColor: "#eb3b5a",
        backgroundColor: "#fc5c65",
        fill: true,
        stack: "grades"
      },
      {
        label: "positiivseid l\xF5pphindeid",
        data: data.finalGrades.positiveFinalGrades,
        borderWidth: 2,
        borderColor: "#20bf6b",
        backgroundColor: "#26de81",
        fill: true,
        stack: "grades"
      }
    ];
    let datasetFinalAdvanced = [
      {
        label: "negatiivseid l\xF5pphindeid",
        data: data.finalGrades.negativeFinalGrades,
        borderWidth: 2,
        borderColor: "#eb3b5a",
        backgroundColor: "#fc5c65",
        fill: true,
        stack: "grades"
      },
      {
        label: "rahuldavaid l\xF5pphindeid",
        data: data.finalGrades.fineFinalGrades,
        borderWidth: 2,
        borderColor: "#fa8231",
        backgroundColor: "#fd9644",
        fill: true,
        stack: "grades"
      },
      {
        label: "h\xE4id l\xF5pphindeid",
        data: data.finalGrades.goodFinalGrades,
        borderWidth: 2,
        borderColor: "#f7b731",
        backgroundColor: "#fed330",
        fill: true,
        stack: "grades"
      },
      {
        label: "suurep\xE4raseid l\xF5pphindeid",
        data: data.finalGrades.greatFinalGrades,
        borderWidth: 2,
        borderColor: "#20bf6b",
        backgroundColor: "#26de81",
        fill: true,
        stack: "grades"
      }
    ];
    if (graphType2 == "grades") {
      return {
        labels: data.grades.dates,
        datasets: [
          ...simpleMode ? datasetSimple : datasetAdvanced,
          { label: "hindeid kokku", data: data.grades.gradeTotal, borderColor: "#4b6584", backgroundColor: "#778ca3" }
        ]
      };
    } else if (graphType2 == "finalGrades") {
      return {
        labels: data.finalGrades.dates,
        datasets: [
          ...simpleMode ? datasetFinalSimple : datasetFinalAdvanced,
          {
            label: "l\xF5pphindeid kokku",
            data: data.finalGrades.finalGradeTotal,
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

  // src/modules/teachers.js
  if (typeof GM_log === "function") console.log = GM_log;
  var style = document.createElement("style");
  style.textContent = `
  /* Hinnete dropdown oleks pikem */
  md-select-menu, md-select-menu md-content {
    max-height: 300px;
  }
  /* r\xFChmajuhataja aruande tabelis nimed scrolliks kaasa */
  .tertiary-table student-group-teacher-table tbody td:nth-child(2) {
    position: sticky;
    left: 0;
    background: white;
    z-index: 2;
  }
`;
  document.head.appendChild(style);
  registerFeature({
    id: "ui.pageTitle",
    label: "Lehe pealkiri navigatsioonist",
    description: "Uuendab brauseri vahelehe pealkirja viimase navigatsioonisamba teksti p\xF5hjal.",
    defaultEnabled: true
  });
  registerFeatureHandler({
    featureId: "ui.pageTitle",
    match: () => true,
    run() {
      const firstPath = window.location.href.match(/#\/([^\?\/]*)/)?.[1];
      let id = window.location.href.match(/\/(\d+)\//)?.[1] ?? "";
      id = id.length > 0 ? ` #${id}` : "";
      const lastBreadcrumb = document.querySelector("#breadcrumb-wrapper > span:last-child")?.textContent.trim() || firstPath || "Tahvel";
      document.title = lastBreadcrumb + id;
    }
  });
  registerFeature({
    id: "gradeHistory",
    label: "Hinnete ajaloo graafik",
    description: "N\xE4itab \xF5pilase hinnete ajalugu graafikul profiililehel.",
    defaultEnabled: true
  });
  registerFeatureHandler({
    featureId: "gradeHistory",
    match: () => ["/results", "/myResults"].some((p) => window.location.hash.includes(p)),
    async run() {
      if (!document.getElementById("grade-history-marker")) {
        await gradeHistory();
      }
    },
    cleanup() {
      document.getElementById("grade-history-marker")?.remove();
    }
  });
  generateMenuItems();
  initObserver();

  // src/modules/reports/stipend-eligibility/normalize.js
  function normalizeGroupReport(rawGroupData, groupCode) {
    if (!rawGroupData || !Array.isArray(rawGroupData.students)) return null;
    const journalNameById = buildJournalNameMap(rawGroupData);
    const out = { groupCode, students: [] };
    for (const s of rawGroupData.students) {
      const ns = {
        studentId: s.id,
        fullname: s.fullname,
        status: s.status,
        weightedAverageGrade: s.weightedAverageGrade ?? null,
        lessonAbsencePercentage: s.lessonAbsencePercentage ?? null,
        journalsById: {}
      };
      const cols = Array.isArray(s.resultColumns) ? s.resultColumns : [];
      for (const col of cols) {
        const jr = col?.journalResult;
        if (!jr?.id) continue;
        const journalId = jr.id;
        const results = Array.isArray(jr.results) ? jr.results : [];
        const existsInJournal = jr?.existsInJournal;
        if (existsInJournal === false && results.length === 0) continue;
        const fallbackSubject = journalNameById[journalId] ?? `Journal ${journalId}`;
        if (!ns.journalsById[journalId]) {
          ns.journalsById[journalId] = { journalId, subject: fallbackSubject, entries: [] };
        }
        for (const r of results) {
          const j = r.journal;
          const subject = j?.nameEt ?? j?.nameEn ?? j?.nameRu ?? fallbackSubject;
          if (ns.journalsById[journalId].subject?.startsWith("Journal ") && subject && !subject.startsWith("Journal ")) {
            ns.journalsById[journalId].subject = subject;
          }
          ns.journalsById[journalId].entries.push({
            journalId,
            subject: ns.journalsById[journalId].subject,
            teacher: r.gradeInsertedBy ?? null,
            entryType: r.entryType,
            entryDate: r.entryDate,
            gradeCode: r.grade?.code ?? null,
            gradeInserted: r.gradeInserted ?? null,
            studentEntryId: typeof r.studentEntryId === "number" ? r.studentEntryId : null
          });
        }
      }
      out.students.push(ns);
    }
    return out;
  }
  function buildJournalNameMap(rawGroupData) {
    const map = /* @__PURE__ */ Object.create(null);
    const moduleTypes = Array.isArray(rawGroupData?.moduleTypes) ? rawGroupData.moduleTypes : [];
    for (const mt of moduleTypes) {
      const modules = Array.isArray(mt?.modules) ? mt.modules : [];
      for (const m of modules) {
        const journals = Array.isArray(m?.journals) ? m.journals : [];
        for (const j of journals) {
          if (!j?.id) continue;
          const name = j?.nameEt ?? j?.nameEn ?? j?.nameRu ?? null;
          if (name) map[j.id] = name;
        }
      }
    }
    return map;
  }

  // src/modules/reports/stipend-eligibility/aggregate.js
  var NEGATIVE = /* @__PURE__ */ new Set([
    "KUTSEHINDAMINE_MA",
    "KUTSEHINDAMINE_X",
    "KUTSEHINDAMINE_1",
    "KUTSEHINDAMINE_2"
  ]);
  var DEFAULT_REGULAR_ENTRY_TYPES_AFTER_CUTOFF = /* @__PURE__ */ new Set([
    "SISSEKANNE_H",
    "SISSEKANNE_T",
    "SISSEKANNE_P",
    "SISSEKANNE_E",
    "SISSEKANNE_I",
    "SISSEKANNE_O"
  ]);
  function isNegative(code) {
    return code ? NEGATIVE.has(code) : false;
  }
  function normalizeDateOnly(value) {
    if (value == null) return null;
    const s = String(value).trim();
    if (!s) return null;
    return s.length >= 10 ? s.slice(0, 10) : null;
  }
  function normalizeEntryTypeSet(value) {
    if (!Array.isArray(value) || value.length === 0) return DEFAULT_REGULAR_ENTRY_TYPES_AFTER_CUTOFF;
    const out = /* @__PURE__ */ new Set();
    for (const t of value) {
      const normalized = String(t ?? "").trim().toUpperCase();
      if (normalized) out.add(normalized);
    }
    return out.size > 0 ? out : DEFAULT_REGULAR_ENTRY_TYPES_AFTER_CUTOFF;
  }
  function hasRegularActivityAfterCutoff(entries, cutoffDate, regularEntryTypeSet) {
    if (!cutoffDate || !Array.isArray(entries) || entries.length === 0) return false;
    for (const e of entries) {
      const entryDate = normalizeDateOnly(e?.entryDate);
      if (!entryDate || entryDate < cutoffDate) continue;
      if (regularEntryTypeSet.has(String(e?.entryType ?? "").toUpperCase())) return true;
    }
    return false;
  }
  function warn(logger, msg, payload) {
    if (!logger) return;
    try {
      logger(msg, payload ?? "");
    } catch {
    }
  }
  function createEmptyState() {
    return {
      studentStatMap: {},
      // studentId -> StudentStats-ish
      subjectStatMap: {},
      // journalId -> SubjectStats-ish
      groups: {},
      // groupCode -> StudentStats[]
      problematicJournalSet: /* @__PURE__ */ new Set()
      // Set<string journalId>
    };
  }
  function aggregateGroup(normalizedGroup, state, {
    logger = console.warn,
    missingGradeCutoffDate = null,
    regularEntryTypesAfterCutoff = null
  } = {}) {
    const groupCode = normalizedGroup.groupCode;
    if (!state.groups[groupCode]) state.groups[groupCode] = [];
    const cutoffDate = normalizeDateOnly(missingGradeCutoffDate);
    const regularEntryTypeSet = normalizeEntryTypeSet(regularEntryTypesAfterCutoff);
    const journalHasFinal = /* @__PURE__ */ Object.create(null);
    const journalHasPeriod = /* @__PURE__ */ Object.create(null);
    const journalHasFinalAfterCutoff = /* @__PURE__ */ Object.create(null);
    const journalHasPeriodAfterCutoff = /* @__PURE__ */ Object.create(null);
    for (const s of normalizedGroup.students) {
      for (const j of Object.values(s.journalsById)) {
        for (const e of j.entries) {
          if (!e.gradeCode) continue;
          if (e.entryType === "SISSEKANNE_L") {
            journalHasFinal[j.journalId] = true;
            if (cutoffDate) {
              const entryDate = normalizeDateOnly(e.entryDate);
              if (entryDate && entryDate >= cutoffDate) journalHasFinalAfterCutoff[j.journalId] = true;
            }
          }
          if (e.entryType === "SISSEKANNE_R") {
            journalHasPeriod[j.journalId] = true;
            if (cutoffDate) {
              const entryDate = normalizeDateOnly(e.entryDate);
              if (entryDate && entryDate >= cutoffDate) journalHasPeriodAfterCutoff[j.journalId] = true;
            }
          }
        }
      }
    }
    for (const s of normalizedGroup.students) {
      const studentStats = {
        id: s.studentId,
        fullname: s.fullname,
        groupCode,
        status: s.status,
        totalGrades: 0,
        totalFinalGrades: 0,
        totalPeriodGrades: 0,
        totalNegativeFinalGrades: 0,
        totalNegativePeriodGrades: 0,
        totalMissingFinalGrades: 0,
        totalMissingPeriodGrades: 0,
        weightedAverageGrade: s.weightedAverageGrade ?? null,
        lessonAbsencePercentage: s.lessonAbsencePercentage ?? null,
        problematicSubjects: [],
        exceptionCandidate: false,
        _negativeJournalIds: /* @__PURE__ */ new Set()
        // internal: journals where this student has negative period/final
      };
      const journals = Object.values(s.journalsById);
      for (const j of journals) {
        const journalId = j.journalId;
        const key = String(journalId);
        if (!state.subjectStatMap[key]) {
          state.subjectStatMap[key] = {
            journalId,
            subject: j.subject,
            totalGradeCount: 0,
            totalStudentsInSubject: 0,
            nonGradedStudents: 0,
            totalPeriodGrades: 0,
            totalFinalGrades: 0,
            firstEntryDate: null,
            lastEntryDate: null,
            teachers: /* @__PURE__ */ new Set(),
            groupCodes: /* @__PURE__ */ new Set(),
            studentsWithAnyGrade: 0,
            studentsWithFinal: 0,
            studentsWithNegativeFinal: 0,
            studentsMissingFinal: 0,
            problematicByRule: false,
            problematicReasons: []
          };
        }
        const subj = state.subjectStatMap[key];
        subj.groupCodes.add(groupCode);
        subj.totalStudentsInSubject += 1;
        let studentHasAnyGradeInSubject = false;
        let studentHasFinal = false;
        let studentHasPeriod = false;
        let studentHasNegativeFinal = false;
        let journalHasPositiveFinal = false;
        let journalHasNegativeFinal = false;
        let journalNegativePeriodCount = 0;
        for (const e of j.entries) {
          if (e.teacher) subj.teachers.add(e.teacher);
          if (e.entryDate) {
            const d = e.entryDate.slice(0, 10);
            subj.firstEntryDate = subj.firstEntryDate ? d < subj.firstEntryDate ? d : subj.firstEntryDate : d;
            subj.lastEntryDate = subj.lastEntryDate ? d > subj.lastEntryDate ? d : subj.lastEntryDate : d;
          }
          if (!e.gradeCode) {
            warn(logger, "Missing gradeCode; skipping entry", {
              groupCode,
              student: s.fullname,
              studentId: s.studentId,
              journalId,
              studentEntryId: e.studentEntryId,
              entryType: e.entryType,
              entryDate: e.entryDate
            });
            continue;
          }
          studentHasAnyGradeInSubject = true;
          studentStats.totalGrades += 1;
          subj.totalGradeCount += 1;
          if (e.entryType === "SISSEKANNE_R") {
            studentHasPeriod = true;
            studentStats.totalPeriodGrades += 1;
            subj.totalPeriodGrades += 1;
            if (isNegative(e.gradeCode)) journalNegativePeriodCount += 1;
          }
          if (e.entryType === "SISSEKANNE_L") {
            studentHasFinal = true;
            studentStats.totalFinalGrades += 1;
            subj.totalFinalGrades += 1;
            if (isNegative(e.gradeCode)) {
              journalHasNegativeFinal = true;
              studentStats.totalNegativeFinalGrades += 1;
              studentHasNegativeFinal = true;
              studentStats._negativeJournalIds.add(String(journalId));
            } else {
              journalHasPositiveFinal = true;
            }
          }
        }
        const shouldSuppressNegativePeriods = journalHasPositiveFinal && !journalHasNegativeFinal;
        if (journalNegativePeriodCount > 0 && !shouldSuppressNegativePeriods) {
          studentStats.totalNegativePeriodGrades += journalNegativePeriodCount;
          studentStats._negativeJournalIds.add(String(journalId));
        }
        if (!studentHasAnyGradeInSubject) subj.nonGradedStudents += 1;
        if (studentHasAnyGradeInSubject) subj.studentsWithAnyGrade += 1;
        if (studentHasFinal) subj.studentsWithFinal += 1;
        if (studentHasNegativeFinal) subj.studentsWithNegativeFinal += 1;
        const hasRegularAfterCutoff = hasRegularActivityAfterCutoff(j.entries, cutoffDate, regularEntryTypeSet);
        const suppressMissingFinalByCutoff = hasRegularAfterCutoff && journalHasFinalAfterCutoff[journalId] !== true;
        const suppressMissingPeriodByCutoff = hasRegularAfterCutoff && journalHasPeriodAfterCutoff[journalId] !== true;
        const shouldFlagPeriod = journalHasPeriod[journalId] === true && studentHasAnyGradeInSubject && !studentHasPeriod && !studentHasFinal && !suppressMissingPeriodByCutoff;
        const shouldFlagFinal = journalHasFinal[journalId] === true && studentHasAnyGradeInSubject && !studentHasFinal && !suppressMissingFinalByCutoff;
        if (shouldFlagPeriod) studentStats.totalMissingPeriodGrades += 1;
        if (shouldFlagFinal) {
          subj.studentsMissingFinal += 1;
          studentStats.totalMissingFinalGrades += 1;
        }
        if (shouldFlagPeriod || shouldFlagFinal) {
          const teacherGuess = [...j.entries].reverse().find((x) => x.teacher)?.teacher ?? "";
          const flags = [
            shouldFlagPeriod ? "missingPeriod" : null,
            shouldFlagFinal ? "missingFinal" : null
          ].filter(Boolean);
          studentStats.problematicSubjects.push({
            subject: j.subject,
            teacher: teacherGuess,
            flags
          });
        }
      }
      state.studentStatMap[s.studentId] = studentStats;
      state.groups[groupCode].push(studentStats);
    }
    return state;
  }
  function finalizeState(state) {
    const problematic = /* @__PURE__ */ new Set();
    for (const k of Object.keys(state.subjectStatMap)) {
      const subj = state.subjectStatMap[k];
      if (subj.teachers instanceof Set) subj.teachers = [...subj.teachers].sort();
      if (subj.groupCodes instanceof Set) subj.groupCodes = [...subj.groupCodes].sort((a, b) => a.localeCompare(b, "et"));
      const total = subj.totalStudentsInSubject || 0;
      if (!total) continue;
      const reasons = [];
      const negOrMissingFinal = (subj.studentsWithNegativeFinal || 0) + (subj.studentsMissingFinal || 0);
      const ratio = negOrMissingFinal / total;
      if ((subj.totalFinalGrades || 0) > 0 && ratio >= 0.75) {
        reasons.push(`NEG_OR_MISSING_FINAL_${Math.round(ratio * 100)}%`);
      }
      const nonGradedRatio = (subj.nonGradedStudents || 0) / total;
      if (nonGradedRatio >= 0.75) {
        reasons.push(`NOT_GRADED_${Math.round(nonGradedRatio * 100)}%`);
      }
      subj.problematicReasons = reasons;
      subj.problematicByRule = reasons.length > 0;
      if (subj.problematicByRule) problematic.add(String(subj.journalId));
    }
    state.problematicJournalSet = problematic;
    for (const studentId of Object.keys(state.studentStatMap)) {
      const st = state.studentStatMap[studentId];
      const negSet = st?._negativeJournalIds;
      const negativeJournalIds = negSet instanceof Set ? [...negSet] : [];
      const hasAnyNegative = negativeJournalIds.length > 0;
      const allNegativesInProblematic = negativeJournalIds.every((jid) => problematic.has(String(jid)));
      st.exceptionCandidate = hasAnyNegative && allNegativesInProblematic;
      if (st && "_negativeJournalIds" in st) delete st._negativeJournalIds;
    }
    return state;
  }
  function aggregateAll(normalizedGroups, opts) {
    const state = createEmptyState();
    for (const g of normalizedGroups) aggregateGroup(g, state, opts);
    return finalizeState(state);
  }

  // src/modules/reports/stipend-eligibility/tsv.js
  function tsvCell(value) {
    if (value === null || value === void 0) return "";
    return String(value).replace(/[\t\r\n]+/g, " ").trim();
  }
  function yesNo(value) {
    return value ? "true" : "false";
  }
  function uniqSorted(arr) {
    return [...new Set(arr)].sort((a, b) => String(a).localeCompare(String(b), "et"));
  }
  function studentToTsvRow(studentStats) {
    const problematic = Array.isArray(studentStats.problematicSubjects) ? studentStats.problematicSubjects : [];
    const missingPeriodSubjects = uniqSorted(
      problematic.filter((p) => Array.isArray(p.flags) && p.flags.includes("missingPeriod")).map((p) => p.subject)
    );
    const missingFinalSubjects = uniqSorted(
      problematic.filter((p) => Array.isArray(p.flags) && p.flags.includes("missingFinal")).map((p) => p.subject)
    );
    const problemSubjects = problematic.map((p) => {
      const flags = Array.isArray(p.flags) ? p.flags.join(",") : "";
      return `${p.subject}|${p.teacher ?? ""}|${flags}`;
    }).join(";");
    const cols = [
      studentStats.id,
      studentStats.groupCode,
      studentStats.fullname,
      studentStats.status,
      studentStats.weightedAverageGrade,
      studentStats.lessonAbsencePercentage,
      studentStats.totalGrades,
      studentStats.totalPeriodGrades,
      studentStats.totalFinalGrades,
      studentStats.totalNegativePeriodGrades,
      studentStats.totalNegativeFinalGrades,
      studentStats.totalMissingPeriodGrades,
      studentStats.totalMissingFinalGrades,
      problemSubjects,
      yesNo(studentStats.exceptionCandidate)
    ];
    return cols.map(tsvCell).join("	");
  }
  function exportStudentReportTsv(state, { groupCode = null, includeHeader = true, sortByName = true } = {}) {
    const header = [
      "id",
      "groupCode",
      "fullname",
      "status",
      "weightedAverageGrade",
      "lessonAbsencePercentage",
      "totalGrades",
      "totalPeriodGrades",
      "totalFinalGrades",
      "negativePeriodGrades",
      "negativeFinalGrades",
      "missingPeriodGradeCount",
      "missingFinalGradeCount",
      "problemSubjects",
      "exceptionCandidate"
    ].join("	");
    const groups = state?.groups ?? {};
    const groupCodes = groupCode ? [groupCode] : Object.keys(groups).sort((a, b) => a.localeCompare(b, "et"));
    const rows = [];
    for (const gc of groupCodes) {
      const students = Array.isArray(groups[gc]) ? [...groups[gc]] : [];
      if (sortByName) students.sort((a, b) => String(a.fullname).localeCompare(String(b.fullname), "et"));
      for (const st of students) rows.push(studentToTsvRow(st));
    }
    return (includeHeader ? [header, ...rows] : rows).join("\n");
  }
  function exportSubjectReportTsv(state, { onlyProblematic = true, includeHeader = true } = {}) {
    const header = [
      "journalId",
      "subject",
      "groupCodes",
      "teachers",
      "totalStudentsInSubject",
      "studentsWithFinal",
      "studentsWithNegativeFinal",
      "studentsMissingFinal",
      "nonGradedStudents",
      "reasons"
    ].join("	");
    const subjectStatMap = state?.subjectStatMap ?? {};
    const subjects = Object.values(subjectStatMap).filter((s) => !onlyProblematic || s.problematicByRule).sort((a, b) => {
      const aName = String(a.subject ?? "");
      const bName = String(b.subject ?? "");
      const nameCmp = aName.localeCompare(bName, "et");
      return nameCmp !== 0 ? nameCmp : (a.journalId ?? 0) - (b.journalId ?? 0);
    });
    const rows = subjects.map((s) => {
      const groupCodes = Array.isArray(s.groupCodes) ? s.groupCodes : s.groupCodes instanceof Set ? [...s.groupCodes].sort() : [];
      const teachers = Array.isArray(s.teachers) ? s.teachers : s.teachers instanceof Set ? [...s.teachers].sort() : [];
      const reasons = Array.isArray(s.problematicReasons) ? s.problematicReasons : [];
      const cols = [
        s.journalId,
        s.subject,
        groupCodes.join(";"),
        teachers.join(";"),
        s.totalStudentsInSubject,
        s.studentsWithFinal,
        s.studentsWithNegativeFinal,
        s.studentsMissingFinal,
        s.nonGradedStudents,
        reasons.join(";")
      ];
      return cols.map(tsvCell).join("	");
    });
    return (includeHeader ? [header, ...rows] : rows).join("\n");
  }

  // src/modules/reports/stipend-eligibility/windowApi.js
  function getRootWindow() {
    if (typeof unsafeWindow !== "undefined" && unsafeWindow) return unsafeWindow;
    if (typeof window !== "undefined" && window) return window;
    return null;
  }
  function getCookieValue(root, name) {
    try {
      const cookie = root?.document?.cookie ?? "";
      const parts = cookie.split(";");
      for (const p of parts) {
        const [k, ...rest] = p.trim().split("=");
        if (k === name) return rest.join("=");
      }
    } catch {
    }
    return null;
  }
  function createRequestHeaders(root) {
    const xsrf = getCookieValue(root, "XSRF-TOKEN");
    const headers = {
      Accept: "application/json, text/plain, */*",
      "X-Requested-With": "XMLHttpRequest"
    };
    if (xsrf) headers["X-XSRF-TOKEN"] = decodeURIComponent(xsrf);
    return headers;
  }
  async function fetchJsonWithAuth(root, url) {
    const res = await root.fetch(url, {
      credentials: "include",
      headers: createRequestHeaders(root)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Request failed (${res.status}) ${url}: ${text.slice(0, 200)}`);
    }
    return res.json();
  }
  function normalizeCode(value) {
    return String(value ?? "").trim().toUpperCase();
  }
  function findExactAutocompleteMatch(candidates, groupCode) {
    const wanted = normalizeCode(groupCode);
    if (!wanted || !Array.isArray(candidates)) return null;
    return candidates.find((c) => normalizeCode(c?.nameEt) === wanted) ?? candidates.find((c) => normalizeCode(c?.nameEn) === wanted) ?? candidates.find((c) => normalizeCode(c?.nameRu) === wanted) ?? null;
  }
  async function fetchAllStudentGroups({
    apiBase,
    isValid = true,
    lang = "ET",
    size = 200,
    sort = "CODE",
    logger = console.warn
  } = {}) {
    const root = getRootWindow();
    if (!root) throw new Error("No window context available");
    const base = apiBase ?? `${root.location.origin}/hois_back`;
    const all = [];
    let page = 0;
    let totalElements = null;
    let keepGoing = true;
    while (keepGoing) {
      const url = new URL(`${base}/studentgroups`);
      url.searchParams.set("isValid", String(Boolean(isValid)));
      url.searchParams.set("lang", String(lang));
      url.searchParams.set("page", String(page));
      url.searchParams.set("size", String(size));
      url.searchParams.set("sort", String(sort));
      const payload = await fetchJsonWithAuth(root, url.toString());
      const content = Array.isArray(payload?.content) ? payload.content : [];
      all.push(...content);
      if (typeof payload?.totalElements === "number") totalElements = payload.totalElements;
      const number = typeof payload?.number === "number" ? payload.number : page;
      const last = payload?.last === true;
      const totalPages = typeof payload?.totalPages === "number" ? payload.totalPages : null;
      if (last) {
        keepGoing = false;
      } else if (totalPages != null) {
        keepGoing = number + 1 < totalPages;
        page = number + 1;
      } else if (content.length >= size) {
        page += 1;
        keepGoing = true;
      } else {
        keepGoing = false;
      }
    }
    if (totalElements != null && all.length < totalElements) {
      try {
        logger("fetchAllStudentGroups fetched fewer groups than totalElements", {
          fetched: all.length,
          totalElements,
          size
        });
      } catch {
      }
    }
    return all;
  }
  async function fetchStudentGroupAutocomplete(groupCode, {
    apiBase,
    lang = "ET",
    basic = true,
    secondary = true,
    valid = true,
    vocational = true
  } = {}) {
    const root = getRootWindow();
    if (!root) throw new Error("No window context available");
    const base = apiBase ?? `${root.location.origin}/hois_back`;
    const url = new URL(`${base}/autocomplete/studentgroups`);
    url.searchParams.set("basic", String(Boolean(basic)));
    url.searchParams.set("lang", String(lang));
    url.searchParams.set("name", String(groupCode));
    url.searchParams.set("secondary", String(Boolean(secondary)));
    url.searchParams.set("valid", String(Boolean(valid)));
    url.searchParams.set("vocational", String(Boolean(vocational)));
    const payload = await fetchJsonWithAuth(root, url.toString());
    return Array.isArray(payload) ? payload : [];
  }
  async function resolveGroupReportParams(groupCode, opts = {}) {
    const candidates = await fetchStudentGroupAutocomplete(groupCode, opts);
    const exact = findExactAutocompleteMatch(candidates, groupCode);
    return {
      groupCode,
      exactMatchFound: Boolean(exact),
      studentGroup: exact?.id ?? null,
      curriculumVersion: exact?.curriculumVersion ?? null,
      autocompleteMatch: exact ?? null,
      autocompleteCandidates: candidates
    };
  }
  async function resolveAllGroupReportParams({
    apiBase,
    logger = console.warn,
    concurrency = 6,
    ...opts
  } = {}) {
    const groups = await fetchAllStudentGroups({ apiBase, logger, ...opts });
    const queue = groups.map((g) => ({
      id: g?.id ?? null,
      code: g?.code ?? "",
      teacher: g?.teacher ?? null,
      curriculumVersionFromGroups: g?.curriculumVersion ?? null,
      source: g
    }));
    const results = new Array(queue.length);
    const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, 20));
    let index = 0;
    async function worker() {
      while (true) {
        const cur = index;
        index += 1;
        if (cur >= queue.length) return;
        const item = queue[cur];
        try {
          const resolved = await resolveGroupReportParams(item.code, { apiBase, ...opts });
          const finalStudentGroup = resolved.studentGroup ?? item.id;
          results[cur] = {
            groupCode: item.code,
            studentGroup: finalStudentGroup,
            curriculumVersion: resolved.curriculumVersion,
            exactMatchFound: resolved.exactMatchFound,
            groupIdFromStudentGroups: item.id,
            curriculumVersionFromStudentGroups: item.curriculumVersionFromGroups,
            teacher: item.teacher,
            autocompleteMatch: resolved.autocompleteMatch,
            autocompleteCandidates: resolved.autocompleteCandidates,
            source: item.source
          };
        } catch (error) {
          try {
            logger("Failed to resolve group report params", {
              groupCode: item.code,
              error: error?.message ?? String(error)
            });
          } catch {
          }
          results[cur] = {
            groupCode: item.code,
            studentGroup: item.id,
            curriculumVersion: item.curriculumVersionFromGroups,
            exactMatchFound: false,
            groupIdFromStudentGroups: item.id,
            curriculumVersionFromStudentGroups: item.curriculumVersionFromGroups,
            teacher: item.teacher,
            autocompleteMatch: null,
            autocompleteCandidates: [],
            source: item.source,
            error: error?.message ?? String(error)
          };
        }
      }
    }
    const workers = [];
    for (let i = 0; i < workerCount; i++) workers.push(worker());
    await Promise.all(workers);
    const unresolved = results.filter((r) => !r?.exactMatchFound || r?.curriculumVersion == null);
    if (unresolved.length > 0) {
      try {
        logger("resolveAllGroupReportParams has unresolved groups", {
          unresolvedCount: unresolved.length,
          total: results.length,
          sample: unresolved.slice(0, 10).map((r) => ({
            groupCode: r.groupCode,
            exactMatchFound: r.exactMatchFound,
            curriculumVersion: r.curriculumVersion
          }))
        });
      } catch {
      }
    }
    return {
      groups,
      resolved: results,
      unresolved,
      summary: {
        totalGroups: results.length,
        exactMatches: results.filter((r) => r?.exactMatchFound).length,
        withCurriculumVersion: results.filter((r) => r?.curriculumVersion != null).length,
        unresolved: unresolved.length
      }
    };
  }
  async function aggregateAndExportAllGroups({
    apiBase,
    logger = console.warn,
    resolverOptions,
    reportOptions,
    aggregationOptions,
    concurrency = 4,
    includeHeader = true,
    sortByName = true
  } = {}) {
    const resolvedPack = await resolveAllGroupReportParams({
      apiBase,
      logger,
      ...resolverOptions ?? {}
    });
    const resolved = Array.isArray(resolvedPack?.resolved) ? resolvedPack.resolved : [];
    const ready = resolved.filter((r) => r?.studentGroup != null && r?.curriculumVersion != null);
    const skipped = resolved.filter((r) => r?.studentGroup == null || r?.curriculumVersion == null);
    const normalizedGroups = [];
    const fetchErrors = [];
    const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, 20));
    let index = 0;
    async function worker() {
      while (true) {
        const cur = index;
        index += 1;
        if (cur >= ready.length) return;
        const item = ready[cur];
        try {
          const raw = await fetchGroupTeacherReport(item.groupCode, {
            apiBase,
            studentGroup: item.studentGroup,
            curriculumVersion: item.curriculumVersion,
            ...reportOptions ?? {}
          });
          const normalized = normalizeGroupReport(raw, item.groupCode);
          if (!normalized) {
            throw new Error("normalizeGroupReport returned null");
          }
          normalizedGroups.push(normalized);
        } catch (error) {
          const failure = {
            groupCode: item.groupCode,
            studentGroup: item.studentGroup,
            curriculumVersion: item.curriculumVersion,
            error: error?.message ?? String(error)
          };
          fetchErrors.push(failure);
          try {
            logger("Failed to fetch/normalize group report", failure);
          } catch {
          }
        }
      }
    }
    const workers = [];
    for (let i = 0; i < workerCount; i++) workers.push(worker());
    await Promise.all(workers);
    const state = aggregateAll(normalizedGroups, {
      logger,
      ...aggregationOptions ?? {}
    });
    const tsv = exportStudentReportTsv(state, { includeHeader, sortByName });
    const totalStudents = Object.values(state?.groups ?? {}).reduce((acc, arr) => {
      return acc + (Array.isArray(arr) ? arr.length : 0);
    }, 0);
    return {
      state,
      tsv,
      resolved,
      unresolved: resolvedPack?.unresolved ?? [],
      skipped,
      fetchErrors,
      summary: {
        totalGroupsDiscovered: resolved.length,
        groupsReadyForFetch: ready.length,
        groupsFetched: normalizedGroups.length,
        groupsSkipped: skipped.length,
        groupsFailed: fetchErrors.length,
        totalStudents
      }
    };
  }
  function toSerializableSnapshotData(data) {
    if (!data || typeof data !== "object") return data;
    const state = data?.state && typeof data.state === "object" ? {
      ...data.state,
      problematicJournalSet: [...data.state.problematicJournalSet ?? []]
    } : null;
    if (!state) return { ...data };
    return { ...data, state };
  }
  function fromSerializableSnapshotData(data) {
    if (!data || typeof data !== "object") return data;
    if (!data?.state || typeof data.state !== "object") return { ...data };
    const state = {
      ...data.state,
      problematicJournalSet: new Set(data.state.problematicJournalSet ?? [])
    };
    return { ...data, state };
  }
  function saveSnapshotToLocalStorage(data, { key = "stipendEligibilitySnapshot" } = {}) {
    const root = getRootWindow();
    if (!root) throw new Error("No window context available");
    if (!root.localStorage) throw new Error("localStorage is not available");
    const serializable = toSerializableSnapshotData(data);
    const payload = {
      ...serializable,
      savedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    root.localStorage.setItem(String(key), JSON.stringify(payload));
    return payload;
  }
  function loadSnapshotFromLocalStorage({ key = "stipendEligibilitySnapshot" } = {}) {
    const root = getRootWindow();
    if (!root) throw new Error("No window context available");
    if (!root.localStorage) throw new Error("localStorage is not available");
    const raw = root.localStorage.getItem(String(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return fromSerializableSnapshotData(parsed);
  }
  function buildStudentGroupTeacherReportUrl(base, {
    studentGroup,
    curriculumVersion,
    from,
    canceledStudents = false,
    graduatedStudents = false,
    lang = "ET",
    studyYear = "",
    weightedAverageGrade = true,
    entryType,
    entryTypes
  } = {}) {
    if (studentGroup == null) throw new Error("studentGroup is required");
    if (curriculumVersion == null) throw new Error("curriculumVersion is required");
    const defaultEntryType = {
      SISSEKANNE_H: true,
      SISSEKANNE_R: true,
      SISSEKANNE_O: false,
      SISSEKANNE_L: true,
      SISSEKANNE_P: true,
      SISSEKANNE_T: true,
      SISSEKANNE_E: true,
      SISSEKANNE_I: true
    };
    const finalEntryType = entryType ?? defaultEntryType;
    const finalEntryTypes = entryTypes ?? Object.keys(finalEntryType).filter((k) => Boolean(finalEntryType[k]));
    const url = new URL(`${base}/reports/studentgroupteacher`);
    const sp = url.searchParams;
    sp.set("canceledStudents", String(Boolean(canceledStudents)));
    sp.set("curriculumVersion", String(curriculumVersion));
    sp.set("entryType", JSON.stringify(finalEntryType));
    for (const t of finalEntryTypes) sp.append("entryTypes", String(t));
    if (from) sp.set("from", String(from));
    sp.set("graduatedStudents", String(Boolean(graduatedStudents)));
    sp.set("lang", String(lang));
    sp.set("studentGroup", String(studentGroup));
    sp.set("studyYear", String(studyYear ?? ""));
    sp.set("weightedAverageGrade", String(Boolean(weightedAverageGrade)));
    return url.toString();
  }
  async function fetchGroupTeacherReport(groupCode, {
    apiBase,
    // New report endpoint params (copied from browser request)
    studentGroup,
    curriculumVersion,
    from,
    canceledStudents,
    graduatedStudents,
    lang,
    studyYear,
    weightedAverageGrade,
    entryType,
    entryTypes,
    // Force old endpoint if needed
    useLegacyTeacherEndpoint = false
  } = {}) {
    const root = getRootWindow();
    if (!root) throw new Error("No window context available");
    const base = apiBase ?? `${root.location.origin}/hois_back`;
    const shouldUseReportEndpoint = !useLegacyTeacherEndpoint && (studentGroup != null || curriculumVersion != null || from != null || entryType != null || entryTypes != null);
    const url = shouldUseReportEndpoint ? buildStudentGroupTeacherReportUrl(base, {
      studentGroup,
      curriculumVersion,
      from,
      canceledStudents,
      graduatedStudents,
      lang,
      studyYear,
      weightedAverageGrade,
      entryType,
      entryTypes
    }) : `${base}/teacher/studentGroupTeacherReport?studentGroupCode=${encodeURIComponent(groupCode)}`;
    return fetchJsonWithAuth(root, url);
  }
  async function buildStateForGroup(groupCode, {
    logger = console.warn,
    apiBase,
    aggregationOptions,
    ...fetchOpts
  } = {}) {
    const raw = await fetchGroupTeacherReport(groupCode, { apiBase, ...fetchOpts });
    const normalized = normalizeGroupReport(raw, groupCode);
    if (!normalized) throw new Error("normalizeGroupReport returned null");
    return aggregateAll([normalized], {
      logger,
      ...aggregationOptions ?? {}
    });
  }
  function attachToWindow() {
    const root = getRootWindow();
    if (!root) return;
    if (!root.reports) root.reports = {};
    if (!root.reports.stipend) root.reports.stipend = {};
    Object.assign(root.reports.stipend, {
      normalizeGroupReport,
      aggregateAll,
      exportStudentReportTsv,
      exportSubjectReportTsv,
      studentToTsvRow,
      fetchAllStudentGroups,
      fetchStudentGroupAutocomplete,
      resolveGroupReportParams,
      resolveAllGroupReportParams,
      aggregateAndExportAllGroups,
      saveSnapshotToLocalStorage,
      loadSnapshotFromLocalStorage,
      fetchGroupTeacherReport,
      buildStudentGroupTeacherReportUrl,
      buildStateForGroup
    });
  }
  attachToWindow();
})();
