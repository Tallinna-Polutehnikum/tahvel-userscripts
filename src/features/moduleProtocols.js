console.log = GM_log;

let groupsMap = JSON.parse(localStorage.getItem("us_groupsMap")) || {};

// TODO selle võiks saada ka päringuga kusagilt, vaata curriculumVersion endpointe
const groupToCurriculum = {
    "TA-20E": 3127,
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

    //unsafeWindow.
})();

async function getGroupProtocols(group) {
    let groupProtocols = await getJson(`https://tahvel.edu.ee/hois_back/moduleProtocols?isVocational=true&curriculumVersion=${groupToCurriculum[group]}&lang=ET&page=0&size=50&studentGroup=${groupsMap[group]}`)
    let groupModules = await getJson(`https://tahvel.edu.ee/hois_back/moduleProtocols/occupationModules/${groupToCurriculum[group]}`)

    // missing modules
    let missingModules = groupModules.filter(module => !groupProtocols.some(protocol => protocol.module === module.id));
    console.log(`Puuduolevad moodulid: ${missingModules.length}`);
    console.log(missingModules.map(module => module.name).join("\n"));
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