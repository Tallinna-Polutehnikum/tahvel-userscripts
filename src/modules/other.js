// Features:
// - Tunniplaani ülevaade: korduvad ja üksikud kanded lihtsustatud tabelina
// - Tunniplaanis saab määra vaikefiltri, et näha enda tunde kohe kui tunniplaani avad

console.log = GM_log;

(function () {
  'use strict';
  console.log('Tahvel Customization script started');

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

  //#region Entry point to scripts and MutationObserver config

  // Trigger when Angular app changes content
  observeTargetChange(document.body, () => {
    // Default calendar filter
    const redirectsBasedOnFilter = {
      timetableByGroup: 'generalTimetable/group',
      timetableByTeacher: 'generalTimetable/teacher',
      timetableByRoom: 'generalTimetable/room',
    };
    if (window.location.href.endsWith('timetables')) {
      // Redirect from timeteable page
      let defaultFilterParams = JSON.parse(localStorage.getItem('defaultCalendarFilter'));
      if (defaultFilterParams) {
        const { filterType, schoolId } = defaultFilterParams;
        if (filterType && schoolId && redirectsBasedOnFilter[filterType]) {
          console.log('In timetable, redirect to timetable with filter', redirectsBasedOnFilter[filterType]);
          window.location.href = `/#/timetable/${schoolId}/${redirectsBasedOnFilter[filterType]}`;
        }
      }
    } else if (window.location.href.indexOf('generalTimetable') > -1) {
      // Apply filter
      let filterSelect = document.querySelector("[ng-model='criteria.selectedTimetableId'] input");
      if (filterSelect && !isAlreadyApplied(filterSelect)) {
        let defaultFilterParams = JSON.parse(localStorage.getItem('defaultCalendarFilter'));
        if (defaultFilterParams) {
          const { filterType, filterValue } = defaultFilterParams;
          if (filterType && filterValue && window.location.href.includes(redirectsBasedOnFilter[filterType])) {
            if (filterSelect.value === '') {
              console.log('In timetable, apply default filter');
              filterSelect.dispatchEvent(new Event('focus', { bubbles: true }));
              simulateTyping(filterSelect, filterValue);
            } else {
              document.querySelectorAll(`li[class="md-autocomplete-suggestion"]`).forEach(option => {
                //console.log("option", option.textContent)
                if (option.textContent.trim() === filterValue) {
                  console.log('Applied timetable default filter', filterValue);
                  option.click();
                  addAppliedMarker(filterSelect);
                }
              });
            }
          }
        }
      }

      // Show buttons
      const calendarContainer = document.querySelector('#calendar');
      if (calendarContainer && !isAlreadyApplied(calendarContainer)) {
        console.log('In timetable, add actions');
        addTimetableActions(calendarContainer);
        addAppliedMarker(calendarContainer);
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
    return element.dataset.userscriptApplied === 'true';
  }
  //#endregion

  //#region Tunniplaani ülevaade ja vaikefilter
  function addTimetableActions(calendarContainer) {
    const calendarHeader = calendarContainer.parentElement.querySelector('.layout-align-center-stretch.layout-row');
    calendarHeader.style.alignItems = 'center';
    const filterTypes = { timetableByGroup: 'studentGroups', timetableByTeacher: 'teachers', timetableByRoom: 'room' };

    function getCalendarParameters() {
      const filterSelect = document.querySelector("[ng-model='criteria.selectedTimetableId']");
      const printAsPdfButton = document.querySelector("a[aria-label='Trüki sündmused pdf']");
      let filterType = Object.keys(filterTypes).find(key => printAsPdfButton.href.includes(key));
      return {
        filterType,
        filterValueId: new URLSearchParams(printAsPdfButton.href).get(filterTypes[filterType]),
        filterValue: filterSelect.querySelector('input').value,
        schoolId: printAsPdfButton.href.match(/timetableevents\/\w+\/(\d+)/)[1],
      };
    }

    // Add default filter to show only your classes
    let defaultFilter = document.createElement('button');
    defaultFilter.textContent = 'Muuda vaikimisi filtriks';
    defaultFilter.title =
      'Kui lähed tunniplaani peale siis avab kohe sama tulemuse. Salvestab localstorage-i, seega ainult selle arvutiga töötab.';
    defaultFilter.className = 'md-button';
    defaultFilter.addEventListener('click', () => {
      console.log('Set default filter', getCalendarParameters());
      let parameters = getCalendarParameters();
      if (!parameters.filterValue) {
        defaultFilter.textContent = 'X Ebaõnnestus';
        alert(
          'Pead enne otsingussesse midagi kirjutama, et saaks salvestada vaikimisi filtriks. Näiteks oma nime või rühma nime.'
        );
        defaultFilter.disabled = true;
      } else {
        localStorage.setItem('defaultCalendarFilter', JSON.stringify(parameters));
        defaultFilter.textContent = '✓ Salvestatud';
        defaultFilter.disabled = true;
      }
      setTimeout(() => {
        defaultFilter.textContent = 'Muuda vaikimisi filtriks';
        defaultFilter.disabled = false;
      }, 3000);
    });
    calendarHeader.append(defaultFilter);

    // Button to show simplified timetable
    let timetableButton = document.createElement('button');
    timetableButton.textContent = 'Poolaasta ülevaade';
    timetableButton.className = 'md-button';
    timetableButton.addEventListener('click', () => {
      let year = new Date().getFullYear();
      // get half of the year, based on the current date
      let startMonth = new Date().getMonth() < 8 ? '01' : '08';
      let from = `${year}-${startMonth}-01T00:00:00Z`;
      let to = `${year}-${startMonth === '01' ? '07' : '12'}-31T00:00:00Z`;

      let { filterType, filterValueId, schoolId } = getCalendarParameters();
      let paramName = filterTypes[filterType];
      fetch(
        `https://tahvel.edu.ee/hois_back/timetableevents/${filterType}/${schoolId}?from=${from}&lang=ET&thru=${to}&${paramName}=${filterValueId}`
      )
        .then(response => response.json())
        .then(data => {
          let container = document.getElementById('calendar');
          container.innerHTML = '';
          container.style.overflow = 'auto';
          let groupedEvents = [];
          let repeatingEvents = {};
          let singleTimeEvents = [];
          console.log(data);
          data.timetableEvents.forEach(event => {
            let eventKey = event.nameEt + '|' + event.rooms[0].roomCode + '|' + event.studentGroups[0].code;
            if (groupedEvents[eventKey] === undefined) {
              groupedEvents[eventKey] = {
                name: event.nameEt,
                room: event.rooms[0].roomCode,
                studentGroup: event.studentGroups[0].code,
                allTeachers: event.teachers.map(teacher => teacher.name).join(', '),
                events: {},
              };
            }

            // Add only one event per day
            let [datePart] = event.date.split('T');
            let timeStart = new Date(datePart + 'T' + event.timeStart);
            let timeEnd = new Date(datePart + 'T' + event.timeEnd);
            let eventsObject = groupedEvents[eventKey].events[event.date];
            if (eventsObject === undefined) {
              event.timeStart = timeStart;
              event.timeEnd = timeEnd;
              groupedEvents[eventKey].events[event.date] = event;
            } else {
              // update start and end dates when its earlier or later
              if (timeStart < eventsObject.timeStart) {
                groupedEvents[eventKey].events[event.date].timeStart = timeStart;
              }
              if (timeEnd > eventsObject.timeEnd) {
                groupedEvents[eventKey].events[event.date].timeEnd = timeEnd;
              }
            }
          });

          Object.keys(groupedEvents).forEach(key => {
            let event = groupedEvents[key];
            if (Object.keys(event.events).length > 1) {
              repeatingEvents[key] = event;
            } else {
              singleTimeEvents.push(event);
            }
          });

          // 3. weekly repeating events
          let heading = document.createElement('h2');
          heading.textContent = 'Korduvad sündmused';
          container.appendChild(heading);
          let table = document.createElement('table');
          table.style.height = 'fit-content';
          table.innerHTML =
            '<tr><th>Päev</th><th>Rühm</th><th>Nimi</th><th>Ruum</th><th>Õpetajad</th><th>Algab</th><th>Kuni</th><th></th></tr>';
          container.appendChild(table);
          Object.keys(repeatingEvents).forEach(key => {
            let event = repeatingEvents[key];
            let row = table.insertRow();
            let date = new Date(event.events[Object.keys(event.events)[0]].date);
            row.insertCell().textContent = date.toLocaleDateString('et-EE', { weekday: 'narrow' });
            row.insertCell().textContent = event.studentGroup;
            row.insertCell().textContent = event.name;
            row.insertCell().textContent = event.room;
            row.insertCell().textContent = event.allTeachers;
            row.insertCell().textContent = event.events[Object.keys(event.events)[0]].timeStart.toLocaleTimeString('et-EE');
            row.insertCell().textContent = event.events[Object.keys(event.events)[0]].timeEnd.toLocaleTimeString('et-EE');
            row.insertCell().textContent = Object.keys(event.events).length + ' korda';
          });

          // 4. all non-repeating events
          let heading2 = document.createElement('h2');
          heading2.textContent = 'Ühekordsed sündmused';
          container.appendChild(heading2);
          let table2 = document.createElement('table');
          table2.style.height = 'fit-content';
          table2.innerHTML =
            '<tr><th>Kuupäev</th><th>Rühm</th><th>Nimi</th><th>Ruum</th><th>Õpetajad</th><th>Algab</th><th>Kuni</th></tr>';
          container.appendChild(table2);
          singleTimeEvents.forEach(event => {
            let row = table2.insertRow();
            let date = new Date(event.events[Object.keys(event.events)[0]].date);
            row.insertCell().textContent = date.toLocaleDateString('et-EE', {
              weekday: 'narrow',
              day: '2-digit',
              month: '2-digit',
            });
            row.insertCell().textContent = event.studentGroup;
            row.insertCell().textContent = event.name;
            row.insertCell().textContent = event.room;
            row.insertCell().textContent = event.allTeachers;
            row.insertCell().textContent = event.events[Object.keys(event.events)[0]].timeStart.toLocaleTimeString('et-EE');
            row.insertCell().textContent = event.events[Object.keys(event.events)[0]].timeEnd.toLocaleTimeString('et-EE');
          });
        });
    });
    calendarHeader.append(timetableButton);
  }
  //#endregion
})();

/**
 * Ma ei tea veel kas teha hardcoded eesliidese järgi pikkused või teha gruppide päringu ajal arvutus ja cacheda see localstorage-sse.
 * https://tahvel.edu.ee/hois_back/autocomplete/studentgroups?lang=ET
 */
function getAllGroupDurations(groups) {
  let durations = {};
  groups.forEach(data => {
    const groupCode = data.nameEt.split('-')[0];

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
    original.apply(scope, arguments);
    try {
      after.apply(scope, arguments);
    } catch (e) {
      console.error(e);
    }
  };
}
