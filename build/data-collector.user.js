// ==UserScript==
// @name         Data collector
// @namespace    https://tahvel.edu.ee/
// @version      1.1.1
// @description  Student data collector for Tahvel.
// @author       Sven Laht
// @match        https://tahvel.edu.ee/*
// @updateURL    https://raw.githubusercontent.com/Tallinna-Polutehnikum/tahvel-userscripts/main/build/data-collector.user.js
// @downloadURL  https://raw.githubusercontent.com/Tallinna-Polutehnikum/tahvel-userscripts/main/build/data-collector.user.js
// @grant        GM_log
// @grant        GM_registerMenuCommand
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

  // env-ns:env
  var SERVER_URL = "https://spea-oppeinfo-backend-degadahhfye5dwdq.northeurope-01.azurewebsites.net";
  var MSAL_CLIENT_ID = "fcac3ba0-9a07-43b7-89b5-d030e32bae00";
  var MSAL_TENANT_ID = "b1d764c3-8351-46bf-8da7-32febf83332d";

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
          clientId: MSAL_CLIENT_ID,
          authority: "https://login.microsoftonline.com/" + MSAL_TENANT_ID,
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
        this.msalInstance.acquireTokenSilent({ scopes: [MSAL_CLIENT_ID + "/.default"], account: this.#accounts[0] });
        return true;
      } catch (error) {
        console.error("Token acquisition failed: ", error);
        return false;
      }
    }
    async getToken() {
      const silentRequest = { scopes: [MSAL_CLIENT_ID + "/.default"], account: this.#accounts[0] };
      if (!this.checkAuth()) {
        this.login();
        return null;
      }
      try {
        const response2 = await this.msalInstance.acquireTokenSilent(silentRequest);
        return await response2.accessToken;
      } catch (error) {
        console.error("Silent token acquisition failed: ", error);
        this.login();
        return null;
      }
    }
  };

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
    const journalHasParticipants = /* @__PURE__ */ Object.create(null);
    for (const s of normalizedGroup.students) {
      for (const j of Object.values(s.journalsById)) {
        if (Array.isArray(j.entries) && j.entries.length > 0) {
          journalHasParticipants[j.journalId] = true;
        }
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
        const shouldIncludeJournalStats = journalHasParticipants[journalId] === true;
        if (!shouldIncludeJournalStats) continue;
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
        const journalStats = state.subjectStatMap[key];
        journalStats.groupCodes.add(groupCode);
        journalStats.totalStudentsInSubject += 1;
        let studentHasAnyGradeInSubject = false;
        let studentHasFinal = false;
        let studentHasPeriod = false;
        let studentHasNegativeFinal = false;
        let journalHasPositiveFinal = false;
        let journalHasNegativeFinal = false;
        let journalNegativePeriodCount = 0;
        console.log("Processing entries for student", s.fullname, "in subject", j.subject, "with journalId", journalId);
        console.log("Entries:", j.entries);
        for (const e of j.entries) {
          if (e.teacher) journalStats.teachers.add(e.teacher);
          if (e.entryDate) {
            const d = e.entryDate.slice(0, 10);
            journalStats.firstEntryDate = journalStats.firstEntryDate ? d < journalStats.firstEntryDate ? d : journalStats.firstEntryDate : d;
            journalStats.lastEntryDate = journalStats.lastEntryDate ? d > journalStats.lastEntryDate ? d : journalStats.lastEntryDate : d;
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
          journalStats.totalGradeCount += 1;
          if (e.entryType === "SISSEKANNE_R") {
            studentHasPeriod = true;
            studentStats.totalPeriodGrades += 1;
            journalStats.totalPeriodGrades += 1;
            if (isNegative(e.gradeCode)) journalNegativePeriodCount += 1;
          }
          if (e.entryType === "SISSEKANNE_L") {
            studentHasFinal = true;
            studentStats.totalFinalGrades += 1;
            journalStats.totalFinalGrades += 1;
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
        if (!studentHasAnyGradeInSubject) journalStats.nonGradedStudents += 1;
        if (studentHasAnyGradeInSubject) journalStats.studentsWithAnyGrade += 1;
        if (studentHasFinal) journalStats.studentsWithFinal += 1;
        if (studentHasNegativeFinal) journalStats.studentsWithNegativeFinal += 1;
        const hasRegularAfterCutoff = hasRegularActivityAfterCutoff(j.entries, cutoffDate, regularEntryTypeSet);
        const suppressMissingFinalByCutoff = hasRegularAfterCutoff && journalHasFinalAfterCutoff[journalId] !== true;
        const suppressMissingPeriodByCutoff = hasRegularAfterCutoff && journalHasPeriodAfterCutoff[journalId] !== true;
        const shouldFlagPeriod = journalHasPeriod[journalId] === true && studentHasAnyGradeInSubject && !studentHasPeriod && !studentHasFinal && !suppressMissingPeriodByCutoff;
        const shouldFlagFinal = journalHasFinal[journalId] === true && studentHasAnyGradeInSubject && !studentHasFinal && !suppressMissingFinalByCutoff;
        if (shouldFlagPeriod) studentStats.totalMissingPeriodGrades += 1;
        if (shouldFlagFinal) {
          journalStats.studentsMissingFinal += 1;
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

  // src/utils/localStorageCache.js
  var DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
  function createLocalStorageCache({
    storageKey,
    ttlMs = DEFAULT_TTL_MS,
    normalizeKey = (k) => String(k ?? "").trim(),
    getLocalStorage = () => typeof localStorage !== "undefined" ? localStorage : null
  } = {}) {
    if (!storageKey) throw new Error("createLocalStorageCache: storageKey is required");
    function storage() {
      return getLocalStorage();
    }
    function loadRaw() {
      const ls = storage();
      if (!ls) return {};
      try {
        const raw = ls.getItem(storageKey);
        if (!raw) return {};
        return JSON.parse(raw) ?? {};
      } catch {
        return {};
      }
    }
    function saveRaw(data) {
      const ls = storage();
      if (!ls) return;
      try {
        ls.setItem(storageKey, JSON.stringify(data));
      } catch {
      }
    }
    function isExpired(entry) {
      if (!entry || typeof entry.cachedAt !== "number") return true;
      return Date.now() - entry.cachedAt > ttlMs;
    }
    return {
      /**
       * Returns the cached value for the given key.
       * - `undefined`: not in cache or entry expired (fetch required)
       * - `null`:      cached negative (previous lookup found nothing)
       * - value:       the cached value
       */
      get(key) {
        const normalized = normalizeKey(key);
        if (!normalized) return void 0;
        const data = loadRaw();
        if (!Object.prototype.hasOwnProperty.call(data, normalized)) return void 0;
        const entry = data[normalized];
        if (isExpired(entry)) {
          delete data[normalized];
          saveRaw(data);
          return void 0;
        }
        return entry.value ?? null;
      },
      /** Stores a value (or null for a negative result) against the key. */
      set(key, value) {
        const normalized = normalizeKey(key);
        if (!normalized) return;
        const data = loadRaw();
        data[normalized] = { value: value ?? null, cachedAt: Date.now() };
        saveRaw(data);
      },
      /** Removes a single entry by key. */
      delete(key) {
        const normalized = normalizeKey(key);
        if (!normalized) return;
        const data = loadRaw();
        if (!Object.prototype.hasOwnProperty.call(data, normalized)) return;
        delete data[normalized];
        saveRaw(data);
      },
      /** Removes all entries (clears the entire localStorage key). */
      clear() {
        const ls = storage();
        if (!ls) return;
        try {
          ls.removeItem(storageKey);
        } catch {
        }
      },
      /** Returns the raw stored data object (useful for debugging/inspection). */
      dump() {
        return loadRaw();
      }
    };
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
  var groupCodeCache = createLocalStorageCache({
    storageKey: "groupFromCodeAutocompleteCache",
    normalizeKey: (k) => String(k ?? "").trim().toUpperCase(),
    getLocalStorage: () => getRootWindow()?.localStorage ?? null
  });
  async function fetchGroupByCode(groupCode, {
    apiBase,
    lang = "ET",
    basic = true,
    secondary = true,
    valid = true,
    vocational = true
  } = {}) {
    const cached = groupCodeCache.get(groupCode);
    if (cached !== void 0) return cached;
    const root = getRootWindow();
    if (!root) throw new Error("No window context available");
    const base = apiBase ?? `${root.location.origin}/hois_back`;
    const wanted = normalizeCode(groupCode);
    const url = new URL(`${base}/autocomplete/studentgroups`);
    url.searchParams.set("basic", String(Boolean(basic)));
    url.searchParams.set("lang", String(lang));
    url.searchParams.set("name", String(groupCode));
    url.searchParams.set("secondary", String(Boolean(secondary)));
    url.searchParams.set("valid", String(Boolean(valid)));
    url.searchParams.set("vocational", String(Boolean(vocational)));
    const candidates = await fetchJsonWithAuth(root, url.toString());
    const group = !Array.isArray(candidates) || !wanted ? null : candidates.find((c) => normalizeCode(c?.nameEt) === wanted) ?? candidates.find((c) => normalizeCode(c?.nameEn) === wanted) ?? candidates.find((c) => normalizeCode(c?.nameRu) === wanted) ?? null;
    groupCodeCache.set(groupCode, group);
    return group;
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
  async function resolveGroupReportParams(groupCode, opts = {}) {
    const group = await fetchGroupByCode(groupCode, opts);
    return {
      groupCode,
      exactMatchFound: Boolean(group),
      studentGroup: group?.id ?? null,
      curriculumVersion: group?.curriculumVersion ?? null,
      group: group ?? null
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
            group: resolved.group,
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
            group: null,
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
      fetchGroupByCode,
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

  // src/modules/studentData.js
  var auth = new Authentication();
  var STUDENT_DATA_LAST_RUN_KEY = "tahvelUserscripts.studentData.lastRunAt";
  var isCollectionInProgress = false;
  function getIsoWeekInfo(date) {
    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((utcDate - yearStart) / 864e5 + 1) / 7);
    return {
      year: utcDate.getUTCFullYear(),
      week
    };
  }
  function getIsoWeekKey(date) {
    const { year, week } = getIsoWeekInfo(date);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }
  function getLastRunDateFromStorage() {
    try {
      const stored = localStorage.getItem(STUDENT_DATA_LAST_RUN_KEY);
      if (!stored) return null;
      const parsed = new Date(stored);
      return Number.isFinite(parsed.getTime()) ? parsed : null;
    } catch (err) {
      console.warn("Unable to read student data last run from localStorage", err);
      return null;
    }
  }
  function hasRunInCurrentWeek(now = /* @__PURE__ */ new Date()) {
    const lastRunDate = getLastRunDateFromStorage();
    if (!lastRunDate) return false;
    return getIsoWeekKey(lastRunDate) === getIsoWeekKey(now);
  }
  function storeLastRunDate(date = /* @__PURE__ */ new Date()) {
    try {
      localStorage.setItem(STUDENT_DATA_LAST_RUN_KEY, date.toISOString());
    } catch (err) {
      console.warn("Unable to store student data last run in localStorage", err);
    }
  }
  async function maybeRunStudentDataForCurrentWeek() {
    const now = /* @__PURE__ */ new Date();
    if (now.getDay() !== 1) return;
    if (hasRunInCurrentWeek(now)) return;
    await calculateStudentData({ source: "auto" });
  }
  var NEGATIVE_GRADE_CODES = /* @__PURE__ */ new Set(["X", "MA", "1", "2"]);
  function getGradeBucket(gradeCode) {
    if (typeof gradeCode !== "string") return null;
    const suffix = gradeCode.split("_").pop();
    if (!suffix) return null;
    if (NEGATIVE_GRADE_CODES.has(suffix)) return "negative";
    if (suffix === "3") return "fine";
    if (suffix === "4") return "good";
    if (suffix === "5" || suffix === "A") return "great";
    return null;
  }
  function incrementGradeBucket(counts, bucket, isFinal) {
    if (!bucket) return;
    const key = isFinal ? `final${bucket.charAt(0).toUpperCase()}${bucket.slice(1)}Grades` : `${bucket}Grades`;
    counts[key] += 1;
  }
  function getEntryTimestamp(entry) {
    const sourceDate = entry?.entryDate ?? entry?.gradeInserted ?? null;
    if (!sourceDate) return 0;
    const parsed = Date.parse(sourceDate);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function pickEffectivePeriodBucket(periodEntries) {
    if (!Array.isArray(periodEntries) || periodEntries.length === 0) return null;
    const negativePeriod = periodEntries.find((entry) => getGradeBucket(entry?.grade?.code) === "negative");
    if (negativePeriod) return "negative";
    let latest = null;
    let latestTs = -Infinity;
    for (const entry of periodEntries) {
      const bucket = getGradeBucket(entry?.grade?.code);
      if (!bucket) continue;
      const ts = getEntryTimestamp(entry);
      if (!latest || ts >= latestTs) {
        latest = bucket;
        latestTs = ts;
      }
    }
    return latest;
  }
  function pickLatestFinalBucket(finalEntries) {
    if (!Array.isArray(finalEntries) || finalEntries.length === 0) return null;
    let latest = null;
    let latestTs = -Infinity;
    for (const entry of finalEntries) {
      const bucket = getGradeBucket(entry?.grade?.code);
      if (!bucket) continue;
      const ts = getEntryTimestamp(entry);
      if (!latest || ts >= latestTs) {
        latest = bucket;
        latestTs = ts;
      }
    }
    return latest;
  }
  function normalizeCurriculumVersion(value) {
    if (typeof value === "number" || typeof value === "string") return value;
    if (value && typeof value === "object") {
      if (typeof value.id === "number" || typeof value.id === "string") return value.id;
    }
    return null;
  }
  function buildStudentGroupTeacherReportUrl2(groupId, curriculumVersion) {
    const url = new URL("https://tahvel.edu.ee/hois_back/reports/studentgroupteacher");
    const entryTypeMap = {
      SISSEKANNE_H: true,
      SISSEKANNE_R: true,
      SISSEKANNE_O: false,
      SISSEKANNE_L: true,
      SISSEKANNE_P: true,
      SISSEKANNE_T: true,
      SISSEKANNE_E: true,
      SISSEKANNE_I: true
    };
    const sp = url.searchParams;
    sp.set("canceledStudents", "false");
    sp.set("curriculumVersion", String(curriculumVersion));
    sp.set("entryType", JSON.stringify(entryTypeMap));
    for (const type of Object.keys(entryTypeMap)) {
      if (entryTypeMap[type]) sp.append("entryTypes", type);
    }
    sp.set("from", "2022-08-01T00:00:00.000Z");
    sp.set("graduatedStudents", "false");
    sp.set("lang", "ET");
    sp.set("studentGroup", String(groupId));
    sp.set("studyYear", "");
    return url.toString();
  }
  function countStudentGrades(student) {
    const counts = {
      negativeGrades: 0,
      finalNegativeGrades: 0,
      fineGrades: 0,
      finalFineGrades: 0,
      goodGrades: 0,
      finalGoodGrades: 0,
      greatGrades: 0,
      finalGreatGrades: 0
    };
    const resultColumns = Array.isArray(student?.resultColumns) ? student.resultColumns : [];
    for (const column of resultColumns) {
      const journalResult = column?.journalResult;
      if (!journalResult) continue;
      const results = Array.isArray(journalResult.results) ? journalResult.results : [];
      if (journalResult.existsInJournal === false && results.length === 0) continue;
      const finalEntries = [];
      const periodEntries = [];
      for (const result of results) {
        const bucket = getGradeBucket(result?.grade?.code);
        if (!bucket) continue;
        if (result?.entryType === "SISSEKANNE_L") {
          finalEntries.push(result);
          continue;
        }
        if (result?.entryType === "SISSEKANNE_R") {
          periodEntries.push(result);
          continue;
        }
        incrementGradeBucket(counts, bucket, false);
      }
      const finalBucket = pickLatestFinalBucket(finalEntries) ?? pickEffectivePeriodBucket(periodEntries);
      incrementGradeBucket(counts, finalBucket, true);
    }
    return counts;
  }
  function getTotalGradeCount(grades) {
    return (grades?.negativeGrades ?? 0) + (grades?.finalNegativeGrades ?? 0) + (grades?.fineGrades ?? 0) + (grades?.finalFineGrades ?? 0) + (grades?.goodGrades ?? 0) + (grades?.finalGoodGrades ?? 0) + (grades?.greatGrades ?? 0) + (grades?.finalGreatGrades ?? 0);
  }
  async function calculateStudentData({ source = "manual" } = {}) {
    if (isCollectionInProgress) {
      alert("Student data collection is already running.");
      return;
    }
    isCollectionInProgress = true;
    const requestId = Math.floor(Math.random() * 1e6);
    let groupData;
    let encounteredPostError = false;
    alert(`Starting student data collection${source === "auto" ? " (weekly auto-run)" : ""}. This may take a while, keep your browser tab active.`);
    try {
      try {
        groupData = await fetch("https://tahvel.edu.ee/hois_back/studentgroups?isValid=false&lang=ET&page=0&size=1&sort=CODE");
        groupData = await groupData.json();
        groupData = await fetch(
          `https://tahvel.edu.ee/hois_back/studentgroups?isValid=false&lang=ET&page=0&size=${groupData.totalElements}&sort=CODE`
        );
        groupData = await groupData.json();
      } catch (err) {
        if (err.message.includes("Bad")) {
          console.error("Stopping due to 400 bad request.");
          alert("Please check your credentials.");
          return;
        } else {
          console.error(err);
          alert("An error occurred while fetching group data. Check console for details.");
          return;
        }
      }
      try {
        await postUntilSuccess(SERVER_URL + "/api/StudentRecord/switch", { id: requestId, isOn: true });
      } catch (err) {
        if (err.message.includes("Unauthorized")) {
          console.error("Stopping due to 401 Unauthorized response.");
          alert("Unauthorized access. Please check your credentials.");
          return;
        } else {
          console.error(err);
          alert("An error occurred while switching on the server. Check console for details.");
          return;
        }
      }
      const bestStudentDataById = /* @__PURE__ */ new Map();
      const totalGroups = groupData.content.length;
      let groupIndex = 0;
      for (const groupEntry of groupData.content) {
        groupIndex++;
        if (groupIndex % 5 === 0 || groupIndex === totalGroups) {
          console.log(`${(groupIndex / totalGroups * 100).toFixed(0)}% Processing group ${groupIndex} of ${totalGroups} (${groupEntry.code})`);
        }
        const cachedMatch = await fetchGroupByCode(groupEntry?.code, { valid: false });
        const resolvedGroupId = cachedMatch?.id ?? groupEntry.id;
        const curriculumVersion = normalizeCurriculumVersion(
          cachedMatch?.curriculumVersion ?? groupEntry?.curriculumVersion
        );
        if (curriculumVersion == null) {
          console.warn("Skipping group because curriculumVersion is missing", {
            groupId: groupEntry?.id,
            groupCode: groupEntry?.code,
            cachedMatchFound: cachedMatch != null
          });
          continue;
        }
        const reportUrl = buildStudentGroupTeacherReportUrl2(resolvedGroupId, curriculumVersion);
        const groupResponse = await fetch(reportUrl);
        if (!groupResponse.ok) {
          console.error(`Failed to fetch report for group ${groupEntry.id} (${groupEntry.code}) with status ${groupResponse.status}`);
          continue;
        }
        const group = await groupResponse.json();
        if (group.students.length === 0) {
          continue;
        }
        for (const student of group.students) {
          const {
            negativeGrades,
            finalNegativeGrades,
            fineGrades,
            finalFineGrades,
            goodGrades,
            finalGoodGrades,
            greatGrades,
            finalGreatGrades
          } = countStudentGrades(student);
          const absenceWithReason = student?.absenceTypeTotals?.PUUDUMINE_V ?? 0;
          const absenceNoReason = student?.absenceTypeTotals?.PUUDUMINE_P ?? 0;
          let studentData = {
            id: student.id,
            name: student.fullname,
            groupId: groupEntry.id,
            groupCode: groupEntry.code,
            grades: {
              negativeGrades,
              finalNegativeGrades,
              fineGrades,
              finalFineGrades,
              goodGrades,
              finalGoodGrades,
              greatGrades,
              finalGreatGrades
            },
            absences: { absenceWithReason, absenceNoReason, calculatedMetric: student.lessonAbsencePercentage ?? 0 }
          };
          const existingStudentData = bestStudentDataById.get(studentData.id);
          if (!existingStudentData) {
            bestStudentDataById.set(studentData.id, studentData);
            continue;
          }
          const nextTotal = getTotalGradeCount(studentData.grades);
          const existingTotal = getTotalGradeCount(existingStudentData.grades);
          if (nextTotal > existingTotal) bestStudentDataById.set(studentData.id, studentData);
        }
      }
      console.log(`Collected data for ${bestStudentDataById.size} unique students across ${groupData.totalElements} groups.`);
      let count = 0;
      for (const studentData of bestStudentDataById.values()) {
        try {
          await postUntilSuccess(SERVER_URL + "/api/StudentRecord", studentData);
          count++;
          if (count % 100 === 0) {
            console.log(`${(count / bestStudentDataById.size * 100).toFixed(0)}% Posted data for ${count} of ${bestStudentDataById.size} students.`);
          }
        } catch (err) {
          encounteredPostError = true;
          if (err.message.includes("Unauthorized")) {
            console.error("Stopping due to 401 Unauthorized response.");
            alert("Unauthorized access. Please check your credentials.");
            break;
          } else {
            console.error(err);
            alert("An error occurred while posting student data. Check console for details.");
            break;
          }
        }
      }
      try {
        await postUntilSuccess(SERVER_URL + "/api/StudentRecord/switch", { id: requestId, isOn: false });
      } catch (err) {
        if (err.message.includes("Unauthorized")) {
          console.error("Stopping due to 401 Unauthorized response.");
          alert("Unauthorized access. Please check your credentials.");
          return;
        } else {
          console.error(err);
          alert("An error occurred while switching off the server. Check console for details.");
          return;
        }
      }
      if (encounteredPostError) {
        console.warn("Student data collection ended with posting errors. Last run timestamp was not updated.");
        return;
      }
      storeLastRunDate(/* @__PURE__ */ new Date());
      console.log("Student data collection complete.");
    } finally {
      isCollectionInProgress = false;
    }
  }
  async function postUntilSuccess(url, data, maxRetries = 5, delayMs = 500) {
    let retries = 0;
    const token = await auth.getToken();
    while (retries < maxRetries) {
      const response2 = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
          // Add the token here
        },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (response2.status === 200) {
        return;
      } else if (response2.status === 401) {
        throw new Error(`Unauthorized: Access token may be invalid or expired.`);
      } else {
        retries++;
        console.log(`Attempt ${retries} failed with status ${response2.status} for student ${data.id}. Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw new Error(`Max retries reached without success for student ${data.id}. Last response status: ${response.status}`);
  }

  // src/data-collector.js
  if (typeof globalThis.GM_registerMenuCommand === "function") {
    globalThis.GM_registerMenuCommand("Run student data collection now", () => {
      void calculateStudentData({ source: "menu" });
    });
  }
  void maybeRunStudentDataForCurrentWeek();
})();
