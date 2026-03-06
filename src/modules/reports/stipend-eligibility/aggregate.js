const NEGATIVE = new Set([
  "KUTSEHINDAMINE_MA",
  "KUTSEHINDAMINE_X",
  "KUTSEHINDAMINE_1",
  "KUTSEHINDAMINE_2"
]);

function isNegative(code) {
  return code ? NEGATIVE.has(code) : false;
}

/**
 * Optional logger for warnings (inject console.warn by default).
 */
function warn(logger, msg, payload) {
  if (!logger) return;
  try { logger(msg, payload ?? ""); } catch { /* ignore */ }
}

export function createEmptyState() {
  return {
    studentStatMap: {}, // studentId -> StudentStats-ish
    subjectStatMap: {}, // journalId -> SubjectStats-ish
    groups: {},         // groupCode -> StudentStats[]
    problematicJournalSet: new Set() // Set<string journalId>
  };
}

/**
 * Aggregates one group. Pure (except optional warnings logger).
 *
 * Heuristic for multi-semester subjects:
 * - Missing FINAL (SISSEKANNE_L) is only flagged if this journal has at least one final grade
 *   for any student in the group (journalHasFinal == true).
 * - Missing PERIOD (SISSEKANNE_R) is only flagged if journalHasPeriod == true.
 *
 * That prevents “not yet graded this semester” from becoming “problem”.
 */
export function aggregateGroup(normalizedGroup, state, { logger = console.warn } = {}) {
  const groupCode = normalizedGroup.groupCode;
  if (!state.groups[groupCode]) state.groups[groupCode] = [];

  // Pass 1: detect whether each journal has any final/period grades in this group
  const journalHasFinal = Object.create(null);  // journalId -> boolean
  const journalHasPeriod = Object.create(null); // journalId -> boolean

  for (const s of normalizedGroup.students) {
    for (const j of Object.values(s.journalsById)) {
      for (const e of j.entries) {
        if (!e.gradeCode) continue;
        if (e.entryType === "SISSEKANNE_L") journalHasFinal[j.journalId] = true;
        if (e.entryType === "SISSEKANNE_R") journalHasPeriod[j.journalId] = true;
      }
    }
  }

  // Pass 2: build stats
  for (const s of normalizedGroup.students) {
    const studentStats = {
      fullname: s.fullname,
      groupCode,
      status: s.status,
      totalGrades: 0,
      totalFinalGrades: 0,
      totalPeriodGrades: 0,
      totalNegativeFinalGrades: 0,
      totalNegativePeriodGrades: 0,
      weightedAverageGrade: s.weightedAverageGrade ?? null,
      lessonAbsencePercentage: s.lessonAbsencePercentage ?? null,
      problematicSubjects: [],
      exceptionCandidate: false,
      _negativeJournalIds: new Set() // internal: journals where this student has negative period/final
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
          teachers: new Set(),
          studentsWithAnyGrade: 0,
          studentsWithFinal: 0,
          studentsWithNegativeFinal: 0,
          studentsMissingFinal: 0,
          problematicByRule: false,
          problematicReasons: []
        };
      }

      const subj = state.subjectStatMap[key];
      subj.totalStudentsInSubject += 1;

      // per-student flags within this subject
      let studentHasAnyGradeInSubject = false;
      let studentHasFinal = false;
      let studentHasPeriod = false;
      let studentHasNegativeFinal = false;
      let journalHasPositiveFinal = false;
      let journalHasNegativeFinal = false;
      let journalNegativePeriodCount = 0;

      for (const e of j.entries) {
        // track teachers even if gradeCode missing, because it can still be useful metadata
        if (e.teacher) subj.teachers.add(e.teacher);

        // date window
        if (e.entryDate) {
          const d = e.entryDate.slice(0, 10);
          subj.firstEntryDate = subj.firstEntryDate ? (d < subj.firstEntryDate ? d : subj.firstEntryDate) : d;
          subj.lastEntryDate = subj.lastEntryDate ? (d > subj.lastEntryDate ? d : subj.lastEntryDate) : d;
        }

        // If grade code missing: log and skip counts
        if (!e.gradeCode) {
          // You said you haven't seen it, but we keep a safe guard.
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

      // Positive final in the same journal supersedes negative period grades for this student.
      const shouldSuppressNegativePeriods = journalHasPositiveFinal && !journalHasNegativeFinal;
      if (journalNegativePeriodCount > 0 && !shouldSuppressNegativePeriods) {
        studentStats.totalNegativePeriodGrades += journalNegativePeriodCount;
        studentStats._negativeJournalIds.add(String(journalId));
      }

      if (!studentHasAnyGradeInSubject) subj.nonGradedStudents += 1;

      // subject-level student counters (per student per journal)
      if (studentHasAnyGradeInSubject) subj.studentsWithAnyGrade += 1;
      if (studentHasFinal) subj.studentsWithFinal += 1;
      if (studentHasNegativeFinal) subj.studentsWithNegativeFinal += 1;

      const shouldConsiderFinalMissing = journalHasFinal[journalId] === true;
      if (shouldConsiderFinalMissing && studentHasAnyGradeInSubject && !studentHasFinal) subj.studentsMissingFinal += 1;

      // Decide if “missing” should be flagged using group-level heuristic:
      const shouldFlagPeriod = journalHasPeriod[journalId] === true && studentHasAnyGradeInSubject && !studentHasPeriod;
      const shouldFlagFinal = journalHasFinal[journalId] === true && studentHasAnyGradeInSubject && !studentHasFinal;

      if (shouldFlagPeriod || shouldFlagFinal) {
        const teacherGuess = [...j.entries].reverse().find(x => x.teacher)?.teacher ?? "";
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

export function finalizeState(state) {
  // Decide “problematic by rule” and build problematicJournalSet
  const problematic = new Set();

  for (const k of Object.keys(state.subjectStatMap)) {
    const subj = state.subjectStatMap[k];

    // normalize teachers representation
    if (subj.teachers instanceof Set) subj.teachers = [...subj.teachers].sort();

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

  // Compute exceptionCandidate per student (draft rule in docs)
  for (const studentId of Object.keys(state.studentStatMap)) {
    const st = state.studentStatMap[studentId];
    const negSet = st?._negativeJournalIds;
    const negativeJournalIds = negSet instanceof Set ? [...negSet] : [];

    const hasAnyNegative = negativeJournalIds.length > 0;
    const allNegativesInProblematic = negativeJournalIds.every(jid => problematic.has(String(jid)));
    st.exceptionCandidate = hasAnyNegative && allNegativesInProblematic;

    // cleanup internal field
    if (st && "_negativeJournalIds" in st) delete st._negativeJournalIds;
  }

  return state;
}

export function aggregateAll(normalizedGroups, opts) {
  const state = createEmptyState();
  for (const g of normalizedGroups) aggregateGroup(g, state, opts);
  return finalizeState(state);
}
