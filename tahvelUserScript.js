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

    // Wait for the Angular app to finish loading
    let journalTableWaitCount = 0;
    function waitForJournalTable() {
        // get journal table row count, if less than 2, then wait
        const journalTableRows = document.querySelectorAll('.journalTable tr');
        if (journalTableRows?.length > 2) {
            console.log("In journal, add average grade column")
            addAverageGradeColumn();
        } else {
            // Angular app is not ready, wait and check again
            setTimeout(waitForJournalTable, 200);
            journalTableWaitCount++;
            if (journalTableWaitCount % 10 === 0) {
                console.log("still waiting for journal table", journalTableWaitCount)
            }
        }
    }

    // If url contains "journal", add the average grade column
    if (window.location.href.indexOf("journal") > -1) {
        waitForJournalTable();
    }
})();