function tsvCell(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[\t\r\n]+/g, " ").trim();
}

function yesNo(value) {
  return value ? "true" : "false";
}

function uniqSorted(arr) {
  return [...new Set(arr)].sort((a, b) => String(a).localeCompare(String(b), "et"));
}

export function studentToTsvRow(studentStats) {
  const problematic = Array.isArray(studentStats.problematicSubjects) ? studentStats.problematicSubjects : [];

  const missingPeriodSubjects = uniqSorted(
    problematic.filter(p => Array.isArray(p.flags) && p.flags.includes("missingPeriod")).map(p => p.subject)
  );
  const missingFinalSubjects = uniqSorted(
    problematic.filter(p => Array.isArray(p.flags) && p.flags.includes("missingFinal")).map(p => p.subject)
  );

  const problemSubjects = problematic
    .map(p => {
      const flags = Array.isArray(p.flags) ? p.flags.join(",") : "";
      return `${p.subject}|${p.teacher ?? ""}|${flags}`;
    })
    .join(";");

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

  return cols.map(tsvCell).join("\t");
}

export function exportStudentReportTsv(state, { groupCode = null, includeHeader = true, sortByName = true } = {}) {
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
  ].join("\t");

  const groups = state?.groups ?? {};
  const groupCodes = groupCode ? [groupCode] : Object.keys(groups).sort((a, b) => a.localeCompare(b, "et"));

  /** @type {any[]} */
  const rows = [];
  for (const gc of groupCodes) {
    const students = Array.isArray(groups[gc]) ? [...groups[gc]] : [];
    if (sortByName) students.sort((a, b) => String(a.fullname).localeCompare(String(b.fullname), "et"));
    for (const st of students) rows.push(studentToTsvRow(st));
  }

  return (includeHeader ? [header, ...rows] : rows).join("\n");
}

export function exportSubjectReportTsv(state, { onlyProblematic = true, includeHeader = true } = {}) {
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
  ].join("\t");

  const subjectStatMap = state?.subjectStatMap ?? {};

  const subjects = Object.values(subjectStatMap)
    .filter(s => !onlyProblematic || s.problematicByRule)
    .sort((a, b) => {
      const aName = String(a.subject ?? "");
      const bName = String(b.subject ?? "");
      const nameCmp = aName.localeCompare(bName, "et");
      return nameCmp !== 0 ? nameCmp : (a.journalId ?? 0) - (b.journalId ?? 0);
    });

  const rows = subjects.map(s => {
    const groupCodes = Array.isArray(s.groupCodes) ? s.groupCodes : (s.groupCodes instanceof Set ? [...s.groupCodes].sort() : []);
    const teachers = Array.isArray(s.teachers) ? s.teachers : (s.teachers instanceof Set ? [...s.teachers].sort() : []);
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

    return cols.map(tsvCell).join("\t");
  });

  return (includeHeader ? [header, ...rows] : rows).join("\n");
}
