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
    missingPeriodSubjects.join(";"),
    missingFinalSubjects.join(";"),
    problemSubjects,
    yesNo(studentStats.exceptionCandidate)
  ];

  return cols.map(tsvCell).join("\t");
}

export function exportStudentReportTsv(state, { groupCode = null, includeHeader = true, sortByName = true } = {}) {
  const header = [
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
    "missingPeriodSubjects",
    "missingFinalSubjects",
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
