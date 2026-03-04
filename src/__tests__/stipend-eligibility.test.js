import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGroupReport, areGradeEntriesSorted } from "../modules/reports/stipend-eligibility/normalize.js";
import { aggregateAll } from "../modules/reports/stipend-eligibility/aggregate.js";
import { exportStudentReportTsv } from "../modules/reports/stipend-eligibility/tsv.js";

test("areGradeEntriesSorted detects ordering", () => {
  const entriesOk = [
    { entryDate: "2024-12-16T00:00:00Z" },
    { entryDate: "2025-01-10T00:00:00Z" },
    { entryDate: "2025-07-03T00:00:00Z" }
  ];
  const entriesBad = [
    { entryDate: "2025-07-03T00:00:00Z" },
    { entryDate: "2025-01-10T00:00:00Z" }
  ];
  assert.equal(areGradeEntriesSorted(entriesOk), true);
  assert.equal(areGradeEntriesSorted(entriesBad), false);
});

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
                gradeInsertedBy: "Kairi Kruus",
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
                gradeInsertedBy: "Kairi Kruus",
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
      { id: 3, fullname: "S3", status: "O", resultColumns: [{ journalResult: { id: 1, results: [] } }] }, // missing final
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
          { journalResult: { id: 1, results: [] } }, // missing final (journal has finals overall)
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
        resultColumns: [{ journalResult: { id: 10, results: [] } }]
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