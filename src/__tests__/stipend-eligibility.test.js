import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGroupReport } from "../modules/reports/stipend-eligibility/normalize.js";
import { aggregateAll } from "../modules/reports/stipend-eligibility/aggregate.js";
import { exportStudentReportTsv } from "../modules/reports/stipend-eligibility/tsv.js";

test("missingFinal is only flagged when journal has any finals in the group", () => {
  const raw = {
    students: [
      // Student A has final
      {
        id: 1,
        fullname: "A",
        status: "OPPURSTAATUS_O",
        weightedAverageGrade: 4.0,
        lessonAbsencePercentage: 10,
        resultColumns: [{
          journalResult: {
            id: 372558,
            results: [
              {
                journal: { id: 372558, nameEt: "Eesti keel" },
                studentEntryId: 22642805,
                entryType: "SISSEKANNE_L",
                entryDate: "2025-07-03T00:00:00Z",
                grade: { code: "KUTSEHINDAMINE_5" },
                gradeInsertedBy: "Teacher",
                gradeInserted: "2025-07-03T00:00:00Z"
              }
            ]
          }
        }]
      },

      // Student B has no final (but has some grades)
      {
        id: 2,
        fullname: "B",
        status: "OPPURSTAATUS_O",
        weightedAverageGrade: 3.5,
        lessonAbsencePercentage: 20,
        resultColumns: [{
          journalResult: {
            id: 372558,
            results: [
              {
                journal: { id: 372558, nameEt: "Eesti keel" },
                studentEntryId: 20646770,
                entryType: "SISSEKANNE_R",
                entryDate: "2025-01-10T00:00:00Z",
                grade: { code: "KUTSEHINDAMINE_5" },
                gradeInsertedBy: "Teacher",
                gradeInserted: "2025-01-10T00:00:00Z"
              }
            ]
          }
        }]
      }
    ]
  };

  const ng = normalizeGroupReport(raw, "TA-24B");

  // silence warnings in test
  const state = aggregateAll([ng], { logger: null });

  const stB = state.studentStatMap[2];
  assert.equal(stB.problematicSubjects.length, 1);
  assert.equal(stB.problematicSubjects[0].subject, "Eesti keel");
  assert.deepEqual(stB.problematicSubjects[0].flags, ["missingFinal"]);
});

test("missingFinal is NOT flagged when student has zero entries in the journal (not enrolled)", () => {
  const raw = {
    students: [
      // Student A has a final grade in journal 372558
      {
        id: 1,
        fullname: "Enrolled",
        status: "OPPURSTAATUS_O",
        weightedAverageGrade: 4.0,
        lessonAbsencePercentage: 10,
        resultColumns: [{
          journalResult: {
            id: 372558,
            results: [
              {
                journal: { id: 372558, nameEt: "Eesti keel" },
                studentEntryId: 100,
                entryType: "SISSEKANNE_L",
                entryDate: "2025-07-03T00:00:00Z",
                grade: { code: "KUTSEHINDAMINE_A" },
                gradeInsertedBy: "Teacher",
                gradeInserted: "2025-07-03T00:00:00Z"
              }
            ]
          }
        }]
      },
      // Student B has the journal in resultColumns but with empty results (not enrolled)
      {
        id: 2,
        fullname: "NotEnrolled",
        status: "OPPURSTAATUS_O",
        weightedAverageGrade: 3.5,
        lessonAbsencePercentage: 20,
        resultColumns: [{
          journalResult: {
            id: 372558,
            results: []
          }
        }]
      }
    ]
  };

  const ng = normalizeGroupReport(raw, "TA-24B");
  const state = aggregateAll([ng], { logger: null });

  const stB = state.studentStatMap[2];
  assert.equal(stB.problematicSubjects.length, 0,
    "Student with zero entries in journal should NOT be flagged as missingFinal");
});

test("journals with existsInJournal=false and empty results are excluded from subject stats", () => {
  const raw = {
    students: [
      {
        id: 1,
        fullname: "Enrolled",
        status: "OPPURSTAATUS_O",
        resultColumns: [{
          journalResult: {
            id: 372558,
            existsInJournal: true,
            results: [
              {
                journal: { id: 372558, nameEt: "Eesti keel" },
                studentEntryId: 100,
                entryType: "SISSEKANNE_L",
                entryDate: "2025-07-03T00:00:00Z",
                grade: { code: "KUTSEHINDAMINE_A" },
                gradeInsertedBy: "Teacher",
                gradeInserted: "2025-07-03T00:00:00Z"
              }
            ]
          }
        }]
      },
      {
        id: 2,
        fullname: "NotEnrolled",
        status: "OPPURSTAATUS_O",
        resultColumns: [{
          journalResult: {
            id: 372558,
            existsInJournal: false,
            results: []
          }
        }]
      }
    ]
  };

  const ng = normalizeGroupReport(raw, "TA-24B");
  const state = aggregateAll([ng], { logger: null });

  const subj = state.subjectStatMap["372558"];
  assert.equal(subj.totalStudentsInSubject, 1);
  assert.equal(subj.nonGradedStudents, 0);
  assert.equal(subj.totalFinalGrades, 1);
  assert.equal(state.studentStatMap[2].problematicSubjects.length, 0);
});

test("missingFinal is NOT flagged if journal has no finals in the group", () => {
  const raw = {
    students: [{
      id: 10,
      fullname: "OnlyPeriod",
      status: "OPPURSTAATUS_O",
      weightedAverageGrade: 4.0,
      lessonAbsencePercentage: 10,
      resultColumns: [{
        journalResult: {
          id: 999,
          results: [
            {
              journal: { id: 999, nameEt: "Multi-semester Subject" },
              studentEntryId: 1,
              entryType: "SISSEKANNE_R",
              entryDate: "2026-01-10T00:00:00Z",
              grade: { code: "KUTSEHINDAMINE_5" },
              gradeInsertedBy: "Teacher",
              gradeInserted: "2026-01-10T00:00:00Z"
            }
          ]
        }
      }]
    }]
  };

  const ng = normalizeGroupReport(raw, "TA-XX");
  const state = aggregateAll([ng], { logger: null });

  const st = state.studentStatMap[10];
  assert.equal(st.problematicSubjects.length, 0);
});

test("missing counters are tracked and missing period is ignored when student has final", () => {
  const raw = {
    students: [
      {
        id: 1,
        fullname: "HasBoth",
        status: "OPPURSTAATUS_O",
        resultColumns: [{
          journalResult: {
            id: 111,
            results: [
              {
                journal: { id: 111, nameEt: "Math" },
                studentEntryId: 1,
                entryType: "SISSEKANNE_R",
                entryDate: "2025-01-10T00:00:00Z",
                grade: { code: "KUTSEHINDAMINE_4" },
                gradeInsertedBy: "Teacher",
                gradeInserted: "2025-01-10T00:00:00Z"
              },
              {
                journal: { id: 111, nameEt: "Math" },
                studentEntryId: 2,
                entryType: "SISSEKANNE_L",
                entryDate: "2025-07-03T00:00:00Z",
                grade: { code: "KUTSEHINDAMINE_5" },
                gradeInsertedBy: "Teacher",
                gradeInserted: "2025-07-03T00:00:00Z"
              }
            ]
          }
        }]
      },
      {
        id: 2,
        fullname: "MissingBoth",
        status: "OPPURSTAATUS_O",
        resultColumns: [{
          journalResult: {
            id: 111,
            results: [
              {
                journal: { id: 111, nameEt: "Math" },
                studentEntryId: 3,
                entryType: "SISSEKANNE_T",
                entryDate: "2025-02-01T00:00:00Z",
                grade: { code: "KUTSEHINDAMINE_3" },
                gradeInsertedBy: "Teacher",
                gradeInserted: "2025-02-01T00:00:00Z"
              }
            ]
          }
        }]
      },
      {
        id: 3,
        fullname: "HasFinalOnly",
        status: "OPPURSTAATUS_O",
        resultColumns: [{
          journalResult: {
            id: 111,
            results: [
              {
                journal: { id: 111, nameEt: "Math" },
                studentEntryId: 4,
                entryType: "SISSEKANNE_L",
                entryDate: "2025-07-05T00:00:00Z",
                grade: { code: "KUTSEHINDAMINE_4" },
                gradeInsertedBy: "Teacher",
                gradeInserted: "2025-07-05T00:00:00Z"
              }
            ]
          }
        }]
      }
    ]
  };

  const state = aggregateAll([normalizeGroupReport(raw, "TA-MISS")], { logger: null });

  const missingBoth = state.studentStatMap[2];
  assert.equal(missingBoth.totalMissingFinalGrades, 1);
  assert.equal(missingBoth.totalMissingPeriodGrades, 1);
  assert.deepEqual(missingBoth.problematicSubjects[0].flags.sort(), ["missingFinal", "missingPeriod"]);

  const hasFinalOnly = state.studentStatMap[3];
  assert.equal(hasFinalOnly.totalMissingPeriodGrades, 0, "missing period must be ignored when student has final");
  assert.equal(hasFinalOnly.problematicSubjects.length, 0);
});

test("cutoff suppresses missing final/period when student has regular activity after cutoff", () => {
  const raw = {
    students: [
      {
        id: 1,
        fullname: "OldSemester",
        status: "OPPURSTAATUS_O",
        resultColumns: [{
          journalResult: {
            id: 222,
            results: [
              {
                journal: { id: 222, nameEt: "History" },
                studentEntryId: 1,
                entryType: "SISSEKANNE_R",
                entryDate: "2025-12-10T00:00:00Z",
                grade: { code: "KUTSEHINDAMINE_4" },
                gradeInsertedBy: "Teacher",
                gradeInserted: "2025-12-10T00:00:00Z"
              },
              {
                journal: { id: 222, nameEt: "History" },
                studentEntryId: 2,
                entryType: "SISSEKANNE_L",
                entryDate: "2025-12-20T00:00:00Z",
                grade: { code: "KUTSEHINDAMINE_4" },
                gradeInsertedBy: "Teacher",
                gradeInserted: "2025-12-20T00:00:00Z"
              }
            ]
          }
        }]
      },
      {
        id: 2,
        fullname: "NewSemester",
        status: "OPPURSTAATUS_O",
        resultColumns: [{
          journalResult: {
            id: 222,
            results: [
              {
                journal: { id: 222, nameEt: "History" },
                studentEntryId: 3,
                entryType: "SISSEKANNE_T",
                entryDate: "2026-09-10T00:00:00Z",
                grade: { code: "KUTSEHINDAMINE_3" },
                gradeInsertedBy: "Teacher",
                gradeInserted: "2026-09-10T00:00:00Z"
              }
            ]
          }
        }]
      }
    ]
  };

  const ng = normalizeGroupReport(raw, "TA-CUTOFF");

  const withoutCutoff = aggregateAll([ng], { logger: null });
  assert.equal(withoutCutoff.studentStatMap[2].totalMissingFinalGrades, 1);
  assert.equal(withoutCutoff.studentStatMap[2].totalMissingPeriodGrades, 1);

  const withCutoff = aggregateAll([ng], {
    logger: null,
    missingGradeCutoffDate: "2026-09-01"
  });
  assert.equal(withCutoff.studentStatMap[2].totalMissingFinalGrades, 0);
  assert.equal(withCutoff.studentStatMap[2].totalMissingPeriodGrades, 0);
  assert.equal(withCutoff.studentStatMap[2].problematicSubjects.length, 0);
});

test("subject marked problematic when >=75% students negative OR missing final", () => {
  const mkFinal = (id, code) => ({
    journal: { id: 1, nameEt: "X" },
    studentEntryId: id,
    entryType: "SISSEKANNE_L",
    entryDate: "2025-07-03T00:00:00Z",
    grade: { code },
    gradeInsertedBy: "Teacher",
    gradeInserted: "2025-07-03T00:00:00Z"
  });

  const raw = {
    students: [
      { id: 1, fullname: "S1", status: "O", resultColumns: [{ journalResult: { id: 1, results: [mkFinal(1,"KUTSEHINDAMINE_2")] } }] }, // negative final
      { id: 2, fullname: "S2", status: "O", resultColumns: [{ journalResult: { id: 1, results: [mkFinal(2,"KUTSEHINDAMINE_2")] } }] }, // negative final
      { id: 3, fullname: "S3", status: "O", resultColumns: [{ journalResult: { id: 1, results: [{ journal: { id: 1, nameEt: "X" }, studentEntryId: 3, entryType: "SISSEKANNE_T", entryDate: "2025-03-01T00:00:00Z", grade: { code: "KUTSEHINDAMINE_3" }, gradeInsertedBy: "Teacher", gradeInserted: "2025-03-01T00:00:00Z" }] } }] }, // enrolled, has topic grade but missing final
      { id: 4, fullname: "S4", status: "O", resultColumns: [{ journalResult: { id: 1, results: [mkFinal(4,"KUTSEHINDAMINE_5")] } }] }  // positive final
    ]
  };

  const ng = normalizeGroupReport(raw, "TA");
  const state = aggregateAll([ng], { logger: null });

  const subj = state.subjectStatMap["1"];
  assert.equal(subj.problematicByRule, true);
});

test("exceptionCandidate is true only when all negatives are in problematic journals", () => {
  const mkFinal = (journalId, studentEntryId, code) => ({
    journal: { id: journalId, nameEt: `J${journalId}` },
    studentEntryId,
    entryType: "SISSEKANNE_L",
    entryDate: "2025-07-03T00:00:00Z",
    grade: { code },
    gradeInsertedBy: "Teacher",
    gradeInserted: "2025-07-03T00:00:00Z"
  });

  const mkPeriod = (journalId, studentEntryId, code) => ({
    journal: { id: journalId, nameEt: `J${journalId}` },
    studentEntryId,
    entryType: "SISSEKANNE_R",
    entryDate: "2026-01-10T00:00:00Z",
    grade: { code },
    gradeInsertedBy: "Teacher",
    gradeInserted: "2026-01-10T00:00:00Z"
  });

  // Journal 1 is problematic: 3/4 negative-or-missing final (>= 75%)
  // Journal 2 is NOT problematic: no finals, and non-graded ratio < 75%
  const raw = {
    students: [
      {
        id: 1,
        fullname: "S1",
        status: "O",
        resultColumns: [
          { journalResult: { id: 1, results: [mkFinal(1, 1, "KUTSEHINDAMINE_2")] } },
          { journalResult: { id: 2, results: [mkPeriod(2, 1, "KUTSEHINDAMINE_2")] } }
        ]
      },
      {
        id: 2,
        fullname: "S2",
        status: "O",
        resultColumns: [
          { journalResult: { id: 1, results: [mkFinal(1, 2, "KUTSEHINDAMINE_2")] } },
          { journalResult: { id: 2, results: [mkPeriod(2, 2, "KUTSEHINDAMINE_5")] } }
        ]
      },
      {
        id: 3,
        fullname: "S3",
        status: "O",
        resultColumns: [
          { journalResult: { id: 1, results: [{ journal: { id: 1, nameEt: "J1" }, studentEntryId: 30, entryType: "SISSEKANNE_T", entryDate: "2025-03-01T00:00:00Z", grade: { code: "KUTSEHINDAMINE_3" }, gradeInsertedBy: "Teacher", gradeInserted: "2025-03-01T00:00:00Z" }] } }, // enrolled with topic grade, but missing final
          { journalResult: { id: 2, results: [mkPeriod(2, 3, "KUTSEHINDAMINE_5")] } }
        ]
      },
      {
        id: 4,
        fullname: "S4",
        status: "O",
        resultColumns: [
          { journalResult: { id: 1, results: [mkFinal(1, 4, "KUTSEHINDAMINE_5")] } },
          { journalResult: { id: 2, results: [] } }
        ]
      }
    ]
  };

  const ng = normalizeGroupReport(raw, "TA");
  const state = aggregateAll([ng], { logger: null });

  assert.equal(state.subjectStatMap["1"].problematicByRule, true);
  assert.equal(state.subjectStatMap["2"].problematicByRule, false);

  assert.equal(state.studentStatMap[1].exceptionCandidate, false); // negatives in journal 1 and 2
  assert.equal(state.studentStatMap[2].exceptionCandidate, true);  // only negative is in journal 1
  assert.equal(state.studentStatMap[3].exceptionCandidate, false); // no negatives
  assert.equal(state.studentStatMap[4].exceptionCandidate, false); // no negatives
});

test("negative period grades are not counted when journal has positive final for same student", () => {
  const raw = {
    students: [{
      id: 1,
      fullname: "StudentWithPositiveFinal",
      status: "OPPURSTAATUS_O",
      weightedAverageGrade: 4.0,
      lessonAbsencePercentage: 5,
      resultColumns: [{
        journalResult: {
          id: 500,
          results: [
            {
              journal: { id: 500, nameEt: "Math" },
              studentEntryId: 1,
              entryType: "SISSEKANNE_R",
              entryDate: "2025-01-10T00:00:00Z",
              grade: { code: "KUTSEHINDAMINE_2" },  // negative period
              gradeInsertedBy: "Teacher",
              gradeInserted: "2025-01-10T00:00:00Z"
            },
            {
              journal: { id: 500, nameEt: "Math" },
              studentEntryId: 2,
              entryType: "SISSEKANNE_L",
              entryDate: "2025-07-03T00:00:00Z",
              grade: { code: "KUTSEHINDAMINE_4" },  // positive final → supersedes negative period
              gradeInsertedBy: "Teacher",
              gradeInserted: "2025-07-03T00:00:00Z"
            }
          ]
        }
      }]
    },
    {
      id: 2,
      fullname: "StudentWithNoFinal",
      status: "OPPURSTAATUS_O",
      weightedAverageGrade: 3.0,
      lessonAbsencePercentage: 10,
      resultColumns: [{
        journalResult: {
          id: 500,
          results: [
            {
              journal: { id: 500, nameEt: "Math" },
              studentEntryId: 3,
              entryType: "SISSEKANNE_R",
              entryDate: "2025-01-10T00:00:00Z",
              grade: { code: "KUTSEHINDAMINE_2" },  // negative period, no final → still counted
              gradeInsertedBy: "Teacher",
              gradeInserted: "2025-01-10T00:00:00Z"
            }
          ]
        }
      }]
    }]
  };

  const ng = normalizeGroupReport(raw, "TA-TEST");
  const state = aggregateAll([ng], { logger: null });

  const s1 = state.studentStatMap[1];
  assert.equal(s1.totalNegativePeriodGrades, 0, "positive final supersedes negative period");
  assert.equal(s1.totalPeriodGrades, 1, "period grade still counted as a period grade");
  assert.equal(s1.totalFinalGrades, 1);
  assert.equal(s1.totalNegativeFinalGrades, 0);

  const s2 = state.studentStatMap[2];
  assert.equal(s2.totalNegativePeriodGrades, 1, "no final → negative period still counts");
  assert.equal(s2.totalPeriodGrades, 1);
});

test("negative period grades ARE counted when final is also negative", () => {
  const raw = {
    students: [{
      id: 1,
      fullname: "BothNegative",
      status: "OPPURSTAATUS_O",
      weightedAverageGrade: 2.0,
      lessonAbsencePercentage: 15,
      resultColumns: [{
        journalResult: {
          id: 600,
          results: [
            {
              journal: { id: 600, nameEt: "Physics" },
              studentEntryId: 1,
              entryType: "SISSEKANNE_R",
              entryDate: "2025-01-10T00:00:00Z",
              grade: { code: "KUTSEHINDAMINE_2" },  // negative period
              gradeInsertedBy: "Teacher",
              gradeInserted: "2025-01-10T00:00:00Z"
            },
            {
              journal: { id: 600, nameEt: "Physics" },
              studentEntryId: 2,
              entryType: "SISSEKANNE_L",
              entryDate: "2025-07-03T00:00:00Z",
              grade: { code: "KUTSEHINDAMINE_1" },  // negative final → does NOT supersede
              gradeInsertedBy: "Teacher",
              gradeInserted: "2025-07-03T00:00:00Z"
            }
          ]
        }
      }]
    }]
  };

  const ng = normalizeGroupReport(raw, "TA-NEG");
  const state = aggregateAll([ng], { logger: null });

  const s = state.studentStatMap[1];
  assert.equal(s.totalNegativePeriodGrades, 1, "negative final does not supersede negative period");
  assert.equal(s.totalNegativeFinalGrades, 1);
  assert.equal(s.totalPeriodGrades, 1);
  assert.equal(s.totalFinalGrades, 1);
});

test("exports student report as TSV with exceptionCandidate", () => {
  const raw = {
    students: [
      {
        id: 1,
        fullname: "S1",
        status: "O",
        resultColumns: [{
          journalResult: {
            id: 10,
            results: [
              {
                journal: { id: 10, nameEt: "X" },
                studentEntryId: 1,
                entryType: "SISSEKANNE_L",
                entryDate: "2025-07-03T00:00:00Z",
                grade: { code: "KUTSEHINDAMINE_2" },
                gradeInsertedBy: "Teacher",
                gradeInserted: "2025-07-03T00:00:00Z"
              }
            ]
          }
        }]
      },
      {
        id: 2,
        fullname: "S2",
        status: "O",
        resultColumns: [{ journalResult: { id: 10, results: [{ journal: { id: 10, nameEt: "X" }, studentEntryId: 2, entryType: "SISSEKANNE_T", entryDate: "2025-03-01T00:00:00Z", grade: { code: "KUTSEHINDAMINE_3" }, gradeInsertedBy: "Teacher", gradeInserted: "2025-03-01T00:00:00Z" }] } }]
      }
    ]
  };

  const state = aggregateAll([normalizeGroupReport(raw, "TA")], { logger: null });

  const tsv = exportStudentReportTsv(state, { groupCode: "TA", includeHeader: true, sortByName: false });
  const lines = tsv.split("\n");

  assert.equal(lines[0].startsWith("groupCode\tfullname\tstatus\t"), true);
  assert.equal(lines.length, 3);

  // S1 has a negative final in a problematic journal (2/2 missing-or-negative final = 100%)
  assert.equal(lines.some(l => l.includes("\tS1\t") && l.endsWith("\ttrue")), true);
});
