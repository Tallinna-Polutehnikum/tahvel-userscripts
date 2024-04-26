// ==UserScript==
// @name         Täiendatud Tahvel Praktikaaruanne
// @namespace    https://tahvel.edu.ee/
// @version      1.0.0
// @description  Detailsem praktikate ülevaade
// @author       Timo Triisa
// @match        https://tahvel.edu.ee/*
// @updateURL    https://raw.githubusercontent.com/Tallinna-Polutehnikum/tahvel-userscripts/main/praktikaaruanne.js
// @downloadURL  https://raw.githubusercontent.com/Tallinna-Polutehnikum/tahvel-userscripts/main/praktikaaruanne.js
// @grant GM_log
// ==/UserScript==

console.log = GM_log;

const ContractStatus = {
    "LEPING_STAATUS_K": "Kehtiv",
    "LEPING_STAATUS_T": "Tühistatud",
    "LEPING_STAATUS_L": "Lõpetatud",
    "LEPING_STAATUS_Y": "Ülevaatamisel",
    "LEPING_STAATUS_S": "Koostamisel",
};

(async function () {
    'use strict';
    // TODO full text of description for ChatGPT?

    // TODO students local database: name, isikukood, email, group, missing grades, last update (grades, practice, thesis), practice manual good-to-go, has practice contract int, completed hours, thesis (date, topic, grade, manual good-to-go), etc
    // TODO grades history database: student, subject, grade, date, teacher, etc

    //updateGroupsMap(); // once a year
    //updatePracticeReports("TA-20E TA-20V KTA-22E KTA-22V IT-20E IT-20V KIT-22E KIT-22V SA-21".split(" "));
    //printPracticeReports("TA-20E TA-20V KTA-22E KTA-22V IT-20E IT-20V KIT-22E KIT-22V SA-21".split(" "));
    //updatePracticeReport(3326);
    //printPracticeReport(3326, 'tsv');

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
    }
}

function printPracticeReports(groups, type = "tsv") {
    let result = "";
    for (let group of groups) {
        if (!groupsMap[group]) {
            console.warn(`Group ${group} not found in groupsMap`);
            continue;
        }

        result += printPracticeReport(groupsMap[group], type, false);
    }
    return result;
}

function printPracticeReport(groupId, type = "tsv", addHeader = true) {
    if (typeof groupId === "string") {
        groupId = groupsMap[groupId];
    }

    const localStorageKey = `us_praktikaaruanne_${groupId}`;
    const students = JSON.parse(localStorage.getItem(localStorageKey));
    let sortedStudents = Object.values(students).sort((a, b) => b.totalDiaryEntries - a.totalDiaryEntries);

    if (type === "raw") {
        console.log(sortedStudents);
        return sortedStudents;
    }

    let tableHeader = [
        'name', 'email', 'group', 'maxHours', 'totalHours', 'missingFromMinimum', 'aproxEnd', 'lastContractEndDate', 'firstContractStartDate', 'totalDiaryEntries',
        'supervisorComments', 'teacherComments', 'totalCharsInDescription', 'inProgressContracts', 'hoursOnWeekdays', "", "", "", "", "", "", 'studentEvalFilled', 'studentEvalTotal',
        'studentEvalWorst', 'studentEvalComments', 'supervisorEvalFilled', 'supervisorEvalTotal', 'supervisorEvalWorst', 'supervisorEvalComments', 'companies'
    ];
    if (type === "tsv") {
        let string = addHeader ? tableHeader.join("\t") + "\n" : "";
        for (let student of sortedStudents) {
            //const student = students[studentId];
            string += tableHeader.filter(key => key !== "").map(key => {
                if (key === "missingFromMinimum") {
                    return Math.max(880 - student.totalHours, 0);
                } else if (key === "email") {
                    let nameParts = student.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(" ");
                    let lastName = nameParts.pop();
                    return nameParts.join("") + "." + lastName + "@tptlive.ee";
                } else if (key === "aproxEnd") {
                    let hoursPerDay = student.totalDiaryEntries ? student.totalHours / student.totalDiaryEntries : 0;
                    if (hoursPerDay === 0) return "N/A";
                    let daysLeft = Math.max(0, 880 - student.totalHours) / hoursPerDay / 5 * 7;
                    if (daysLeft === 0) return "Korras";
                    return new Date(new Date().getTime() + daysLeft * 24 * 60 * 60 * 1000).toLocaleDateString('et-EE', { year: 'numeric', month: '2-digit', day: '2-digit' });
                } else if (key === "firstContractStartDate") {
                    return new Date(student[key]).toLocaleDateString('et-EE', { year: 'numeric', month: '2-digit', day: '2-digit' });
                } else if (key === "lastContractEndDate") {
                    return new Date(student[key]).toLocaleDateString('et-EE', { year: 'numeric', month: '2-digit', day: '2-digit' });
                } else if (key === "inProgressContracts") {
                    return (student.completedContracts - student.inProgressContracts) + " / " + (student.completedContracts + student.inProgressContracts);
                } else if (key === "hoursOnWeekdays") {
                    return student[key].join("\t");
                } else if (key === "companies") {
                    return Object.values(student.contracts).filter(c => c.status === "LEPING_STAATUS_K" || c.status === "LEPING_STAATUS_L").map(c => c.companyName).join("\t");
                } else {
                    return student[key];
                }
            }).join("\t") + "\n";
        }
        console.log(string);
        return string;
    }

    if (type === "table") {
        console.table(sortedStudents);
    }
}

let groupsMap = JSON.parse(localStorage.getItem("us_groupsMap")) || {};
let reverseGroupsMap = Object.fromEntries(Object.entries(groupsMap).map(([key, value]) => [value, key]));
async function updateGroupsMap() {
    let groups = {}
    let data = await fetch("https://tahvel.edu.ee/hois_back/studentgroups?isValid=true&lang=ET&size=150", {
        "headers": {
            "accept": "application/json, text/plain, */*",
            "accept-language": "en-GB,en;q=0.9,en-US;q=0.8,et;q=0.7",
            "sec-ch-ua": "\"Chromium\";v=\"124\", \"Microsoft Edge\";v=\"124\", \"Not-A.Brand\";v=\"99\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-requested-with": "XMLHttpRequest",
        },
        "referrer": "https://tahvel.edu.ee/",
        "referrerPolicy": "strict-origin-when-cross-origin",
        "body": null,
        "method": "GET",
        "mode": "cors",
        "credentials": "include"
    }).then(r => r.json())
    data.content.forEach(g => groups[g.code] = g.id);
    localStorage.setItem("us_groupsMap", JSON.stringify(groups));
    groupsMap = groups;
    reverseGroupsMap = Object.fromEntries(Object.entries(groupsMap).map(([key, value]) => [value, key]));
    console.log("Grupid uuendatud");
}

function updatePracticeReport(groupId) {
    return new Promise(async (resolve, reject) => {
        const localStorageKey = `us_praktikaaruanne_${groupId}`;
        const students = {};
        const contractJournalsRequestQueue = [];

        const data = await getJson("https://tahvel.edu.ee/hois_back/practiceJournals?size=50&studentGroup=" + groupId);
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
                    firstContractStartDate: null,
                    lastContractEndDate: null,
                    completedContracts: 0,
                    inProgressContracts: 0,
                    studentEvalTotal: 0,
                    studentEvalFilled: 0,
                    studentEvalWorst: 0,
                    studentEvalComments: "",
                    supervisorEvalTotal: 0,
                    supervisorEvalFilled: 0,
                    supervisorEvalWorst: 0,
                    supervisorEvalComments: "",
                }
            }

            students[contractJournal.student.id].contracts[contractJournal.id] = {
                id: contractJournal.id,
                studentEvalTotal: 0,
                studentEvalFilled: 0,
                studentEvalWorst: 0,
                studentEvalComment: "",
                supervisorEvalTotal: 0,
                supervisorEvalFilled: 0,
                supervisorEvalWorst: 0,
                supervisorEvalComment: "",
                totalHours: 0,
                maxHours: 0,
                totalDiaryEntries: 0,
                supervisorComments: 0,
                teacherComments: 0,
                totalCharsInDescription: 0,
                hoursOnWeekdays: [0, 0, 0, 0, 0, 0, 0],
            };

            contractJournalsRequestQueue.push({
                studentId: contractJournal.student.id,
                contractJournalId: contractJournal.id,
            });
        });

        // I don't want to spam the server with requests, so I'll do them with a delay
        let contractsJournalsRequestsQueueInterval = setInterval(() => {
            if (contractJournalsRequestQueue.length === 0) {
                clearInterval(contractsJournalsRequestsQueueInterval);
                console.log("Done with " + groupId + " " + reverseGroupsMap[groupId], students);
                localStorage.setItem(localStorageKey, JSON.stringify(students));
                resolve(students);
                return;
            }

            const { studentId, contractJournalId } = contractJournalsRequestQueue.shift();
            getJson("https://tahvel.edu.ee/hois_back/practiceJournals/" + contractJournalId).then(data => {
                const contract = students[studentId].contracts[contractJournalId];


                contract.startDate = data.contract.startDate,
                    contract.endDate = data.contract.endDate,
                    contract.status = data.contract.status,
                    contract.companyName = data.contract.enterprise.nameEt,
                    contract.supervisor = data.contract.supervisors?.[0];
                contract.plannedHours = data.contract.moduleSubjects.reduce((acc, subject) => acc + subject.hours, 0);

                let startDate = new Date(data.contract.startDate);
                let endDate = new Date(data.contract.endDate);
                // get max weekdays between start and end date then multiply by 8 to get max hours
                contract.maxHours = (endDate - startDate) / (1000 * 60 * 60 * 24) / 7 * 5 * 8;
                students[studentId].maxHours += contract.maxHours;
                if (students[studentId].firstContractStartDate === null || startDate < new Date(students[studentId].firstContractStartDate)) {
                    students[studentId].firstContractStartDate = startDate.toISOString();
                }
                if (students[studentId].lastContractEndDate === null || endDate > new Date(students[studentId].lastContractEndDate)) {
                    students[studentId].lastContractEndDate = endDate.toISOString();
                }
                if (data.contract.status === "LEPING_STAATUS_L") {
                    students[studentId].completedContracts++;
                }
                if (data.contract.status === "LEPING_STAATUS_K") {
                    students[studentId].inProgressContracts++;
                }

                data.studentPracticeEvalCriteria.forEach(criteria => {
                    if (criteria.grade !== null && criteria.type === "PRAKTIKA_KRITEERIUM_N") {
                        let grade = parseInt(criteria.grade);
                        contract.studentEvalTotal += grade;
                        contract.studentEvalFilled++;
                        contract.studentEvalWorst = Math.min(contract.studentEvalWorst, grade);
                        students[studentId].studentEvalTotal += grade;
                        students[studentId].studentEvalFilled++;
                        students[studentId].studentEvalWorst = Math.min(students[studentId].studentEvalWorst, grade);
                    } else if (criteria.type === "PRAKTIKA_KRITEERIUM_T") {
                        let cleanedText = criteria.valueTxt?.replace(/\t/g, " ").replace(/\n/g, " ").replace(/\r/g, " ").replace(/ +/g, " ") ?? "";
                        contract.studentEvalComment = cleanedText;
                        students[studentId].studentEvalComments += cleanedText + "::";
                    }
                });
                data.supervisorPracticeEvalCriteria.forEach(criteria => {
                    if (criteria.grade !== null && criteria.type === "PRAKTIKA_KRITEERIUM_N") {
                        let grade = parseInt(criteria.grade);
                        contract.supervisorEvalTotal += grade;
                        contract.supervisorEvalFilled++;
                        contract.supervisorEvalWorst = Math.min(contract.supervisorEvalWorst, grade);
                        students[studentId].supervisorEvalTotal += grade;
                        students[studentId].supervisorEvalFilled++;
                        students[studentId].supervisorEvalWorst = Math.min(students[studentId].supervisorEvalWorst, grade);
                    } else if (criteria.type === "PRAKTIKA_KRITEERIUM_T") {
                        let cleanedText = criteria.valueTxt?.replace(/\t/g, " ").replace(/\n/g, " ").replace(/\r/g, " ").replace(/ +/g, " ") ?? "";
                        contract.supervisorEvalComment = cleanedText;
                        students[studentId].supervisorEvalComments += cleanedText + "::";
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

function getJson(url) {
    return fetch(url, {
        "headers": {
            "accept": "application/json, text/plain, */*",
            "accept-language": "en-GB,en;q=0.9,en-US;q=0.8,et;q=0.7",
            "sec-ch-ua": "\"Chromium\";v=\"124\", \"Microsoft Edge\";v=\"124\", \"Not-A.Brand\";v=\"99\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-requested-with": "XMLHttpRequest",
        },
        "referrer": "https://tahvel.edu.ee/",
        "referrerPolicy": "strict-origin-when-cross-origin",
        "body": null,
        "method": "GET",
        "mode": "cors",
        "credentials": "include"
    })
        .then(r => r.json())
}