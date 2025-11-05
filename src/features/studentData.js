import { msalInstance, msalReady } from './msal.js';
import * as env from 'env';

calculateStudentData();

async function getAccessToken() {
  let accessToken;

  await msalReady;

  // Prepare token request - adjust scopes and account as needed
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) {
    throw new Error('No authenticated user found');
  }

  // Include the active account in the request to acquireTokenSilent
  const silentRequest = { scopes: [env.MSAL_CLIENT_ID + '/.default'], account: accounts[0] };

  try {
    const tokenResponse = await msalInstance.acquireTokenSilent(silentRequest);
    accessToken = tokenResponse.accessToken;
  } catch (error) {
    console.error('Could not acquire token silently', error);
    throw error;
  }

  return accessToken;
}

async function calculateStudentData() {
  const requestId = Math.floor(Math.random() * 1000000);

  // Fetch one group
  let groupData = await fetch('https://tahvel.edu.ee/hois_back/studentgroups?isValid=false&lang=ET&page=0&size=1&sort=CODE');
  groupData = await groupData.json();

  // Fetch all groups using totalElements from first fetch
  groupData = await fetch(
    `https://tahvel.edu.ee/hois_back/studentgroups?isValid=false&lang=ET&page=0&size=${groupData.totalElements}&sort=CODE`
  );
  groupData = await groupData.json();

  // Server switch on
  try {
    await postUntilSuccess(env.SERVER_URL + '/api/StudentRecord/switch', { id: requestId, isOn: true });
    console.log('Finished successfully');
  } catch (err) {
    if (err.message.includes('Unauthorized')) {
      console.error('Stopping due to 401 Unauthorized response.');
      return;
    } else {
      console.error(err);
      return;
    }
  }

  // Get group data for each group
  // Use for loop instead of forEach to handle async/await properly
  mainLoop: for (const groupEntry of groupData.content) {
    let group = await fetch(
      `https://tahvel.edu.ee/hois_back/reports/studentgroupteacher?canceledStudents=false&curriculumVersion=6478&entryType=%7B%22SISSEKANNE_H%22:true,%22SISSEKANNE_R%22:true,%22SISSEKANNE_O%22:false,%22SISSEKANNE_L%22:true,%22SISSEKANNE_P%22:true,%22SISSEKANNE_T%22:true,%22SISSEKANNE_E%22:true,%22SISSEKANNE_I%22:true%7D&entryTypes=SISSEKANNE_H&entryTypes=SISSEKANNE_R&entryTypes=SISSEKANNE_L&entryTypes=SISSEKANNE_P&entryTypes=SISSEKANNE_T&entryTypes=SISSEKANNE_E&entryTypes=SISSEKANNE_I&from=2022-08-01T00:00:00.000Z&graduatedStudents=false&lang=ET&studentGroup=${groupEntry.id}&studyYear=`
    );
    group = await group.json();

    if (group.students.length === 0) {
      continue;
    }

    // Use for loop instead of forEach to handle async/await properly
    for (const student of group.students) {
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

      function getGrade(gradeCode, isFinal) {
        let split = gradeCode.split('_');

        // Map grade to action
        const gradeActions = {
          X: () => negativeGrades++,
          MA: () => negativeGrades++,
          1: () => negativeGrades++,
          2: () => negativeGrades++,
          3: () => fineGrades++,
          4: () => goodGrades++,
          5: () => greatGrades++,
        };

        const finalGradeActions = {
          X: () => finalNegativeGrades++,
          MA: () => finalNegativeGrades++,
          1: () => finalNegativeGrades++,
          2: () => finalNegativeGrades++,
          3: () => finalFineGrades++,
          4: () => finalGoodGrades++,
          5: () => finalGreatGrades++,
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
      }

      // Count and filter student grades
      student.resultColumns.forEach(entry => {
        try {
          if (entry.journalResult.existsInJournal) {
            entry.journalResult.results.forEach(result => {
              if (result.entryType === 'SISSEKANNE_L') {
                getGrade(result.grade.code, true);
              } else if (['SISSEKANNE_H', 'SISSEKANNE_I', 'SISSEKANNE_C', 'SISSEKANNE_T'].includes(result.entryType)) {
                getGrade(result.grade.code, false);
              }
            });
          }
        } catch (e) {
          console.error(`Error processing grades for student ${student.id} in class ${groupEntry.id}: `, e);
        }
      });

      // Count absences
      absenceWithReason = student.absenceTypeTotals.PUUDUMINE_V;
      absenceNoReason = student.absenceTypeTotals.PUUDUMINE_P;

      // Format student data
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
          finalGreatGrades,
        },
        absences: { absenceWithReason, absenceNoReason, calculatedMetric: student.lessonAbsencePercentage ?? 0 },
      };

      try {
        await postUntilSuccess(env.SERVER_URL + '/api/StudentRecord', studentData);
        console.log('Finished successfully');
      } catch (err) {
        if (err.message.includes('Unauthorized')) {
          console.error('Stopping due to 401 Unauthorized response.');
          break mainLoop; // Break the outer loop
        } else {
          console.error(err);
          break mainLoop; // Break the outer loop
        }
      }
    }
  }

  // Server switch off
  try {
    await postUntilSuccess(env.SERVER_URL + '/api/StudentRecord/switch', { id: requestId, isOn: false });
    console.log('Finished successfully');
  } catch (err) {
    if (err.message.includes('Unauthorized')) {
      console.error('Stopping due to 401 Unauthorized response.');
      return;
    } else {
      console.error(err);
      return;
    }
  }

  console.log('Student data collection complete.');
}

async function postUntilSuccess(url, data, maxRetries = 5, delayMs = 500) {
  let retries = 0;
  const token = await getAccessToken(); // Acquire access token once before retry loop

  while (retries < maxRetries) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`, // Add the token here
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (response.status === 200) {
      console.log('Success');
      return;
    } else if (response.status === 401) {
      throw new Error(`Unauthorized: Access token may be invalid or expired.`);
    } else {
      retries++;
      console.log(`Attempt ${retries} failed with status ${response.status}. Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`Max retries reached without success.`);
}
