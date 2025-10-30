// ==UserScript==
// @name         Data collector
// @namespace    https://tahvel.edu.ee/
// @version      1.0.0
// @description  Student data collector for Tahvel.
// @author       Sven Laht
// @match        https://tahvel.edu.ee/*
// @updateURL    https://raw.githubusercontent.com/Tallinna-Polutehnikum/tahvel-userscripts/main/build/data-collector.user.js
// @downloadURL  https://raw.githubusercontent.com/Tallinna-Polutehnikum/tahvel-userscripts/main/build/data-collector.user.js
// @grant        GM_log
// ==/UserScript==

(() => {
  // src/features/randomRequest.js
  setInterval(() => {
    fetch("https://tahvel.edu.ee/hois_back/user", {
      method: "GET",
      credentials: "include",
      headers: { accept: "application/json, text/plain, */*" }
    });
    console.log("session extended at: " + /* @__PURE__ */ new Date());
  }, 12e4);

  // src/features/studentData.js
  calculateStudentData();
  async function calculateStudentData() {
    let groupData = await fetch("https://tahvel.edu.ee/hois_back/studentgroups?isValid=false&lang=ET&page=0&size=1&sort=CODE");
    groupData = await groupData.json();
    groupData = await fetch(
      `https://tahvel.edu.ee/hois_back/studentgroups?isValid=false&lang=ET&page=0&size=${groupData.totalElements}&sort=CODE`
    );
    groupData = await groupData.json();
    for (const groupEntry of groupData.content) {
      let group = await fetch(
        `https://tahvel.edu.ee/hois_back/reports/studentgroupteacher?canceledStudents=false&curriculumVersion=6478&entryType=%7B%22SISSEKANNE_H%22:true,%22SISSEKANNE_R%22:true,%22SISSEKANNE_O%22:false,%22SISSEKANNE_L%22:true,%22SISSEKANNE_P%22:true,%22SISSEKANNE_T%22:true,%22SISSEKANNE_E%22:true,%22SISSEKANNE_I%22:true%7D&entryTypes=SISSEKANNE_H&entryTypes=SISSEKANNE_R&entryTypes=SISSEKANNE_L&entryTypes=SISSEKANNE_P&entryTypes=SISSEKANNE_T&entryTypes=SISSEKANNE_E&entryTypes=SISSEKANNE_I&from=2022-08-01T00:00:00.000Z&graduatedStudents=false&lang=ET&studentGroup=${groupEntry.id}&studyYear=`
      );
      group = await group.json();
      if (group.students.length === 0) {
        continue;
      }
      for (const student of group.students) {
        let getGrade = function(gradeCode, isFinal) {
          let split = gradeCode.split("_");
          const gradeActions = {
            X: () => negativeGrades++,
            MA: () => negativeGrades++,
            1: () => negativeGrades++,
            2: () => negativeGrades++,
            3: () => fineGrades++,
            4: () => goodGrades++,
            5: () => greatGrades++
          };
          const finalGradeActions = {
            X: () => finalNegativeGrades++,
            MA: () => finalNegativeGrades++,
            1: () => finalNegativeGrades++,
            2: () => finalNegativeGrades++,
            3: () => finalFineGrades++,
            4: () => finalGoodGrades++,
            5: () => finalGreatGrades++
          };
          if (isFinal) {
            if (finalGradeActions[split[1]]) {
              finalGradeActions[split[1]]();
            }
            return;
          }
          if (gradeActions[split[1]]) {
            gradeActions[split[1]]();
          }
          return;
        };
        let negativeGrades = 0;
        let finalNegativeGrades = 0;
        let fineGrades = 0;
        let finalFineGrades = 0;
        let goodGrades = 0;
        let finalGoodGrades = 0;
        let greatGrades = 0;
        let finalGreatGrades = 0;
        let absenceWithReason = 0;
        let absenceNoReason = 0;
        student.resultColumns.forEach((entry) => {
          try {
            if (entry.journalResult.existsInJournal) {
              entry.journalResult.results.forEach((result) => {
                if (result.entryType === "SISSEKANNE_L") {
                  getGrade(result.grade.code, true);
                } else if (["SISSEKANNE_H", "SISSEKANNE_I", "SISSEKANNE_C", "SISSEKANNE_T"].includes(result.entryType)) {
                  getGrade(result.grade.code, false);
                }
              });
            }
          } catch (e) {
            console.error(`Error processing grades for student ${student.id} in class ${groupEntry.id}: `, e);
          }
        });
        absenceWithReason = student.absenceTypeTotals.PUUDUMINE_V;
        absenceNoReason = student.absenceTypeTotals.PUUDUMINE_P;
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
        await postUntilSuccess("http://localhost:8080/api/StudentRecord", studentData).then(() => console.log("Finished successfully")).catch((err) => console.error(err));
      }
    }
    console.log("Student data collection complete.");
  }
  async function postUntilSuccess(url, data, maxRetries = 5, delayMs = 500) {
    let retries = 0;
    while (retries < maxRetries) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (response.status === 200) {
        console.log("Success");
        return;
      } else {
        retries++;
        console.log(`Attempt ${retries} failed with status ${response.status}. Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw new Error(`Max retries reached without success.`);
  }
})();
