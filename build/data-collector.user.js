// ==UserScript==
// @name         Data collector
// @namespace    https://tahvel.edu.ee/
// @version      1.1.0
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
  function buildStudentGroupTeacherReportUrl(groupId, curriculumVersion) {
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
    alert(`Starting student data collection${source === "auto" ? " (weekly auto-run)" : ""}. This may take a while.`);
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
        await postUntilSuccess(void 0 + "/api/StudentRecord/switch", { id: requestId, isOn: true });
        console.log("Finished successfully");
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
      for (const groupEntry of groupData.content) {
        const curriculumVersion = normalizeCurriculumVersion(groupEntry?.curriculumVersion);
        if (curriculumVersion == null) {
          console.warn("Skipping group because curriculumVersion is missing", {
            groupId: groupEntry?.id,
            groupCode: groupEntry?.code
          });
          continue;
        }
        const reportUrl = buildStudentGroupTeacherReportUrl(groupEntry.id, curriculumVersion);
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
      for (const studentData of bestStudentDataById.values()) {
        try {
          await postUntilSuccess(void 0 + "/api/StudentRecord", studentData);
          console.log("Finished successfully");
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
        await postUntilSuccess(void 0 + "/api/StudentRecord/switch", { id: requestId, isOn: false });
        console.log("Finished successfully");
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
      alert("Student data collection complete.");
      console.log("Student data collection complete.");
    } finally {
      isCollectionInProgress = false;
    }
  }
  async function postUntilSuccess(url, data, maxRetries = 5, delayMs = 500) {
    let retries = 0;
    const token = await auth.getToken();
    while (retries < maxRetries) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
          // Add the token here
        },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (response.status === 200) {
        console.log("Success");
        return;
      } else if (response.status === 401) {
        throw new Error(`Unauthorized: Access token may be invalid or expired.`);
      } else {
        retries++;
        console.log(`Attempt ${retries} failed with status ${response.status}. Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw new Error(`Max retries reached without success.`);
  }

  // src/data-collector.js
  if (typeof globalThis.GM_registerMenuCommand === "function") {
    globalThis.GM_registerMenuCommand("Run student data collection now", () => {
      void calculateStudentData({ source: "menu" });
    });
  }
  void maybeRunStudentDataForCurrentWeek();
})();
