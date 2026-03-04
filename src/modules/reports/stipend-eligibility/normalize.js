/**
 * Normalize Tahvel group teacher report into a stable internal shape.
 * Keep this PURE (no fetch, no globals).
 */

/**
 * @typedef {Object} NormalizedGradeEntry
 * @property {number} journalId
 * @property {string} subject
 * @property {string|null} teacher
 * @property {string} entryType
 * @property {string} entryDate
 * @property {string|null} gradeCode
 * @property {string|null} gradeInserted
 * @property {number|null} studentEntryId
 */

/**
 * @typedef {Object} NormalizedStudent
 * @property {number} studentId
 * @property {string} fullname
 * @property {string} status
 * @property {number|null} weightedAverageGrade
 * @property {number|null} lessonAbsencePercentage
 * @property {Object.<string, {journalId:number, subject:string, entries: NormalizedGradeEntry[]}>} journalsById
 */

/**
 * @typedef {Object} NormalizedGroup
 * @property {string} groupCode
 * @property {NormalizedStudent[]} students
 */

export function normalizeGroupReport(rawGroupData, groupCode) {
  if (!rawGroupData || !Array.isArray(rawGroupData.students)) return null;

  const journalNameById = buildJournalNameMap(rawGroupData);

  /** @type {NormalizedGroup} */
  const out = { groupCode, students: [] };

  for (const s of rawGroupData.students) {
    /** @type {NormalizedStudent} */
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

      // IMPORTANT: keep the journal even if results are empty.
      // Otherwise we can't correctly count missing finals/periods or non-graded students.
      const fallbackSubject = journalNameById[journalId] ?? `Journal ${journalId}`;
      if (!ns.journalsById[journalId]) {
        ns.journalsById[journalId] = { journalId, subject: fallbackSubject, entries: [] };
      }

      for (const r of results) {
        const j = r.journal;
        const subject = j?.nameEt ?? j?.nameEn ?? j?.nameRu ?? fallbackSubject;

        // Upgrade subject name if we only had a fallback before.
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
  /** @type {Record<string, string>} */
  const map = Object.create(null);

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

/**
 * Returns true if entries are non-decreasing by entryDate (or gradeInserted fallback).
 * If true, you can safely use entries[entries.length - 1] as "last".
 */
export function areGradeEntriesSorted(entries) {
  if (!Array.isArray(entries) || entries.length <= 1) return true;

  let prev = dateKey(entries[0]);
  for (let i = 1; i < entries.length; i++) {
    const cur = dateKey(entries[i]);
    if (cur < prev) return false;
    prev = cur;
  }
  return true;
}

function dateKey(e) {
  const d = e?.entryDate ?? e?.gradeInserted ?? null;
  const t = d ? Date.parse(d) : 0;
  return Number.isFinite(t) ? t : 0;
}