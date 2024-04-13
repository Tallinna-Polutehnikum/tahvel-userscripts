// ==UserScript==
// @name         Täiendatud Tahvel Õpetajale
// @namespace    https://tahvel.edu.ee/
// @version      1.0.0
// @description  Tahvlile mõned UI täiendused, mis parandavad tundide sisestamist ja hindamist.
// @author       Timo Triisa
// @match        https://tahvel.edu.ee/*
// @downloadURL  https://raw.githubusercontent.com/Tallinna-Polutehnikum/tahvel-userscripts/main/teachers.js
// @grant GM_log
// ==/UserScript==

// Features:
// - Päevikus näeb õpilase keskmist hinnet
// - Päevikus näitab aktiivset rida paksema piirjoonega
// - Õpilaste nimekirjas näitab õpilase vanust isikukoodi kõrval
// - Rühmajuhendaja aruandes täidab õppeaasta ja kuupäeva vastvalt rühma koodile automaatselt
// - TODO Päevikus saab peita õpilaste hinnete ajaloo
// - TODO Päevikus saab hinde peale klikkides ühe hinde ära muuta

console.log = GM_log;

(function () {
    'use strict';
    console.log("Tahvel Customization script started");

    //#region Angular hooking WIP
    /*setTimeout(() => {

    // Hook into AngularJS to get notified when the app changes content
    const angular = unsafeWindow.angular;
    if (!angular) return;

    let $injector = angular.element(document.getElementsByTagName("body")).injector()
    console.log("injector", $injector)
    let Menu = $injector.get("Menu")
    console.log("Menu", Menu)
    
    } , 5000)*/

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = `
    /* Hinnete dropdown oleks pikem*/
    md-select-menu, md-select-menu md-content {
            max-height: 300px;
        }
    `;
    document.head.appendChild(style);

    //#region Entry point to scripts and MutationObserver config

    // Trigger when Angular app changes content
    observeTargetChange(document.body, () => {
        // Add average grade column and entry tooltips to journal
        if (window.location.href.indexOf("journal") > -1) {
            const journalTableRows = document.querySelectorAll('.journalTable tr');
            if (journalTableRows?.length > 2 && !isAlreadyApplied(journalTableRows[1])) {
                console.log("In journal, add average grade column")
                addAverageGradeColumn();
                journalEntryTooltips();
                addAppliedMarker(journalTableRows[1]);
            }

            // Journal edit popup
            // Add listener to homework description input and entryType
            let homeworkDesc = document.querySelector("[ng-model='journalEntry.homework']");
            if (homeworkDesc && !isAlreadyApplied(homeworkDesc)) {
                console.log("In journal edit, add homework description listener")
                journalEntryNotifyStudent(homeworkDesc);
            }
            // Add batch absent button
            let batchGrade = document.querySelector("md-dialog-content table tbody tr i");
            if (batchGrade && batchGrade.textContent.includes("Hinde korraga") && !isAlreadyApplied(batchGrade)) {
                journalEntryBatchAbsent(batchGrade);
                addAppliedMarker(batchGrade);
            }
        }

        // Append age to PIN in student list view
        if (window.location.href.indexOf("students") > -1) {
            let table = document.querySelector(".md-table");
            let marker = document.querySelector(".md-table tbody > tr > td:nth-child(1)")
            if (table && !isAlreadyApplied(marker)) {
                //observeTargetChange(document.querySelector(".md-table"), appendAgeToPin);
                console.log("In students, append age to PIN")
                appendAgeToPin();
                addAppliedMarker(marker);
            }
        }

        // Update Rühmajuhendaja aruanne parameters after group selection
        if (window.location.href.indexOf("reports/studentgroupteacher") > -1) {
            let groupSelect = document.querySelector(`md-autocomplete[md-floating-label="Õpperühm"] input, md-select[ng-model="formState.studentGroup"]`);
            if (groupSelect && !isAlreadyApplied(groupSelect)) {
                console.log("In Rühmajuhendaja aruanne, update parameters after group selection")
                groupSelect.addEventListener("change", updateRJAParameters);
                addAppliedMarker(groupSelect);
            }
        }
    });

    function observeTargetChange(targetNode, callback) {
        const observer = new MutationObserver((mutationsList, observer) => {
            for (let mutation of mutationsList) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Pause the observer to avoid userscript changes triggering the observer again
                    observer.disconnect();

                    callback();

                    // Resume observing
                    observer.observe(targetNode, { childList: true, subtree: true });
                    return;
                }
            }
        });
        observer.observe(targetNode, { childList: true, subtree: true });
        return observer;
    }

    function addAppliedMarker(element) {
        if (!element) return;
        element.dataset.userscriptApplied = true;
    }
    function isAlreadyApplied(element) {
        if (!element) return false;
        return element.dataset.userscriptApplied === "true";
    }
    //#endregion

    //#region Average grade column in journal
    const gradePalette = {
        5: '#b3ffb3',  // Light green
        4: '#b3ffb3',  // Light green
        3: '#ffffb3',  // Light yellow
        2: '#ffb3b3',  // Light red
        1: '#ffb3b3',  // Light red
        0: '#ffb3b3',  // Light red
    };
    // Function to calculate the average grade
    function calculateAverageGrade(grades) {
        let total = 0;
        let count = 0;

        // Loop through each grade
        grades.forEach(grade => {
            let lastGrade = grade.trim().split('/').pop().trim();
            if (lastGrade === 'MA' || lastGrade === "X")
                lastGrade = '0';
            const parsedGrade = parseFloat(lastGrade);

            // Check if parsing was successful
            if (!isNaN(parsedGrade)) {
                total += parsedGrade;
                count++;
            }
        });

        // Calculate the average grade with 1 decimal place
        const averageGrade = count > 0 ? (total / count).toFixed(1) : '2.0';

        return [averageGrade, total];
    }

    // Function to add the narrow column
    function addAverageGradeColumn() {
        // Find the table header cells containing the word "Hindamine" or "Tund"
        const tableHeaders = document.querySelectorAll('.journalTable th > div[aria-label*="Tund"], .journalTable th > div[aria-label*="Hindamine"]');
        // Or use your own name to get all the columns that can contain grades
        // const tableHeaders = document.querySelectorAll('.journalTable th > div[aria-label*="Timo Triisa"]');

        // Get the index of each grade column
        const gradeColumnIndices = Array.from(tableHeaders).map(header => {
            const columnIndex = Array.from(header.parentNode.parentNode.children).indexOf(header.parentNode);
            return columnIndex;
        });

        // Get all the rows in the table
        const rows = document.querySelectorAll('.journalTable tr');
        let bestTotalScore = 0;
        let totalColumnsAndScores = []; // tuple of [td DOM, totalScore]

        // Loop through each row
        rows.forEach((row, rowIndex) => {
            // Skip the header row
            if (rowIndex === 0) return;

            // if mouse hover over the row, then change border color to thicker 2-3px
            row.addEventListener('mouseover', function () {
                this.style.outline = '2px solid #000';
                this.style.outlineOffset = '-2px';
            });
            row.addEventListener('mouseout', function () {
                this.style.outline = 'unset';
            });

            let grades = [];

            // Extract the grades for the current row
            gradeColumnIndices.forEach(columnIndex => {
                const gradeCell = row.querySelectorAll('td')[columnIndex];
                const gradeText = gradeCell.textContent.trim();
                grades.push(gradeText);
            });

            // Calculate the average grade
            const [averageGrade, totalScore] = calculateAverageGrade(grades);
            if (totalScore > bestTotalScore) {
                bestTotalScore = totalScore;
            }

            // Create the narrow column cell for average grade
            const narrowColumnCell = document.createElement('td');
            narrowColumnCell.style.width = '20px'; // Set the width of the narrow column
            narrowColumnCell.style.padding = '0 2px';
            narrowColumnCell.textContent = averageGrade;
            // set the title to first column text before comma
            narrowColumnCell.title = row.querySelectorAll('td')?.[1]?.textContent.split(',')?.[0]?.trim() ?? '';

            // Set the background color based on the grade
            narrowColumnCell.style.backgroundColor = gradePalette[parseInt(averageGrade)] || '#fff';

            // Append the narrow column cell to the row
            row.appendChild(narrowColumnCell);

            // Create the narrow column cell for total score
            const totalColumn = document.createElement('td');
            totalColumn.style.width = '20px'; // Set the width of the narrow column
            totalColumn.style.padding = '0 2px';
            totalColumn.textContent = totalScore;
            // set the title to first column text before comma
            totalColumn.title = row.querySelectorAll('td')?.[1]?.textContent.split(',')?.[0]?.trim() ?? '';

            totalColumnsAndScores.push([totalColumn, totalScore]);

            // Append the narrow column cell to the row
            row.appendChild(totalColumn);
        });

        // Find the second best total score
        const secondBestTotalScore = totalColumnsAndScores
            .map(([totalColumn, totalScore]) => totalScore)
            .sort((a, b) => b - a)[1];

        totalColumnsAndScores.forEach(([totalColumn, totalScore]) => {
            // Normalize single totalScore related to bestTotalScore
            const normalizedTotalScore = totalScore / secondBestTotalScore;
            // Make color from green to white to red based on normalizedTotalScore
            // 179, 255, 179
            // 255, 179, 179
            let color = "";
            if (normalizedTotalScore > 0.6)
                color = `rgb(${255 - normalizedTotalScore * 76}, 255, ${255 - normalizedTotalScore * 76})`;
            else
                color = `rgb(255, ${255 - normalizedTotalScore * 76}, ${255 - normalizedTotalScore * 76})`;

            // Set the background color based on the grade
            totalColumn.style.backgroundColor = color || '#fff';
        });
    }
    //#endregion

    //#region Päevikus hiirega kuupäeva peale liikumine näitab tunni kirjeldust
    function journalEntryTooltips() {
        let journalId = window.location.href.match(/journal\/(\d+)/)[1];
        if (!journalId) {
            return;
        }
        let entryDOMs = document.querySelectorAll(`[ng-click="editJournalEntry(journalEntry.id)"]`);
        if (entryDOMs.length === 0) {
            return;
        }

        // TODO cached fetch to avoid multiple requests during re-renders
        fetch(`https://tahvel.edu.ee/hois_back/journals/${journalId}/journalEntry?lang=ET&page=0&size=100`, {
            "headers": {
                "accept": "application/json, text/plain, */*",
                "accept-language": "en-US,en;q=0.9",
                "sec-ch-ua": "\"Chromium\";v=\"122\", \"Not(A:Brand\";v=\"24\", \"Microsoft Edge\";v=\"122\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "x-requested-with": "XMLHttpRequest"
            },
            "referrer": "https://tahvel.edu.ee/",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": null,
            "method": "GET",
            "mode": "cors",
            "credentials": "include"
        }).then(r => r.json()).then(entries => {
            if (entries.content[entries.content.length - 1].entryType === "SISSEKANNE_L") {
                entries.content.unshift(entries.content.pop());
            }
            entries.content.forEach((entry, index) => {
                let el = entryDOMs[entryDOMs.length - 1 - index];
                let tooltipContent = `<b>${entry.nameEt}</b><br>${entry.content?.replaceAll("\n", "<br>") ?? ""}`;
                if (entry.homework) {
                    let duedate = entry.homeworkDuedate ? new Date(entry.homeworkDuedate).toLocaleDateString('et') : "";
                    tooltipContent += `<br><br><b>Kodutöö ${duedate}</b><br><br>${entry.homework?.replaceAll("\n", "<br>") ?? ""}`;
                }
                let tooltip = createTooltip(el, tooltipContent);
                el.addEventListener('mousemove', (event) => {
                    tooltip.style.display = 'block';
                    tooltip.style.top = event.clientY + 20 + window.scrollY + 'px';
                    tooltip.style.left = event.clientX - el.getBoundingClientRect().width / 2 + 'px';
                });
                el.addEventListener('mouseout', () => {
                    if (tooltip.style.display === 'block')
                        tooltip.style.display = 'none';
                });

            });
        }).catch(e => console.log(e));

        function createTooltip(element, content) {
            let clone;
            if (content === undefined) {
                clone = element.cloneNode(true);
            } else {
                clone = document.createElement('div');
                clone.innerHTML = content;
            }
            clone.style.display = 'none';
            clone.style.position = 'absolute';
            clone.style.zIndex = 1000;
            clone.style.backgroundColor = 'white';
            clone.style.padding = '5px';
            clone.style.maxWidth = '500px';
            clone.style.pointerEvents = 'none';
            document.body.appendChild(clone);
            return clone;
        }
    }
    //#endregion

    //#region Päeviku kandes õpilase teavitamine kodutööst
    function journalEntryNotifyStudent(homeworkDesc) {
        let isTestCheckbox = document.querySelector("[ng-model='journalEntry.isTest']");
        homeworkDesc.addEventListener("input", () => {
            if (isTestCheckbox.getAttribute("aria-checked") === (homeworkDesc.value.trim().length > 0 ? "false" : "true")) {
                isTestCheckbox.click();
            }
        });
        addAppliedMarker(homeworkDesc);

        let entryTypeOptions = document.querySelectorAll(`[value^="SISSEKANNE_"]`);
        entryTypeOptions.forEach(option => {
            option.addEventListener("click", () => {
                let hasHomeworkDescription = homeworkDesc.value.trim().length > 0;
                if (isTestCheckbox.getAttribute("aria-checked") === ((option.value === "SISSEKANNE_H" || hasHomeworkDescription) ? "false" : "true")) {
                    isTestCheckbox.click();
                }
            });
        });
    }
    //#endregion

    //#region Päeviku kandes puudumiste korraga märkimine
    function journalEntryBatchAbsent(siblingContainer) {
        let batchAbsent = document.createElement("a");
        batchAbsent.href = "#";
        batchAbsent.textContent = "Märgi kõik puudujaks";
        batchAbsent.style.color = "blue";
        batchAbsent.style.cursor = "pointer";

        batchAbsent.addEventListener("click", (event) => {
            event.preventDefault();
            let absentCheckboxes = [...document.querySelectorAll(`[ng-model="journalEntryStudents[row.id].withoutReason"]`)];
            let allChecked = absentCheckboxes.every(checkbox => checkbox.getAttribute("aria-checked") === "true");
            absentCheckboxes.forEach(checkbox => {
                if (checkbox.getAttribute("aria-checked") === (allChecked ? "true" : "false")) {
                    checkbox.click();
                }
            });
            // Update the button text just for the clarity. But query DOM again, because some checkboxes get removed when students are excused
            absentCheckboxes = [...document.querySelectorAll(`[ng-model="journalEntryStudents[row.id].withoutReason"]`)];
            allChecked = absentCheckboxes.every(checkbox => checkbox.getAttribute("aria-checked") === "true");
            batchAbsent.textContent = allChecked ? "Märgi kõik kohalolijaks" : "Märgi kõik puudujaks";
        });

        siblingContainer.parentElement.appendChild(document.createElement("br"));
        siblingContainer.parentElement.appendChild(batchAbsent);
    }
    //#endregion

    //#region Student list and detail view enhancements
    function calculateAgeFromPin(pin) {
        // pin is in format 39210050229 (SYYMMDDNNNC), S is century and sex, 3 is 20th century male, 4 is 20st century female, 5 is 21st century
        const century = parseInt(pin.substring(0, 1));
        const year = parseInt(pin.substring(1, 3));
        const month = parseInt(pin.substring(3, 5));
        const day = parseInt(pin.substring(5, 7));

        const baseYear = century === 3 || century === 4 ? 1900 : 2000;
        const birthDate = new Date(baseYear + year, month - 1, day);
        const ageDifMs = Date.now() - birthDate.getTime();
        const ageDate = new Date(ageDifMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    }

    function appendAgeToPin() {
        let elements = [];

        // Students list view table
        let columnHeader = document.querySelector("[md-order-by='person.idcode']");
        if (columnHeader) {
            let columnNumber = Array.from(columnHeader.parentElement.children).indexOf(columnHeader);
            elements = Array.from(columnHeader.parentElement.parentElement.parentElement.querySelectorAll("tbody > tr > td:nth-child(" + (columnNumber + 1) + ")"));
        }

        elements.forEach(element => {
            const pin = element.textContent;
            const age = calculateAgeFromPin(pin);
            // if age is less than 18 make the span bold
            element.innerHTML = `${pin} <span style="font-weight: ${age < 18 ? 'bold' : 'normal'}">(${age})</span>`;
        });
    }
    //#endregion

    //#region Rühmajuhendaja aruanne
    function updateRJAParameters(event) {
        let group = event.target.value;
        //document.querySelector(`[ng-click="toggleShowAllParameters()"]`).click();

        // get the year number from group and set the date to 1 of august of that year
        let year = parseInt(group.match(/\d+/)[0]) + 2000
        let date = new Date(year, 7, 1)

        // checkboxes in order, 1 for checked, 0 for unchecked
        let rjaEntryTypes = [0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]
        // loop to remove checkmarks from disabled checkboxes after they are enabled from the previous run
        for (let i = 0; i < 4; i++) {
            document.querySelectorAll(`[ng-show="formState.showAllParameters"] md-checkbox`).forEach((input, index) => {
                let inputState = input.getAttribute("aria-checked") === "true" ? 1 : 0
                if (inputState ^ rjaEntryTypes[index])
                    input.click()
            })
        }

        let dateInput = document.querySelector(`[ng-model="criteria.from"] input`)
        dateInput.click();
        dateInput.value = ""
        let startDate = date.toLocaleDateString('et', { day: '2-digit', month: '2-digit', year: 'numeric' })
        simulateTyping(dateInput, startDate, 10, 10);


        document.querySelector(`[aria-label="{{'report.studentGroupTeacher.studyYear' | translate}}"] md-option`).click()
        setTimeout(() => {
            document.querySelector(`[aria-label="{{'report.studentGroupTeacher.studyYear' | translate}}"] md-option`).click()
        }, 50)
    }
    //#endregion
})();

const groupDuration = {
    "AA": 2.8062970568104038,
    "AV": 2.8145106091718,
    "EA": 2.8062970568104038,
    "EV": 2.8145106091718,
    "FS": 1.4757015742642026,
    "IT": 3.805612594113621,
    "KEE": 1.754962354551677,
    "KEV": 1.754962354551677,
    "KIT": 1.754962354551677,
    "KJE5": 0.4134154688569473,
    "KLT": 2.2587268993839835,
    "KMS": 1.754962354551677,
    "KSE5": 0.7008898015058179,
    "KTA": 1.754962354551677,
    "KTO": 0.758384668035592,
    "KTS": 1.754962354551677,
    "KV": 0.6789869952087612,
    "LA": 2.8145106091718,
    "MM": 2.8062970568104038,
    "MS": 1.8206707734428473,
    "SA": 2.8062970568104038,
    "TA": 3.805612594113621,
    "TJE": 0.9801505817932923,
    "TO": 1.0075290896646132,
    "TS": 1.8206707734428473,
    "TT": 2.8062970568104038,
    "VM": 2.8062970568104038
}

/**
 * Ma ei tea veel kas teha hardcoded eesliidese järgi pikkused või teha gruppide päringu ajal arvutus ja cacheda see localstorage-sse.
 * https://tahvel.edu.ee/hois_back/autocomplete/studentgroups?lang=ET
 */
function getAllGroupDurations(groups) {
    let durations = {};
    groups.forEach(data => {
        const groupCode = data.nameEt.split("-")[0];

        // Calculate duration in years
        const validFrom = new Date(data.validFrom);
        const validThru = new Date(data.validThru);
        const durationMilliseconds = validThru - validFrom;
        const durationYears = durationMilliseconds / (1000 * 60 * 60 * 24 * 365.25);
        durations[groupCode] = durationYears;
        //allgroups.push({ groupCode, durationYears, data })
    });
    return durations;
}

function simulateTyping(inputElement, text, latency, interResponseTime) {
    inputElement.value = text;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
}

function hook(scope, original, after) {
    return function () {
        original.apply(scope, arguments)
        try {
            after.apply(scope, arguments)
        } catch (e) {
            console.error(e)
        }
    }
}