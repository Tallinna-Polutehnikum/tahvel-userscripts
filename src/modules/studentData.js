import { Authentication } from '../auth/authentication.js';
import * as env from 'env';

// Initialize MSAL authentication
const auth = new Authentication();

const studentDataLastRunKey = 'tahvelUserscripts.studentData.lastRunAt';
let isCollectionInProgress = false;

async function collectStudentData() {
  if (isCollectionInProgress) {
    alert('Student data collection is already in progress.');
    return;
  };
  isCollectionInProgress = true;

  let groupsData;

  alert('Starting student data collection. This may take a while.');

  const scriptStart = performance.now();

  try {
    // Fetch all groups
    try {
      groupsData = await getStudentGroups();
      // Fetch all groups using totalElements from first fetch
      groupsData = await getStudentGroups(groupsData.totalElements);
    } catch (err) {
      console.error(err);
      alert(err.message);
    };

    const emptyGroups = getEmptyGroups();

    // Go through each group, gather student data and POST to server
    for (const group of groupsData.content) {
      if (emptyGroups.includes(group.id)) continue; // Skip groups that were previously found to be empty

      const groupId = group.id;
      const groupData = await getGroupData(groupId);

      let groupResult = {
        groupId: groupId,
        groupCode: group.code,
        students: [],
      }

      // Process each student in the group
      for (const student of groupData.students) {
        const studentResult = countAndFormatStudentResult(student);

        groupResult.students.push(studentResult);
      }

      // Post data to server
      try {
        if (groupResult.students.length === 0) {
          addEmptyGroups(groupId);

          console.log(`Group (id: ${groupId}, code: ${group.code}) has no students. Skipping.`);

          continue;
        }; // Skip and store empty groups

        const url = env.SERVER_URL + '/api/StudentRecord';

        const response = await postUntilSuccess(url, groupResult);

        console.log(`POST request for group (id: ${groupId}, code: ${group.code}). Server response (inserted: ${response.response.inserted}, skipped: ${response.response.skipped}). Time taken: ${response.time} ms`);
      } catch (err) {
        console.error(err);
      };
    };
  } finally {
    isCollectionInProgress = false;

    const scriptEnd = performance.now();
    console.log(`Data gathering time: ${((scriptEnd - scriptStart) / 60000).toFixed(2)} mins`);

    alert('Student data collection finished.');
  };
};

export {
  collectStudentData,
};

// Helper functions

function buildGroupDataUrl(groupId) {
  const url = new URL('https://tahvel.edu.ee/hois_back/reports/studentgroupteacher');
  
  const entryTypeMap = {
    SISSEKANNE_H: true,
    SISSEKANNE_R: true,
    SISSEKANNE_O: false,
    SISSEKANNE_L: true,
    SISSEKANNE_P: true,
    SISSEKANNE_T: true,
    SISSEKANNE_E: true,
    SISSEKANNE_I: true,
  };

  const sp = url.searchParams;
  sp.set('canceledStudents', 'false');
  // sp.set('curriculumVersion', '6478');
  sp.set('entryType', JSON.stringify(entryTypeMap));
  for (const type of Object.keys(entryTypeMap)) {
    if (entryTypeMap[type]) sp.append('entryTypes', type);
  }
  sp.set('from', '2022-08-01T00:00:00.000Z');
  sp.set('graduatedStudents', 'false');
  // sp.set('lang', 'ET');
  sp.set('studentGroup', String(groupId));
  // sp.set('studyYear', '');

  return url.toString();
}

function countAndFormatStudentResult(student) {
  let studentResult = {
    id: student.id,
    grades: {
      negative: {
        grades: 0,
        finalGrades: 0,
      },
      acceptable: {
        grades: 0,
        finalGrades: 0,
      },
      fine: {
        grades: 0,
        finalGrades: 0,
      },
      good: {
        grades: 0,
        finalGrades: 0,
      },
      great: {
        grades: 0,
        finalGrades: 0,
      },
    },
    absences: {
      withReason: student.absenceTypeTotals.PUUDUMINE_V,
      noReason: student.absenceTypeTotals.PUUDUMINE_P,
      metric: student.lessonAbsencePercentage,
    },
  };

  const gradeCategory = {
    X: "negative",
    MA: "negative",
    1: "negative",
    2: "negative",
    A: "acceptable",
    3: "fine",
    4: "good",
    5: "great",
  };

  function incrementGrade(grade, field) {
    const category = gradeCategory[grade];
    if (category) {
      studentResult.grades[category][field]++;
    }
  }

  // Remove SISSEKANNE_ prefix and get grade code
  function getGradeFromCode(gradeCode) {
    const split = gradeCode.split('_');
    return split[1];
  };
  
  const entryTypeToField = (entryType) => ({
    SISSEKANNE_L: "finalGrades", // Consider special role for SISSEKANNE_R
  })[entryType] ?? "grades";

  // Count and filter student grades
  for (const column of student.resultColumns) {
    const journal = column.journalResult;
    if (!journal?.existsInJournal) continue;

    for (const result of journal.results) {
      const field = entryTypeToField(result.entryType);
      if (!field || !result.grade?.code) continue;
      if (result.entryType === "SISSEKANNE_R") continue; // Skip SISSEKANNE_R for now, as it may require special handling

      incrementGrade(getGradeFromCode(result.grade.code), field);
    }
  }

  return studentResult;
}

const emptyGroupsKey = 'tahvelUserscripts.studentData.emptyGroups';

function getEmptyGroups() {
  const emptyGroupsJson = localStorage.getItem(emptyGroupsKey);
  return emptyGroupsJson ? JSON.parse(emptyGroupsJson) : [];
}

function addEmptyGroups(groupId) {
  const emptyGroups = getEmptyGroups();
  if (!emptyGroups.includes(groupId)) {
    emptyGroups.push(groupId);
    localStorage.setItem(emptyGroupsKey, JSON.stringify(emptyGroups));
  }
}

// GET, POST data functions

async function getStudentGroups(size = 0) {
  const url = (size) => `https://tahvel.edu.ee/hois_back/studentgroups?isValid=false&lang=ET&page=0&size=${size}&sort=CODE`;

  const response = await fetch(url(size));

  if (!response.ok) {
    if (response.status === 400) {
      throw new Error("Bad Request: please check your credentials.");
    } else {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
  }

  try {
    return await response.json();
  } catch (err) {
    throw new Error(`Failed to parse JSON: ${err.message}`);
  }
};

async function getGroupData(groupId) {
  const url = buildGroupDataUrl(groupId);

  const response = await fetch(url);
  
  if (!response.ok) {
    if (response.status === 400) {
      throw new Error("Bad Request: please check your credentials.");
    } else {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
  }

  try {
    return await response.json();
  } catch (err) {
    throw new Error(`Failed to parse JSON: ${err.message}`);
  }
};

async function postUntilSuccess(url, data, maxRetries = 5, delayMs = 500) {
  let retries = 0;
  const token = await auth.getToken(); // Acquire access token once before retry loop
  const postUntilSuccessStart = performance.now();

  while (retries < maxRetries) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (response.status === 200) {
      const postUntilSuccessEnd = performance.now();

      return { response: await response.json(), time: (postUntilSuccessEnd - postUntilSuccessStart).toFixed(2) };
    } else if (response.status === 401) {
      throw new Error(`Unauthorized: Access token may be invalid or expired.`);
    } else {
      retries++;
      console.log(`Attempt ${retries} failed with status ${response.status}. Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`Max retries reached without success.`);
};
