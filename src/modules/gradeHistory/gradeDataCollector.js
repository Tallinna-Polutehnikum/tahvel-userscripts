import { Authentication } from '../../auth/authentication.js';
import * as env from 'env';
import { fetchGroupByCode } from '../reports/stipend-eligibility/windowApi.js';

// Initialize MSAL authentication
const auth = new Authentication();

const GRADE_DATA_LAST_RUN_KEY = 'tahvelUserscripts.gradeDataCollector.lastRunAt';
let isCollectionInProgress = false;

function getIsoWeekInfo(date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);

  return {
    year: utcDate.getUTCFullYear(),
    week,
  };
}

function getIsoWeekKey(date) {
  const { year, week } = getIsoWeekInfo(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function getLastRunDateFromStorage() {
  try {
    const stored = localStorage.getItem(GRADE_DATA_LAST_RUN_KEY);
    if (!stored) return null;

    const parsed = new Date(stored);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  } catch (err) {
    console.warn('Unable to read grade data last run from localStorage', err);
    return null;
  }
}

function hasRunInCurrentWeek(now = new Date()) {
  const lastRunDate = getLastRunDateFromStorage();
  if (!lastRunDate) return false;
  return getIsoWeekKey(lastRunDate) === getIsoWeekKey(now);
}

function storeLastRunDate(date = new Date()) {
  try {
    localStorage.setItem(GRADE_DATA_LAST_RUN_KEY, date.toISOString());
  } catch (err) {
    console.warn('Unable to store grade data last run in localStorage', err);
  }
}

export async function maybeRunGradeDataForCurrentWeek() {
  const now = new Date();
  if (now.getDay() !== 1) return;
  if (hasRunInCurrentWeek(now)) return;
  await collectAndAggregateGradeData({ source: 'auto' });
}

const NEGATIVE_GRADE_CODES = new Set(['X', 'MA', '1', '2']);

function getGradeBucket(gradeCode) {
  if (typeof gradeCode !== 'string') return null;

  const suffix = gradeCode.split('_').pop();
  if (!suffix) return null;

  if (NEGATIVE_GRADE_CODES.has(suffix)) return 'negative';
  if (suffix === '3') return 'fine';
  if (suffix === '4') return 'good';
  // Ignore SISSEKANNE_A, because it's not a real grade (not comparable to grade 5) and we don't use it in average. Side-effect to this is that fixing negative grades will lower total count of "grades".
  if (suffix === '5') return 'great';

  return null;
}

function incrementGradeBucket(counts, bucket, isFinal) {
  if (!bucket) return;

  const key = isFinal
    ? (`final${bucket.charAt(0).toUpperCase()}${bucket.slice(1)}Grades`)
    : (`${bucket}Grades`);

  counts[key] += 1;
}

function getEntryTimestamp(entry) {
  const sourceDate = entry?.entryDate ?? entry?.gradeInserted ?? null;
  if (!sourceDate) return 0;

  const parsed = Date.parse(sourceDate);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickEffectivePeriodBucket(periodEntries) {
  if (!Array.isArray(periodEntries) || periodEntries.length === 0) return null;

  // If any period grade is negative, treat the journal as negative final-like.
  const negativePeriod = periodEntries.find(entry => getGradeBucket(entry?.grade?.code) === 'negative');
  if (negativePeriod) return 'negative';

  // Otherwise use the latest positive period grade as the final-like state.
  let latest = null;
  let latestTs = -Infinity;
  for (const entry of periodEntries) {
    const bucket = getGradeBucket(entry?.grade?.code);
    if (!bucket) continue;

    const ts = getEntryTimestamp(entry);
    if (!latest || ts >= latestTs) {
      latest = bucket;
      latestTs = ts;
    }
  }

  return latest;
}

function pickLatestFinalBucket(finalEntries) {
  if (!Array.isArray(finalEntries) || finalEntries.length === 0) return null;

  let latest = null;
  let latestTs = -Infinity;
  for (const entry of finalEntries) {
    const bucket = getGradeBucket(entry?.grade?.code);
    if (!bucket) continue;

    const ts = getEntryTimestamp(entry);
    if (!latest || ts >= latestTs) {
      latest = bucket;
      latestTs = ts;
    }
  }

  return latest;
}

function normalizeCurriculumVersion(value) {
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    if (typeof value.id === 'number' || typeof value.id === 'string') return value.id;
  }
  return null;
}

function buildStudentGroupTeacherReportUrl(groupId, curriculumVersion) {
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
  sp.set('curriculumVersion', String(curriculumVersion));
  sp.set('entryType', JSON.stringify(entryTypeMap));
  for (const type of Object.keys(entryTypeMap)) {
    if (entryTypeMap[type]) sp.append('entryTypes', type);
  }
  sp.set('from', '2022-08-01T00:00:00.000Z');
  sp.set('graduatedStudents', 'false');
  sp.set('lang', 'ET');
  sp.set('studentGroup', String(groupId));
  sp.set('studyYear', '');

  return url.toString();
}

function countStudentGrades(student) {
  const counts = {
    negativeGrades: 0,
    finalNegativeGrades: 0,
    fineGrades: 0,
    finalFineGrades: 0,
    goodGrades: 0,
    finalGoodGrades: 0,
    greatGrades: 0,
    finalGreatGrades: 0,
  };

  const resultColumns = Array.isArray(student?.resultColumns) ? student.resultColumns : [];
  for (const column of resultColumns) {
    const journalResult = column?.journalResult;
    if (!journalResult) continue;

    const results = Array.isArray(journalResult.results) ? journalResult.results : [];
    if (journalResult.existsInJournal === false && results.length === 0) continue;

    /** @type {any[]} */
    const finalEntries = [];
    /** @type {any[]} */
    const periodEntries = [];

    for (const result of results) {
      const bucket = getGradeBucket(result?.grade?.code);
      if (!bucket) continue;

      if (result?.entryType === 'SISSEKANNE_L') {
        finalEntries.push(result);
        continue;
      }

      if (result?.entryType === 'SISSEKANNE_R') {
        periodEntries.push(result);
        continue;
      }

      // Regular grade: any graded entry that is not final/period.
      incrementGradeBucket(counts, bucket, false);
    }

    // Effective final per journal:
    // 1) use latest SISSEKANNE_L when it exists
    // 2) otherwise derive from SISSEKANNE_R (negative wins, else latest positive)
    const finalBucket = pickLatestFinalBucket(finalEntries) ?? pickEffectivePeriodBucket(periodEntries);
    incrementGradeBucket(counts, finalBucket, true);
  }

  return counts;
}

function getTotalGradeCount(grades) {
  return (
    (grades?.negativeGrades ?? 0) +
    (grades?.finalNegativeGrades ?? 0) +
    (grades?.fineGrades ?? 0) +
    (grades?.finalFineGrades ?? 0) +
    (grades?.goodGrades ?? 0) +
    (grades?.finalGoodGrades ?? 0) +
    (grades?.greatGrades ?? 0) +
    (grades?.finalGreatGrades ?? 0)
  );
}

export async function collectAndAggregateGradeData({ source = 'manual' } = {}) {
  if (isCollectionInProgress) {
    alert('Grade data collection is already running.');
    return;
  }

  isCollectionInProgress = true;
  const requestId = Math.floor(Math.random() * 1000000);
  let groupData;
  let encounteredPostError = false;

  alert(`Starting grade data collection${source === 'auto' ? ' (weekly auto-run)' : ''}. This may take a while, keep your browser tab active.`);

  try {
    try {
      // Fetch one group for totalElements count to know how many to fetch in the next request
      groupData = await fetch('https://tahvel.edu.ee/hois_back/studentgroups?isValid=false&lang=ET&page=0&size=1&sort=CODE');
      groupData = await groupData.json();

      // Fetch all groups using totalElements from first fetch
      groupData = await fetch(
        `https://tahvel.edu.ee/hois_back/studentgroups?isValid=false&lang=ET&page=0&size=${groupData.totalElements}&sort=CODE`
      );
      groupData = await groupData.json();
    } catch (err) {
      if (err.message.includes('Bad')) {
        console.error('Stopping due to 400 bad request.');
        alert('Please check your credentials.');
        return;
      } else {
        console.error(err);
        alert('An error occurred while fetching group data. Check console for details.');
        return;
      }
    }

    // Server switch on
    try {
      await postUntilSuccess(env.SERVER_URL + '/api/StudentRecord/switch', { id: requestId, isOn: true });
    } catch (err) {
      if (err.message.includes('Unauthorized')) {
        console.error('Stopping due to 401 Unauthorized response.');
        alert('Unauthorized access. Please check your credentials.');
        return;
      } else {
        console.error(err);
        alert('An error occurred while switching on the server. Check console for details.');
        return;
      }
    }

    // Keep one snapshot per student to avoid same-run overwrites when a student appears in multiple groups.
    const bestStudentDataById = new Map();

    // Get group data for each group
    // Use for loop instead of forEach to handle async/await properly
    const totalGroups = groupData.content.length;
    let groupIndex = 0;
    for (const groupEntry of groupData.content) {
      groupIndex++;
      if (groupIndex % 5 === 0 || groupIndex === totalGroups) {
        console.log(`${(groupIndex / totalGroups * 100).toFixed(0)}% Processing group ${groupIndex} of ${totalGroups} (${groupEntry.code})`);
      }
      // fetchGroupByCode is cache-backed (30-day localStorage TTL) so this is
      // effectively free on repeat runs; it only hits the network on first use.
      // Falls back to the student-groups list values when no match is found.
      const cachedMatch = await fetchGroupByCode(groupEntry?.code, {valid: false});
      const resolvedGroupId = cachedMatch?.id ?? groupEntry.id;
      const curriculumVersion = normalizeCurriculumVersion(
        cachedMatch?.curriculumVersion ?? groupEntry?.curriculumVersion
      );

      if (curriculumVersion == null) {
        console.warn('Skipping group because curriculumVersion is missing', {
          groupId: groupEntry?.id,
          groupCode: groupEntry?.code,
          cachedMatchFound: cachedMatch != null,
        });
        continue;
      }

      const reportUrl = buildStudentGroupTeacherReportUrl(resolvedGroupId, curriculumVersion);
      const groupResponse = await fetch(reportUrl);
      if (!groupResponse.ok) {
        console.error(`Failed to fetch report for group ${groupEntry.id} (${groupEntry.code}) with status ${groupResponse.status}`);
        continue;
      }
      const group = await groupResponse.json();

      if (group.students.length === 0) {
        continue;
      }

      // Use for loop instead of forEach to handle async/await properly
      for (const student of group.students) {
        const {
          negativeGrades,
          finalNegativeGrades,
          fineGrades,
          finalFineGrades,
          goodGrades,
          finalGoodGrades,
          greatGrades,
          finalGreatGrades,
        } = countStudentGrades(student);

        // Count absences
        const absenceWithReason = student?.absenceTypeTotals?.PUUDUMINE_V ?? 0;
        const absenceNoReason = student?.absenceTypeTotals?.PUUDUMINE_P ?? 0;

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

        const existingStudentData = bestStudentDataById.get(studentData.id);
        if (!existingStudentData) {
          bestStudentDataById.set(studentData.id, studentData);
          continue;
        }

        const nextTotal = getTotalGradeCount(studentData.grades);
        const existingTotal = getTotalGradeCount(existingStudentData.grades);
        if (nextTotal > existingTotal) bestStudentDataById.set(studentData.id, studentData);
      }
    }
    console.log(`Collected data for ${bestStudentDataById.size} unique students across ${groupData.totalElements} groups.`);

    // Post one snapshot per student
    let count = 0;
    for (const studentData of bestStudentDataById.values()) {
      try {
        await postUntilSuccess(env.SERVER_URL + '/api/StudentRecord', studentData);
        count++;
        // Print progress every 100 students to avoid spamming the console
        if (count % 100 === 0) {
          console.log(`${((count / bestStudentDataById.size) * 100).toFixed(0)}% Posted data for ${count} of ${bestStudentDataById.size} students.`);
        }
      } catch (err) {
        encounteredPostError = true;
        if (err.message.includes('Unauthorized')) {
          console.error('Stopping due to 401 Unauthorized response.');
          alert('Unauthorized access. Please check your credentials.');
          break;
        } else {
          console.error(err);
          alert('An error occurred while posting student data. Check console for details.');
          break;
        }
      }
    }

    // Server switch off
    try {
      await postUntilSuccess(env.SERVER_URL + '/api/StudentRecord/switch', { id: requestId, isOn: false });
    } catch (err) {
      if (err.message.includes('Unauthorized')) {
        console.error('Stopping due to 401 Unauthorized response.');
        alert('Unauthorized access. Please check your credentials.');
        return;
      } else {
        console.error(err);
        alert('An error occurred while switching off the server. Check console for details.');
        return;
      }
    }

    if (encounteredPostError) {
      console.warn('Grade data collection ended with posting errors. Last run timestamp was not updated.');
      return;
    }

    storeLastRunDate(new Date());
    console.log('Grade data collection complete.');
  } finally {
    isCollectionInProgress = false;
  }
}

async function postUntilSuccess(url, data, maxRetries = 5, delayMs = 500) {
  let retries = 0;
  const token = await auth.getToken(); // Acquire access token once before retry loop

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
      return;
    } else if (response.status === 401) {
      throw new Error(`Unauthorized: Access token may be invalid or expired.`);
    } else {
      retries++;
      console.log(`Attempt ${retries} failed with status ${response.status} for student ${data.id}. Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`Max retries reached without success for student ${data.id}. Last response status: ${response.status}`);
}
