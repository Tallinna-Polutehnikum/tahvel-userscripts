console.log = GM_log;

const ContractStatus = {
  LEPING_STAATUS_K: 'Kehtiv',
  LEPING_STAATUS_T: 'Tühistatud',
  LEPING_STAATUS_L: 'Lõpetatud',
  LEPING_STAATUS_Y: 'Ülevaatamisel',
  LEPING_STAATUS_S: 'Koostamisel',
};

(async function () {
  'use strict';
  // TODO full text of description for ChatGPT?

  // TODO students local database: name, isikukood, email, group, missing grades, last update (grades, practice, thesis), practice manual good-to-go, has practice contract int, completed hours, thesis (date, topic, grade, manual good-to-go), etc
  // TODO grades history database: student, subject, grade, date, teacher, etc

  let ends2026 = ['TA-22E', 'TA-22V', 'KTA-24', 'IT-22E', 'IT-22V', 'KIT-24', 'SA-23'];
  let ends2025 = ['TA-21E', 'TA-21V', 'KTA-23E', 'KTA-23V', 'IT-21E', 'IT-21V', 'KIT-23E', 'KIT-23V', 'SA-22', 'LA-22'];
  let ends2024 = ['TA-20E', 'TA-20V', 'KTA-22E', 'KTA-22V', 'IT-20E', 'IT-20V', 'KIT-22E', 'KIT-22V', 'SA-21'];
  let ends2023 = ['TA-19E', 'TA-19V', 'KTA-21E', 'KTA-21V', 'IT-19E', 'IT-19V', 'KIT-21E', 'KIT-21V', 'SA-20', 'LA-20'];
  let ends2022 = ['TA-18E', 'TA-18V', 'KTA-20E', 'KTA-20V', 'IT-18E', 'IT-18V', 'KIT-20E', 'KIT-20V', 'SA-19'];
  let allITgroups = [...ends2022, ...ends2023, ...ends2024, ...ends2025, ...ends2026];

  //importGroups(allITgroups);
  //updatePracticeReports(allITgroups);
  //printFullReports(allITgroups);

  //updateGroupsMap(); // once a year
  //updatePracticeReports("TA-20E TA-20V KTA-22E KTA-22V IT-20E IT-20V KIT-22E KIT-22V SA-21".split(" "));
  //printPracticeReports("TA-20E TA-20V KTA-22E KTA-22V IT-20E IT-20V KIT-22E KIT-22V SA-21".split(" "));
  //updatePracticeReport(3326);
  //printPracticeReport(3326, 'tsv');

  //itgroups = "TA-20E TA-20V KTA-22E KTA-22V IT-20E IT-20V KIT-22E KIT-22V SA-21 TA-19E TA-19V KTA-21E KTA-21V IT-19E IT-19V KIT-21E KIT-21V SA-20 TA-18E TA-18V KTA-20E KTA-20V IT-18E IT-18V KIT-20E KIT-20V SA-19".split(" ");
  //importGroups(itgroups);
  //updatePracticeReports(itgroups);
  //printFullReports(itgroups);

  //importOvertimeStudents("2024-09-01T00:00:00.000Z")

  //importGroups("TA-18E TA-18V KTA-20E KTA-20V IT-18E IT-18V KIT-20E KIT-20V SA-19".split(" "));
  //updatePracticeReports("TA-18E TA-18V KTA-20E KTA-20V IT-18E IT-18V KIT-20E KIT-20V SA-19".split(" "));
  //printFullReports("TA-18E TA-18V KTA-20E KTA-20V IT-18E IT-18V KIT-20E KIT-20V SA-19".split(" "));

  unsafeWindow.printFullReports = printFullGroupsReports;
  unsafeWindow.importGroups = importGroups;
  unsafeWindow.importStudentsByGroup = importStudentsByGroup;
  unsafeWindow.importOvertimeStudents = importOvertimeStudents;
  unsafeWindow.updatePracticeReports = updatePracticeReports;
  unsafeWindow.printPracticeReports = printPracticeReports;
  unsafeWindow.updatePracticeReport = updatePracticeReport;
  unsafeWindow.printPracticeReport = printPracticeReport;
  unsafeWindow.updateGroupsMap = updateGroupsMap;
})();

async function updatePracticeReports(groups) {
  for (let group of groups) {
    if (!groupsMap[group]) {
      console.warn(`Group ${group} not found in groupsMap`);
      continue;
    }

    await updatePracticeReport(groupsMap[group]);
    await savePracticeReport(groupsMap[group]);
  }
}

async function importGroups(groups) {
  for (let group of groups) {
    if (!groupsMap[group]) {
      console.warn(`Group ${group} not found in groupsMap`);
      continue;
    }

    await importStudentsByGroup(groupsMap[group]);
  }
}

async function savePracticeReport(groupId) {
  // get data from local storage
  const localStorageKey = `us_praktikaaruanne_${groupId}`;
  const students = JSON.parse(localStorage.getItem(localStorageKey));
  const pinToStudentId = JSON.parse(localStorage.getItem('pinToStudentId')) ?? {};
  const pinToStudentGroup = JSON.parse(localStorage.getItem('pinToStudentGroup')) ?? {};
  const studentIdToPin = Object.fromEntries(Object.entries(pinToStudentId).map(([key, value]) => [value, key]));

  Object.entries(students).forEach(([studentId, practiceSummary]) => {
    if (!studentIdToPin[studentId] || studentIdToPin[studentId]?.length !== 11) {
      console.warn(
        `Student ${studentId} not found in pinToStudentId, skipping one entry savePracticeReport (group:${groupId})`
      );
      return;
    }
    let pin = studentIdToPin[studentId];

    // remove unnecessary data
    delete practiceSummary.name;
    delete practiceSummary.group;
    delete practiceSummary.email;
    //delete practiceSummary.contracts;

    // Save to Azure Cosmos DB using API
    fetch('http://localhost:3000/students/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pin, pin, studentGroup: pinToStudentGroup[pin], practiceSummary }),
    })
      .then(response => {
        if (response.ok) {
          console.log(reverseGroupsMap[groupId] + ' Student practiceSummary updated successfully');
        } else {
          console.error('Failed to save student');
        }
      })
      .catch(error => {
        console.error(error);
      });
  });
}

function printPracticeReports(groups, type = 'tsv') {
  let result = '';
  for (let group of groups) {
    if (!groupsMap[group]) {
      console.warn(`Group ${group} not found in groupsMap`);
      continue;
    }

    result += printPracticeReport(groupsMap[group], type, false);
  }
  return result;
}

async function printFullGroupsReports(groups) {
  let result = '';
  let isFirst = true;
  for (let group of groups) {
    if (!groupsMap[group]) {
      console.warn(`Group ${group} not found in groupsMap`);
      continue;
    }

    result += await printFullReport(groupsMap[group], 'tsv', isFirst);
    isFirst = false;
  }

  try {
    await navigator.clipboard.writeText(result);
    console.log('Full report copied to clipboard');
  } catch (error) {
    console.error(error.message);
    console.log(result);
  }
  return result;
}

async function printFullReport(groupId, type = 'tsv', addHeader = false) {
  let result = '';
  /** @var string[] groupStudentsPins */
  let groupStudentsPins = JSON.parse(localStorage.getItem(`group_student_pins_${groupId}`));
  let groupCode = reverseGroupsMap[groupId];

  const studentKeys = [
    'firstName',
    'lastName',
    'studentGroup',
    'pin',
    'tahvelId',
    'lastTahvelGtrUpdate',
    'officialEmail',
    'personalEmail',
    'ehisCode',
    'studyStart',
    'nominalStudyEnd',
    'curriculumPercentage',
    'totalFinalGrades',
    'negativeFinalGrades',
    'practiceGrade',
    'thesisGrade',
  ];
  const practiceSummaryKeys = [
    'firstContractStartDate',
    'lastContractEndDate',
    'maxHours',
    'totalHours',
    'totalDiaryEntries',
    'supervisorComments',
    'teacherComments',
    'totalCharsInDescription' /*, "companies" this one is added manually*/,
  ];
  const manualHeaders = ['internship', 'companies'];
  result += addHeader ? studentKeys.concat(practiceSummaryKeys).concat(manualHeaders).join('\t') + '\n' : '';

  for (let pin of groupStudentsPins) {
    // Retrieve student from Azure Cosmos DB using API
    let response = await fetch(`http://localhost:3000/students/${groupCode}/${pin}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      let student = await response.json();
      if (!student) {
        console.error('Student not found in database or JSON parse error ' + pin + ' ' + groupCode);
        return;
      }
      //console.log("Got student " + pin + " " + groupCode, student);
      let studentData = studentKeys.map(key => student[key]);
      if (student.practiceSummary) {
        let practiceSummaryFiltered = practiceSummaryKeys.map(key =>
          formatPracticeReportValue(student.practiceSummary, key)
        );
        studentData.push(...practiceSummaryFiltered);
      } else {
        studentData.push(...Array(practiceSummaryKeys.length).fill(''));
      }

      // Add some aggregated data to the end of the row
      //#region Check if student has internship done
      // Tundide põhine arvutus näitab kas hetkel tundub eksamile pääsemine võimalik või mitte, täpsemalt selgub pärast hindamist
      let totalHoursNeeded = 880;
      let internshipDone = '';
      if (student.practiceSummary) {
        if (student.studentGroup.startsWith('SA-') || student.studentGroup.startsWith('LA-')) {
          totalHoursNeeded = 790;
        }
        if (student.practiceSummary.totalHours >= totalHoursNeeded) {
          internshipDone = 'sobib';
        } else if (student.practiceSummary.totalHours >= totalHoursNeeded * 0.8) {
          internshipDone = 'võime lubada aga diplom hiljem';
        }
        if (student.practiceSummary.maxHours - student.practiceSummary.totalHours < -100) {
          internshipDone += ' (suur vahe lepingus märgitud tundidega)';
        }
      }
      // Praktika lõpphinne, näiteks VÕTA kaudu hinnatud praktika, kirjutab üle tundide põhise arvutuse
      if (student.practiceGrade.includes('A')) {
        internshipDone = 'korras';
      }
      studentData.push(internshipDone);
      //#endregion

      // Add companies to the end of the row, this should be the last column as it has long variable length text and its easier to read in Excel
      studentData.push(formatPracticeReportValue(student.practiceSummary, 'companies'));

      result += studentData.join('\t') + '\n';
    } else {
      console.error('Failed to get student ' + pin + ' ' + groupCode);
    }
  }
  return result;
}

function printPracticeReport(groupId, type = 'tsv', addHeader = true) {
  if (typeof groupId === 'string') {
    groupId = groupsMap[groupId];
  }

  const localStorageKey = `us_praktikaaruanne_${groupId}`;
  const students = JSON.parse(localStorage.getItem(localStorageKey));
  let sortedStudents = Object.values(students).sort((a, b) => b.totalDiaryEntries - a.totalDiaryEntries);

  if (type === 'raw') {
    console.log(sortedStudents);
    return sortedStudents;
  }

  let tableHeader = [
    'name',
    'email',
    'group',
    'maxHours',
    'totalHours',
    'missingFromMinimum',
    'aproxEnd',
    'lastContractEndDate',
    'firstContractStartDate',
    'totalDiaryEntries',
    'supervisorComments',
    'teacherComments',
    'totalCharsInDescription',
    'inProgressContracts',
    'hoursOnWeekdays',
    '',
    '',
    '',
    '',
    '',
    '',
    'studentEvalFilled',
    'studentEvalTotal',
    'studentEvalWorst',
    'studentEvalComments',
    'supervisorEvalFilled',
    'supervisorEvalTotal',
    'supervisorEvalWorst',
    'supervisorEvalComments',
    'internship',
    'companies',
  ];
  if (type === 'tsv') {
    let string = addHeader ? tableHeader.join('\t') + '\n' : '';
    for (let student of sortedStudents) {
      string +=
        tableHeader
          .filter(key => key !== '')
          .map(key => formatPracticeReportValue(student, key))
          .join('\t') + '\n';
    }
    console.log(string);
    return string;
  }

  if (type === 'table') {
    console.table(sortedStudents);
  }
}

function formatPracticeReportValue(data, key) {
  if (key === 'missingFromMinimum') {
    return Math.max(880 - data.totalHours, 0);
  } else if (key === 'email') {
    let nameParts = data.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(' ');
    let lastName = nameParts.pop();
    return nameParts.join('') + '.' + lastName + '@tptlive.ee';
  } else if (key === 'aproxEnd') {
    let hoursPerDay = data.totalDiaryEntries ? data.totalHours / data.totalDiaryEntries : 0;
    if (hoursPerDay === 0) return 'N/A';
    let daysLeft = (Math.max(0, 880 - data.totalHours) / hoursPerDay / 5) * 7;
    if (daysLeft === 0) return 'Korras';
    return new Date(new Date().getTime() + daysLeft * 24 * 60 * 60 * 1000).toLocaleDateString('et-EE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } else if (key === 'firstContractStartDate') {
    return new Date(data[key]).toLocaleDateString('et-EE', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } else if (key === 'lastContractEndDate') {
    return new Date(data[key]).toLocaleDateString('et-EE', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } else if (key === 'inProgressContracts') {
    return data.completedContracts - data.inProgressContracts + ' / ' + (data.completedContracts + data.inProgressContracts);
  } else if (key === 'hoursOnWeekdays') {
    return data[key].join('\t');
  } else if (key === 'companies') {
    return data?.contracts
      ? Object.values(data.contracts)
          .filter(c => c.status === 'LEPING_STAATUS_K' || c.status === 'LEPING_STAATUS_L')
          .map(c => c.companyName)
          .join(', ')
      : '';
  } else {
    return data[key];
  }
}

let groupsMap = JSON.parse(localStorage.getItem('us_groupsMap')) || {};
let reverseGroupsMap = Object.fromEntries(Object.entries(groupsMap).map(([key, value]) => [value, key]));
async function updateGroupsMap() {
  let groups = {};
  let data = await fetch('https://tahvel.edu.ee/hois_back/studentgroups?isValid=false&lang=ET&size=400', {
    headers: {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-GB,en;q=0.9,en-US;q=0.8,et;q=0.7',
      'sec-ch-ua': '"Chromium";v="124", "Microsoft Edge";v="124", "Not-A.Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'x-requested-with': 'XMLHttpRequest',
    },
    referrer: 'https://tahvel.edu.ee/',
    referrerPolicy: 'strict-origin-when-cross-origin',
    body: null,
    method: 'GET',
    mode: 'cors',
    credentials: 'include',
  }).then(r => r.json());
  data.content.forEach(g => (groups[g.code] = g.id));
  localStorage.setItem('us_groupsMap', JSON.stringify(groups));
  groupsMap = groups;
  reverseGroupsMap = Object.fromEntries(Object.entries(groupsMap).map(([key, value]) => [value, key]));
  console.log('Grupid uuendatud');
}

function updatePracticeReport(groupId) {
  return new Promise(async (resolve, reject) => {
    const localStorageKey = `us_praktikaaruanne_${groupId}`;
    const students = {};
    const contractJournalsRequestQueue = [];

    const data = await getJson('https://tahvel.edu.ee/hois_back/practiceJournals?size=50&studentGroup=' + groupId);
    data.content.forEach(contractJournal => {
      if (!students[contractJournal.student.id]) {
        students[contractJournal.student.id] = {
          name: contractJournal.student.nameEt,
          group: contractJournal.studentGroup,
          totalHours: 0,
          maxHours: 0,
          totalDiaryEntries: 0,
          supervisorComments: 0,
          teacherComments: 0,
          totalCharsInDescription: 0,
          hoursOnWeekdays: [0, 0, 0, 0, 0, 0, 0],
          contracts: {},
          companiesString: '',
          firstContractStartDate: null,
          lastContractEndDate: null,
          completedContracts: 0,
          inProgressContracts: 0,
          studentEvalTotal: 0,
          studentEvalFilled: 0,
          studentEvalWorst: 0,
          studentEvalComments: '',
          supervisorEvalTotal: 0,
          supervisorEvalFilled: 0,
          supervisorEvalWorst: 0,
          supervisorEvalComments: '',
          lastTahvelUpdate: new Date().toISOString(),
        };
      }

      students[contractJournal.student.id].contracts[contractJournal.id] = {
        id: contractJournal.id,
        studentEvalTotal: 0,
        studentEvalFilled: 0,
        studentEvalWorst: 0,
        studentEvalComment: '',
        supervisorEvalTotal: 0,
        supervisorEvalFilled: 0,
        supervisorEvalWorst: 0,
        supervisorEvalComment: '',
        totalHours: 0,
        maxHours: 0,
        totalDiaryEntries: 0,
        supervisorComments: 0,
        teacherComments: 0,
        totalCharsInDescription: 0,
        hoursOnWeekdays: [0, 0, 0, 0, 0, 0, 0],
      };

      contractJournalsRequestQueue.push({ studentId: contractJournal.student.id, contractJournalId: contractJournal.id });
    });

    // I don't want to spam the server with requests, so I'll do them with a delay
    let contractsJournalsRequestsQueueInterval = setInterval(() => {
      if (contractJournalsRequestQueue.length === 0) {
        clearInterval(contractsJournalsRequestsQueueInterval);
        console.log('Done with ' + groupId + ' ' + reverseGroupsMap[groupId], students);
        localStorage.setItem(localStorageKey, JSON.stringify(students));
        resolve(students);
        return;
      }

      const { studentId, contractJournalId } = contractJournalsRequestQueue.shift();
      getJson('https://tahvel.edu.ee/hois_back/practiceJournals/' + contractJournalId).then(data => {
        const contract = students[studentId].contracts[contractJournalId];

        if (!data.contract || !data.contract.startDate) {
          console.log('invalid contract data', data);
        }

        contract.startDate = data.contract.startDate;
        contract.endDate = data.contract.endDate;
        contract.status = data.contract.status;
        contract.companyName = data.contract.enterprise.nameEt;
        contract.companiesString += data.contract.enterprise.nameEt + ', ';
        contract.supervisor = data.contract.supervisors?.[0];
        contract.plannedHours = data.contract.moduleSubjects.reduce((acc, subject) => acc + subject.hours, 0);

        let startDate = new Date(data.contract.startDate);
        let endDate = new Date(data.contract.endDate);
        // get max weekdays between start and end date then multiply by 8 to get max hours
        contract.maxHours = Math.round(((endDate - startDate) / (1000 * 60 * 60 * 24) / 7) * 5 * 8);
        students[studentId].maxHours += contract.maxHours;
        if (
          students[studentId].firstContractStartDate === null ||
          startDate < new Date(students[studentId].firstContractStartDate)
        ) {
          students[studentId].firstContractStartDate = startDate.toISOString();
        }
        if (
          students[studentId].lastContractEndDate === null ||
          endDate > new Date(students[studentId].lastContractEndDate)
        ) {
          students[studentId].lastContractEndDate = endDate.toISOString();
        }
        if (data.contract.status === 'LEPING_STAATUS_L') {
          students[studentId].completedContracts++;
        }
        if (data.contract.status === 'LEPING_STAATUS_K') {
          students[studentId].inProgressContracts++;
        }

        data.studentPracticeEvalCriteria.forEach(criteria => {
          if (criteria.grade !== null && criteria.type === 'PRAKTIKA_KRITEERIUM_N') {
            let grade = parseInt(criteria.grade);
            contract.studentEvalTotal += grade;
            contract.studentEvalFilled++;
            contract.studentEvalWorst = Math.min(contract.studentEvalWorst, grade);
            students[studentId].studentEvalTotal += grade;
            students[studentId].studentEvalFilled++;
            students[studentId].studentEvalWorst = Math.min(students[studentId].studentEvalWorst, grade);
          } else if (criteria.type === 'PRAKTIKA_KRITEERIUM_T') {
            let cleanedText =
              criteria.valueTxt?.replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/ +/g, ' ') ?? '';
            contract.studentEvalComment = cleanedText;
            students[studentId].studentEvalComments += cleanedText + '::';
          }
        });
        data.supervisorPracticeEvalCriteria.forEach(criteria => {
          if (criteria.grade !== null && criteria.type === 'PRAKTIKA_KRITEERIUM_N') {
            let grade = parseInt(criteria.grade);
            contract.supervisorEvalTotal += grade;
            contract.supervisorEvalFilled++;
            contract.supervisorEvalWorst = Math.min(contract.supervisorEvalWorst, grade);
            students[studentId].supervisorEvalTotal += grade;
            students[studentId].supervisorEvalFilled++;
            students[studentId].supervisorEvalWorst = Math.min(students[studentId].supervisorEvalWorst, grade);
          } else if (criteria.type === 'PRAKTIKA_KRITEERIUM_T') {
            let cleanedText =
              criteria.valueTxt?.replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/ +/g, ' ') ?? '';
            contract.supervisorEvalComment = cleanedText;
            students[studentId].supervisorEvalComments += cleanedText + '::';
          }
        });
        data.practiceJournalEntries.forEach(entry => {
          let hours = entry.hours / 60; // field contains minutes instead of hours
          contract.totalDiaryEntries++;
          students[studentId].totalDiaryEntries++;
          contract.totalHours += hours;
          students[studentId].totalHours += hours;
          contract.supervisorComments += entry.supervisorComment ? 1 : 0;
          students[studentId].supervisorComments += entry.supervisorComment ? 1 : 0;
          contract.teacherComments += entry.teacherComment ? 1 : 0;
          students[studentId].teacherComments += entry.teacherComment ? 1 : 0;
          contract.totalCharsInDescription += entry.description?.length ?? 0;
          students[studentId].totalCharsInDescription += entry.description?.length ?? 0;
          let date = new Date(entry.practiceDate);
          contract.hoursOnWeekdays[date.getDay()] += hours;
          students[studentId].hoursOnWeekdays[date.getDay()] += hours;
        });
      });
    }, 500);
  });
}

/**
 *
 * @param {string} date E.g. 2024-09-01T00:00:00.000Z
 * @returns
 */
function importOvertimeStudents(date) {
  // https://tahvel.edu.ee/hois_back/reports/students?isHigher=false&lang=ET&page=0&size=50&sort=p.lastname,p.firstname,asc
  let query = new URLSearchParams();
  query.set('isHigher', 'false');
  query.set('fullname', 'false');
  query.set('nominalStudyEndThru', date);
  query.set('lang', 'ET');
  query.set('page', '0');
  query.set('size', '250');
  query.set('status', 'OPPURSTAATUS_O');
  query.set('sort', 'lastname,firstname');

  return importStudents(query);
}

function importStudentsByGroup(groupId) {
  let query = new URLSearchParams();
  query.set('fullname', 'false');
  query.set('lang', 'ET');
  query.set('resultType', 'STUDENT_DATA_ACTIVE');
  query.set('page', '0');
  query.set('size', '50');
  query.set('sort', 'lastname,firstname');
  query.set('studentGroups', groupId);

  return importStudents(query);
}

function importStudents(query) {
  return new Promise(async (resolve, reject) => {
    pinToStudentId = JSON.parse(localStorage.getItem('pinToStudentId')) ?? {};
    pinToStudentGroup = JSON.parse(localStorage.getItem('pinToStudentGroup')) ?? {};
    overtimeStudentsPins = JSON.parse(localStorage.getItem('overtimeStudentsPins')) ?? [];
    let data = await getJson('https://tahvel.edu.ee/hois_back/reports/students/data?' + query.toString());
    //console.log(data);
    let students = data.content.map(s => {
      pinToStudentId[s.idcode.toString()] = s.studentId;
      pinToStudentGroup[s.idcode.toString()] = reverseGroupsMap[s.studentGroups.id];
      const overTime = new Date(s.nominalStudyEnd) < new Date();
      if (overTime) {
        overtimeStudentsPins.push(s.idcode.toString());
      }
      return {
        tahvelId: s.studentId,
        //name: s.fullname,
        firstName: s.firstname,
        lastName: s.lastname,
        studentGroup: reverseGroupsMap[s.studentGroups.id],
        studentGroupTahvelId: s.studentGroups.id,
        pin: s.idcode.toString(),
        officialEmail: s.officialEmail,
        personalEmail: s.personalEmail,
        ehisCode: s.ehisCode,
        curriculumPercentage: s.curriculumPercentage,
        studyStart: s.studyStart,
        nominalStudyEnd: s.nominalStudyEnd,
        immatDate: s.immatDate,
        finishedDate: s.finishedDate,
      };
    });
    localStorage.setItem('pinToStudentId', JSON.stringify(pinToStudentId));
    localStorage.setItem('pinToStudentGroup', JSON.stringify(pinToStudentGroup));

    localStorageStudents = JSON.parse(localStorage.getItem('students')) ?? {};
    students.forEach(async student => {
      let gradesData = await getStudentFinalGrades(student.tahvelId);
      student = { ...student, ...gradesData };
      // Save to localStorage
      //localStorage.setItem("student_" + student.pin, JSON.stringify(student));
      localStorageStudents[student.pin] = student;
      // Save to Azure Cosmos DB using API
      fetch('http://localhost:3000/students/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student),
      })
        .then(response => {
          if (response.ok) {
            console.log(student.studentGroup + ' Student saved successfully');
          } else {
            console.error('Failed to save student');
          }
        })
        .catch(error => {
          console.error(error);
          reject(error);
        });
    });

    localStorage.setItem('students', JSON.stringify(localStorageStudents));
    localStorage.setItem('group_' + query.get('studentGroups'), JSON.stringify(data));
    localStorage.setItem(
      'group_student_pins_' + query.get('studentGroups'),
      JSON.stringify(data.content.map(s => s.idcode.toString()))
    );
    resolve(data);
  });
}

async function getStudentFinalGrades(studentId) {
  //tahvel??
  // todo tahevel gtr rühmajuhataja aruanne tuleks siis kui on meil veel õppiv õpilane, muul juhul võtaks selle lõpphinded ainult?

  // grades, if gtr doesn't work anymore, see töötab küll, vaja lihtsalt id-d sisestada ja curriculumi kood ära võtta
  let data = await getJson(
    `https://tahvel.edu.ee/hois_back/students/${studentId}/vocationalResultsByTime?sort=kp+desc,+my_theme`
  );
  //console.log(data);
  /** @var {Student} student */
  let student = { grades: [], negativeFinalGrades: 0, lastTahvelGtrUpdate: new Date().toISOString() };
  data.forEach(gradeEntry => {
    // Take only "lõpphinne" and the grade is not for "lõputöö" or "lõpueksam"
    if (
      gradeEntry.entryType === 'SISSEKANNE_L' &&
      !['lõputöö', 'lõpueksam'].some(word => gradeEntry.name?.nameEt?.toLowerCase().includes(word))
    ) {
      let grade = gradeEntry.grade?.code?.split('_')?.[1] ?? '';
      student.grades.push([gradeEntry.journalName, gradeEntry.date, gradeEntry.teachers, grade, '']);
      student.totalFinalGrades = (student.totalFinalGrades ?? 0) + 1;
      if (['', '0', '1', '2', 'X', 'MA'].includes(grade)) {
        student.negativeFinalGrades++;
      }
    }
  });
  student.practiceGrade = data
    .filter(r => r.name?.nameEt?.toLowerCase().includes('praktika') && r.isModule)
    .map(r => r.grade?.code?.split('_')?.[1] ?? '')
    .join(',');
  student.thesisGrade = data
    .filter(
      r =>
        (r.name?.nameEt?.toLowerCase().includes('lõputöö') || r.name?.nameEt?.toLowerCase().includes('lõpueksam')) &&
        r.isModule
    )
    .map(r => r.grade?.code?.split('_')?.[1] ?? '')
    .join(',');
  return student;
}

function getJson(url) {
  return fetch(url, {
    headers: {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-GB,en;q=0.9,en-US;q=0.8,et;q=0.7',
      'sec-ch-ua': '"Chromium";v="124", "Microsoft Edge";v="124", "Not-A.Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'x-requested-with': 'XMLHttpRequest',
    },
    referrer: 'https://tahvel.edu.ee/',
    referrerPolicy: 'strict-origin-when-cross-origin',
    body: null,
    method: 'GET',
    mode: 'cors',
    credentials: 'include',
  }).then(r => r.json());
}
