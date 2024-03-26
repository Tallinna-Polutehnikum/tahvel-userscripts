// ==UserScript==
// @name         Tahvel Customization
// @namespace    https://tahvel.edu.ee/
// @version      1.0
// @description  Tahvlile mõned UI täiendused, mis teevad hindamise kiiremaks ja mugavamaks.
// @author       Timo Triisa
// @match        https://tahvel.edu.ee/*
// @grant GM_log
// ==/UserScript==

// Features:
// - Päevikus näeb õpilase keskmist hinnet
// - Päevikus tuleb rida mille peal hiir on rohkem esile
// - TODO Päevikus saab peita õpilaste hinnete ajaloo
// - TODO Päevikus saab hinde peale klikkides ühe hinde ära muuta

console.log = GM_log;

(function () {
    'use strict';
    console.log("Tahvel Customization script started");

    //#region Entry point to scripts and MutationObserver config

    // Trigger when Angular app changes content
    observeTargetChange(document.body, () => {
        // Add average grade column to journal
        if (window.location.href.indexOf("journal") > -1) {
            const journalTableRows = document.querySelectorAll('.journalTable tr');
            if (journalTableRows?.length > 2 && !isAlreadyApplied(journalTableRows[1])) {
                console.log("In journal, add average grade column")
                addAverageGradeColumn();
                addAppliedMarker(journalTableRows[1]);
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
            let groupSelect = document.querySelector(`md-autocomplete[md-floating-label="Õpperühm"] input`);
            if (groupSelect && !isAlreadyApplied(groupSelect)) {
                console.log("In Rühmajuhendaja aruanne, update parameters after group selection")
                groupSelect.addEventListener("change", updateRJAParameters);
                addAppliedMarker(groupSelect);
            }
        }
    });

    function observeTargetChange(targetNode, callback) {
        const observer = new MutationObserver((mutationsList, observer) => {
            for(let mutation of mutationsList) {
                if(mutation.type === 'childList' && mutation.addedNodes.length > 0) {
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
            const lastGrade = grade.trim().split('/').pop().trim();
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

function simulateTyping(inputElement, text, latency, interResponseTime) {
    let currentIndex = 0;
    const textLength = text.length;

    function insertCharacter(char) {
        inputElement.value += char;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function typeCharacter() {
        insertCharacter(text[currentIndex]);
        if (currentIndex < textLength - 1) {
            currentIndex++;
            setTimeout(typeCharacter, interResponseTime);
        }
    }

    setTimeout(() => {
        typeCharacter();
    }, latency);
}
