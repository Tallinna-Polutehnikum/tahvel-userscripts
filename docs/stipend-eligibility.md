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
- problematicSubjects list where missing period/final applies

Subject-level:
- totalStudentsInSubject
- nonGradedStudents
- studentsWithFinal, studentsWithNegativeFinal, studentsMissingFinal
- teachers (unique)

## Negative grades
KUTSEHINDAMINE_[MA, X, 1, 2] are negative.

## Missing gradeCode
- If gradeCode missing/null: warn with groupCode, student name, studentId, journalId, studentEntryId; skip counting.

## Multi-semester heuristic (IMPORTANT)
- Missing FINAL or PERIOD is only flagged for a student if that journal has at least one corresponding grade (final/period) for ANY student in the GROUP.

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
missingPeriodSubjects, missingFinalSubjects,
problemSubjects (semicolon list Subject|Teacher|flags),
exceptionCandidate (true/false)


## Next implementation step

Next, we implement in code:

subject-level counters + problematicByRule + reasons (as described)

build a problematicJournalSet

compute exceptionCandidate for students (draft rule)

TSV exporters

### Draft rule for exceptionCandidate (reasonable default)

A student is exceptionCandidate=true if:

they have any negative grade(s) (period or final), AND

all their negative grades are in journals marked problematicByRule.

### Update aggregate.js (add subject-level student counters)

when processing each student+subject:

after scanning entries, update these counters:

if studentHasAnyGradeInSubject => studentsWithAnyGrade++

if studentHasFinal => studentsWithFinal++

if studentHasFinal && negativeFinalSeen => studentsWithNegativeFinal++

if journalHasFinal[journalId] && !studentHasFinal => studentsMissingFinal++

We need to detect negativeFinalSeen per student+subject (not “count of negative finals”).

### Patch-style code (drop-in additions)

```js
// ... inside per-student per-journal loop:
let studentHasFinal = false;
let studentHasPeriod = false;
let studentHasAnyGradeInSubject = false;
let studentHasNegativeFinal = false;

for (const e of j.entries) {
  // ...existing teacher/date...

  if (!e.gradeCode) { warn(...); continue; }

  studentHasAnyGradeInSubject = true;
  studentStats.totalGrades += 1;
  subj.totalGradeCount += 1;

  if (e.entryType === "SISSEKANNE_R") {
    studentHasPeriod = true;
    // ...existing period counters...
  }

  if (e.entryType === "SISSEKANNE_L") {
    studentHasFinal = true;
    // ...existing final counters...
    if (isNegative(e.gradeCode)) studentHasNegativeFinal = true;
  }
}

// after loop:
if (studentHasAnyGradeInSubject) subj.studentsWithAnyGrade += 1;
if (studentHasFinal) subj.studentsWithFinal += 1;
if (studentHasNegativeFinal) subj.studentsWithNegativeFinal += 1;

const shouldConsiderFinalMissing = journalHasFinal[journalId] === true;
if (shouldConsiderFinalMissing && !studentHasFinal) subj.studentsMissingFinal += 1;
```

### After aggregating the group: decide “problematic”

At the end of aggregateGroup, after sets->arrays conversion:

```js
for (const k of Object.keys(state.subjectStatMap)) {
  const subj = state.subjectStatMap[k];
  const total = subj.totalStudentsInSubject || 0;
  if (!total) continue;

  const negOrMissingFinal = subj.studentsWithNegativeFinal + subj.studentsMissingFinal;
  const ratio = negOrMissingFinal / total;

  const reasons = [];
  if (subj.totalFinalGrades > 0 && ratio >= 0.75) {
    reasons.push(`NEG_OR_MISSING_FINAL_${Math.round(ratio * 100)}%`);
  }

  const nonGradedRatio = subj.nonGradedStudents / total;
  if (nonGradedRatio >= 0.75) {
    reasons.push(`NOT_GRADED_${Math.round(nonGradedRatio * 100)}%`);
  }

  subj.problematicByRule = reasons.length > 0;
  subj.problematicReasons = reasons;
}
```