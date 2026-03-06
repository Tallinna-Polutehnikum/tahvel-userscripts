# Stipend eligibility report (Tahvel)

## Inputs
- Endpoint: /teacher/studentGroupTeacherReport?studentGroupCode=...
- Data path: groupData.students[].resultColumns[].journalResult.results[]
- Fixture data example in `fixtures/exampleGroupTeacherReport.json`

## Normalization
- Normalize into groupCode -> students[] -> journalsById[journalId] -> entries[]
- Keep: entryType, entryDate, grade.code, gradeInsertedBy, gradeInserted, studentEntryId (debug)

## Aggregation goals
Student-level:
- weightedAverageGrade
- lessonAbsencePercentage
- totalGrades (any entry with gradeCode)
- totalPeriodGrades (entryType SISSEKANNE_R)
- totalFinalGrades (entryType SISSEKANNE_L)
- negativePeriodGrades, negativeFinalGrades
- totalMissingPeriodGrades, totalMissingFinalGrades
- problematicSubjects list where missing period/final applies

Subject-level:
- totalStudentsInSubject
- nonGradedStudents
- studentsWithFinal, studentsWithNegativeFinal, studentsMissingFinal
- teachers (unique)

## Negative grades
KUTSEHINDAMINE_[MA, X, 1, 2] are negative.

### Positive final supersedes negative period grades
If a student has a positive (non-negative) final grade (SISSEKANNE_L) in a journal, any negative period grades (SISSEKANNE_R) in that same journal are **not** counted as negative for that student. The final grade is considered to overwrite/supersede earlier period results. This affects `totalNegativePeriodGrades` and the `_negativeJournalIds` set (used for `exceptionCandidate`).

## Missing gradeCode
- If gradeCode missing/null: warn with groupCode, student name, studentId, journalId, studentEntryId; skip counting.

## Multi-semester heuristic (IMPORTANT)
- Missing FINAL or PERIOD is only flagged for a student if:
  1. That journal has at least one corresponding grade (final/period) for ANY student in the GROUP, AND
  2. The student has at least one entry (any entry type) in that journal, meaning they are actively enrolled/participating in it.
- Missing PERIOD is additionally ignored when the student already has a final grade in that journal.

### Optional cutoff-date suppression for new-semester activity
Use aggregation option `missingGradeCutoffDate` (ISO date like `2026-09-01`) to suppress false positives at semester start:
- If a student has regular entries after cutoff (default regular types: `SISSEKANNE_H/T/P/E/I/O`),
- and the journal has no corresponding final/period grades after that cutoff yet,
- then missing final/period is not flagged for that student in that journal.
- Optional: override regular types with `regularEntryTypesAfterCutoff: ["SISSEKANNE_H", ...]`.

### Enrollment participation check
Tahvel's group report includes students for ALL journals in the curriculum, even journals they don't take. Journals a student doesn't participate in have `results: []` (zero entries). These students are **not** flagged as `missingFinal` or `missingPeriod` — the flags only apply to students actively enrolled in the journal.

## Problematic subject rule (for stipend exception support)
- A subject is problematic if:
  - journal has finals in the group AND
  - (studentsWithNegativeFinal + studentsMissingFinal) / totalStudentsInSubject >= 0.75
- Also mark problematic if nonGradedStudents / totalStudentsInSubject >= 0.75 (optional reason).

## TSV output (student report)
Columns (tab-separated):
groupCode, fullname, status, weightedAverageGrade, lessonAbsencePercentage,
totalGrades, totalPeriodGrades, totalFinalGrades,
negativePeriodGrades, negativeFinalGrades,
missingPeriodGradeCount, missingFinalGradeCount,
missingPeriodSubjects, missingFinalSubjects,
problemSubjects (semicolon list Subject|Teacher|flags),
exceptionCandidate (true/false)

## Usage

Open Tahvel, then run examples in browser console.
All snippets below intentionally use `var` (not `const`/`let`) so you can paste and rerun them repeatedly in the same console session.

### Single group (end-to-end)

```js
var groupCode = "TA-25A";

// 1) Resolve studentGroup + curriculumVersion for this code
var resolved = await window.reports.stipend.resolveGroupReportParams(groupCode);
if (!resolved.exactMatchFound) {
  console.warn("No exact autocomplete match", resolved);
}

// 2) Build aggregated state for this one group
var state = await window.reports.stipend.buildStateForGroup(groupCode, {
  studentGroup: resolved.studentGroup,
  curriculumVersion: resolved.curriculumVersion,
  from: "2025-08-01T00:00:00.000Z",
  aggregationOptions: {
    missingGradeCutoffDate: "2026-09-01"
  }
});

// 3) Export TSV
var tsv = window.reports.stipend.exportStudentReportTsv(state);
console.log(state, tsv);
```

### Bulk (all groups, one call)

```js
var result = await window.reports.stipend.aggregateAndExportAllGroups({
  resolverOptions: {
    isValid: true,
    lang: "ET",
    size: 200
  },
  reportOptions: {
    from: "2025-08-01T00:00:00.000Z"
  },
  aggregationOptions: {
    missingGradeCutoffDate: "2026-09-01"
  },
  concurrency: 4
});

console.log("summary", result.summary);
console.log("unresolved", result.unresolved);
console.log("fetchErrors", result.fetchErrors);
console.log("combined state", result.state);
console.log("tsv", result.tsv);
```

### Advanced debugging / intermediate reruns

```js
// Step A: only resolve params for all groups
var resolvedPack = await window.reports.stipend.resolveAllGroupReportParams({
  isValid: true,
  lang: "ET",
  size: 200,
  concurrency: 6
});

// Inspect failures before heavy fetching
console.table(
  resolvedPack.unresolved.map(x => ({
    groupCode: x.groupCode,
    exactMatchFound: x.exactMatchFound,
    curriculumVersion: x.curriculumVersion
  }))
);

// Step B: rerun one problematic group manually
var one = resolvedPack.resolved.find(x => x.groupCode === "TA-25A");
var raw = await window.reports.stipend.fetchGroupTeacherReport(one.groupCode, {
  studentGroup: one.studentGroup,
  curriculumVersion: one.curriculumVersion,
  from: "2025-08-01T00:00:00.000Z"
});
var normalized = window.reports.stipend.normalizeGroupReport(raw, one.groupCode);
var singleState = window.reports.stipend.aggregateAll([normalized], {
  logger: console.warn
});
console.log({ raw, normalized, singleState });
```

### Save state to localStorage, refresh, restore

```js
// ---- save snapshot ----
var bulk = await window.reports.stipend.aggregateAndExportAllGroups({
  reportOptions: { from: "2025-08-01T00:00:00.000Z" }
});

var snapshot = window.reports.stipend.saveSnapshotToLocalStorage({
  createdAt: new Date().toISOString(),
  summary: bulk.summary,
  resolved: bulk.resolved,
  unresolved: bulk.unresolved,
  fetchErrors: bulk.fetchErrors,
  tsv: bulk.tsv,
  state: bulk.state
});

console.log("saved", snapshot.summary);

// ---- after page refresh: restore ----
var restored = window.reports.stipend.loadSnapshotFromLocalStorage();

if (restored?.state) {
  // can re-export without re-fetching all reports
  var tsvAgain = window.reports.stipend.exportStudentReportTsv(restored.state);
  console.log("restored", restored.summary, tsvAgain);
}
```

### Optional: quick TSV download

```js
function downloadTsv(filename, tsv) {
  const blob = new Blob([tsv], { type: "text/tab-separated-values;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

downloadTsv("stipend-eligibility-all-groups.tsv", result.tsv);
```

### Minimal rerunnable snippets

These are short versions meant for quick repeated pasting in browser console.

#### Single group (minimal)

```js
var r = await window.reports.stipend.resolveGroupReportParams("IT-24A");
var s = await window.reports.stipend.buildStateForGroup("IT-24A", { studentGroup: r.studentGroup, curriculumVersion: r.curriculumVersion, from: "2020-08-01T00:00:00.000Z", aggregationOptions: { missingGradeCutoffDate: "2026-01-25"} });
var t = window.reports.stipend.exportStudentReportTsv(s);
var problems = window.reports.stipend.exportSubjectReportTsv(s);
console.log(s, t, problems);
```

#### Bulk all groups (minimal)

```js
var b = await window.reports.stipend.aggregateAndExportAllGroups({ reportOptions: { from: "2020-08-01T00:00:00.000Z" }, aggregationOptions: { missingGradeCutoffDate: "2026-01-25"} });
console.log(b.summary, b.unresolved, b.fetchErrors);
console.log(b.state, b.tsv);
```

#### Restore snapshot (minimal)

```js
var x = window.reports.stipend.loadSnapshotFromLocalStorage();
var t = x?.state ? window.reports.stipend.exportStudentReportTsv(x.state) : "";
console.log(x?.summary, t);
```