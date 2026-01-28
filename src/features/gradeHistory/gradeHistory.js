import * as env from 'env';

import { Authentication } from '../../auth/authentication.js';
import { GraphComponents } from './graphComponents.js';

import { waitForElement } from './waitForElement.js';
import { getStudentId } from './getStudentId.js';

import { exampleData } from '../../datasets/ExampleHistory.js';

import css from './gradeHistory.css';
import graphUi from './gradeHistory.html';

// Listen for hash changes
window.addEventListener('hashchange', gradeHistory);

// Inject CSS
GM_addStyle(css);

// Initialize MSAL authentication
const auth = new Authentication();

// Declare variables
let studentData = {};

let components;

let simpleMode = true;
let graphType = 'grades';
let lastState = 'grades';

export async function gradeHistory() {
  const hash = window.location.hash;

  // Only run on specific pages  
  if (!['/results', '/myResults'].some(page => hash.includes(page))) return;

  // Check for existing marker
  if (document.querySelector('#grade-history-marker')) return;

  // Create marker to prevent multiple initializations
  let marker = document.createElement('div');
  marker.setAttribute('id', 'grade-history-marker');
  document.body.appendChild(marker);

  console.log('Initializing grade history feature...');

  await getGraphElements()
    .then(elements => {
      components = new GraphComponents({
        graph: elements.graph,
        login: elements.loginOverlay,
        loading: elements.loadingOverlay,
      });
  });

  components.toggleLoading();

  if (!manageLogin()) {
    manageChart(components.graphComponent, processData(exampleData));
  } else {
    manageChart(components.graphComponent, await fetchGradeHistory());
  }

  components.toggleLoading();

  console.log('Grade history feature initialized.');
};

// -------------LOGIN MANAGEMENT-------------
function manageLogin() {
  if (!auth.checkAuth()) {
    if (!components.isLoginVisible) {
      components.toggleLogin();
    }
    return false;
  }

  if (components.isLoginVisible) {
    components.toggleLogin();
  }
  return true;
};

// -------------GRAPH UI MANAGEMENT-------------
async function getGraphElements() {
  const fieldSet = await waitForElement('#main-content fieldset');

  if (fieldSet.querySelector('#grade-history-graph')) {
    return {
      graphComponent: fieldSet.querySelector('#grade-history-graph'),
      loginComponent: fieldSet.querySelector('#graph-login-overlay'),
      loadingComponent: fieldSet.querySelector('#graph-loading-overlay'),
    };
  };

  return createGraphElements(fieldSet);
};

function createGraphElements(previousElement) {
  const template = document.createElement('template');
  template.innerHTML = graphUi;

  const ui = template.content.firstElementChild;
  previousElement.after(ui);

  // Get elements
  const graph = ui.querySelector('#grade-history-graph');
  const loginOverlay = ui.querySelector('#graph-login-overlay');
  const loadingOverlay = ui.querySelector('#graph-loading-overlay');

  // Buttons
  ui.querySelector('#graph-metric-btn').addEventListener('click', () => {
    graphControllsFunction('graph-metric-btn');
  });
  ui.querySelector('#graph-scope-btn').addEventListener('click', () => {
    graphControllsFunction('graph-scope-btn');
  });
  ui.querySelector('#graph-mode-btn').addEventListener('click', () => {
    graphControllsFunction('graph-mode-btn');
  });

  ui.querySelector('#graph-login-btn').addEventListener('click', async () => {
    let loginResult = await auth.login();

    if (loginResult) {
      if (!manageLogin()) {
        manageChart(components.graphComponent, processData(exampleData));
      } else {
        manageChart(components.graphComponent, await fetchGradeHistory());
      }
    }
  });

  return { graph, loginOverlay, loadingOverlay };
};

async function graphControllsFunction(button) {
  let tempLastState = '';

  if (['graph-metric-btn', 'graph-scope-btn'].includes(button)) {
    tempLastState = graphType;
  }

  switch (button) {
    case 'graph-metric-btn':
      graphType = ['grades', 'finalGrades'].includes(graphType) ? 'absences' : lastState;
      break;
    case 'graph-scope-btn':
      graphType = graphType === 'finalGrades' ? 'grades' : 'finalGrades';
      break;
    case 'graph-mode-btn':
      simpleMode = !simpleMode;
      break;
  }

  lastState = tempLastState;

  let graphDataBtn = document.querySelector('#graph-metric-btn');
  graphDataBtn.text = graphType === 'grades' || graphType === 'finalGrades' ? 'Puudumiste vaade' : 'Hinnete vaade';

  let graphFinalDataBtn = document.querySelector('#graph-scope-btn');
  graphFinalDataBtn.text = graphType === 'finalGrades' ? 'Hinnete vaade' : 'Lõpphindete vaade';
  graphFinalDataBtn.style.display = graphType === 'absences' ? 'none' : 'inline-block';

  let graphModeBtn = document.querySelector('#graph-mode-btn');
  graphModeBtn.text = simpleMode ? 'Täiustatud vaade' : 'Lihtne vaade';
  graphModeBtn.style.display = graphType === 'absences' ? 'none' : 'inline-block';

  manageChart(components.graphComponent, await fetchGradeHistory());
};

function manageChart(graph, data) {
  const chartData = graphData(data, graphType);
  let myChart = Chart.getChart(graph);

  if (!myChart) {
    myChart = new Chart(graph, {
      type: 'line',
      data: chartData,
      options: {
        plugins: {
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function (context) {
                let label = context.dataset.label || '';

                if (label && label === 'puudumisi kokku') {
                  return label + ': ' + context.parsed.y + ' | ' + data.absences.metrics[context.dataIndex] + '%';
                }
                if (label && label === 'negatiivseid hindeid') {
                  return (
                    label +
                    ': ' +
                    context.parsed.y +
                    ' | ' +
                    data.grades.negativeGradesMetric[context.dataIndex] +
                    '%'
                  );
                }
                if (label && label === 'negatiivseid lõpphindeid') {
                  return (
                    label +
                    ': ' +
                    context.parsed.y +
                    ' | ' +
                    data.finalGrades.negativeFinalGradesMetric[context.dataIndex] +
                    '%'
                  );
                }

                return label + ': ' + context.parsed.y;
              },
            },
          },
          legend: {
            labels: {
              filter: legendItem =>
                legendItem.text !== 'hindeid kokku' &&
                legendItem.text !== 'puudumisi kokku' &&
                legendItem.text !== 'lõpphindeid kokku',
            },
          },
        },
        scales: { y: { stacked: true, beginAtZero: true } },
        responsive: true,
        maintainAspectRatio: false,
      },
    });

    return;
  }

  myChart.data = chartData;

  myChart.update('none');
};

// -------------DATA PROCESSING-------------
async function fetchGradeHistory() {
  try {
    const studentId = await getStudentId();

    // Check if we already have student data cached
    if (studentData && studentData[studentId]) {
      return studentData[studentId];
    }

    const accessToken = await auth.getToken();
    const apiResponse = await fetch(env.SERVER_URL + `/api/StudentRecord/Student/${studentId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    }).then(res => res.json());

    // Cache the fetched student data
    studentData[studentId] = processData(apiResponse);

    return studentData[studentId];
  } catch (error) {
    console.error('Error during fetchWithToken:', error);
    throw error;
  }
};

function processData(data) {
  let processedData = {
    grades: {
      dates: [],
      negativeGrades: [],
      positiveGrades: [],
      fineGrades: [],
      goodGrades: [],
      greatGrades: [],
      gradeTotal: [],
      negativeGradesMetric: [],
    },
    finalGrades: {
      dates: [],
      negativeFinalGrades: [],
      positiveFinalGrades: [],
      fineFinalGrades: [],
      goodFinalGrades: [],
      greatFinalGrades: [],
      finalGradeTotal: [],
      negativeFinalGradesMetric: [],
    },
    absences: { dates: [], noReason: [], withReason: [], absencesTotal: [], lessons: [], metrics: [] },
  };

  data.grades.forEach(e => {
    processedData.grades.dates.push(e.date);
    processedData.grades.negativeGrades.push(e.negativeGrades);
    processedData.grades.positiveGrades.push(+e.fineGrades + +e.goodGrades + +e.greatGrades);

    processedData.grades.fineGrades.push(e.fineGrades);
    processedData.grades.goodGrades.push(e.goodGrades);
    processedData.grades.greatGrades.push(e.greatGrades);

    processedData.grades.gradeTotal.push(+e.negativeGrades + +e.fineGrades + +e.goodGrades + +e.greatGrades);

    processedData.grades.negativeGradesMetric.push(
      ((+e.negativeGrades * 100) / +processedData.grades.gradeTotal.slice(-1)).toFixed(0)
    );
  });

  data.finalGrades.forEach(e => {
    processedData.finalGrades.dates.push(e.date);
    processedData.finalGrades.negativeFinalGrades.push(e.negativeFinalGrades);
    processedData.finalGrades.positiveFinalGrades.push(+e.fineFinalGrades + +e.goodFinalGrades + +e.greatFinalGrades);

    processedData.finalGrades.fineFinalGrades.push(e.fineFinalGrades);
    processedData.finalGrades.goodFinalGrades.push(e.goodFinalGrades);
    processedData.finalGrades.greatFinalGrades.push(e.greatFinalGrades);
    processedData.finalGrades.finalGradeTotal.push(
      +e.negativeFinalGrades + +e.fineFinalGrades + +e.goodFinalGrades + +e.greatFinalGrades
    );

    processedData.finalGrades.negativeFinalGradesMetric.push(
      ((+e.negativeFinalGrades * 100) / +processedData.finalGrades.finalGradeTotal.slice(-1)).toFixed(0)
    );
  });

  data.absences.forEach(e => {
    processedData.absences.dates.push(e.date);
    processedData.absences.noReason.push(e.noReason);
    processedData.absences.withReason.push(e.withReason);
    processedData.absences.absencesTotal.push(+e.noReason + +e.withReason);
    processedData.absences.lessons.push((((+e.noReason + +e.withReason) * 100) / +e.metric).toFixed(0)); // Calculate lessons using all absences and absence percentage
    processedData.absences.metrics.push(e.metric);
  });

  return processedData;
};

function graphData(data, graphType) {
  let datasetSimple = [
    {
      label: 'negatiivseid hindeid',
      data: data.grades.negativeGrades,
      borderWidth: 2,
      borderColor: '#eb3b5a',
      backgroundColor: '#fc5c65',
      fill: true,
      stack: 'grades',
    },
    {
      label: 'positiivseid hindeid',
      data: data.grades.positiveGrades,
      borderWidth: 2,
      borderColor: '#20bf6b',
      backgroundColor: '#26de81',
      fill: true,
      stack: 'grades',
    },
  ];

  let datasetAdvanced = [
    {
      label: 'negatiivseid hindeid',
      data: data.grades.negativeGrades,
      borderWidth: 2,
      borderColor: '#eb3b5a',
      backgroundColor: '#fc5c65',
      fill: true,
      stack: 'grades',
    },
    {
      label: 'rahuldavaid hindeid',
      data: data.grades.fineGrades,
      borderWidth: 2,
      borderColor: '#fa8231',
      backgroundColor: '#fd9644',
      fill: true,
      stack: 'grades',
    },
    {
      label: 'häid hindeid',
      data: data.grades.goodGrades,
      borderWidth: 2,
      borderColor: '#f7b731',
      backgroundColor: '#fed330',
      fill: true,
      stack: 'grades',
    },
    {
      label: 'suurepäraseid hindeid',
      data: data.grades.greatGrades,
      borderWidth: 2,
      borderColor: '#20bf6b',
      backgroundColor: '#26de81',
      fill: true,
      stack: 'grades',
    },
  ];

  let datasetFinalSimple = [
    {
      label: 'negatiivseid lõpphindeid',
      data: data.finalGrades.negativeFinalGrades,
      borderWidth: 2,
      borderColor: '#eb3b5a',
      backgroundColor: '#fc5c65',
      fill: true,
      stack: 'grades',
    },
    {
      label: 'positiivseid lõpphindeid',
      data: data.finalGrades.positiveFinalGrades,
      borderWidth: 2,
      borderColor: '#20bf6b',
      backgroundColor: '#26de81',
      fill: true,
      stack: 'grades',
    },
  ];

  let datasetFinalAdvanced = [
    {
      label: 'negatiivseid lõpphindeid',
      data: data.finalGrades.negativeFinalGrades,
      borderWidth: 2,
      borderColor: '#eb3b5a',
      backgroundColor: '#fc5c65',
      fill: true,
      stack: 'grades',
    },
    {
      label: 'rahuldavaid lõpphindeid',
      data: data.finalGrades.fineFinalGrades,
      borderWidth: 2,
      borderColor: '#fa8231',
      backgroundColor: '#fd9644',
      fill: true,
      stack: 'grades',
    },
    {
      label: 'häid lõpphindeid',
      data: data.finalGrades.goodFinalGrades,
      borderWidth: 2,
      borderColor: '#f7b731',
      backgroundColor: '#fed330',
      fill: true,
      stack: 'grades',
    },
    {
      label: 'suurepäraseid lõpphindeid',
      data: data.finalGrades.greatFinalGrades,
      borderWidth: 2,
      borderColor: '#20bf6b',
      backgroundColor: '#26de81',
      fill: true,
      stack: 'grades',
    },
  ];

  if (graphType == 'grades') {
    return {
      labels: data.grades.dates,
      datasets: [
        ...(simpleMode ? datasetSimple : datasetAdvanced),
        { label: 'hindeid kokku', data: data.grades.gradeTotal, borderColor: '#4b6584', backgroundColor: '#778ca3' },
      ],
    };
  } else if (graphType == 'finalGrades') {
    return {
      labels: data.finalGrades.dates,
      datasets: [
        ...(simpleMode ? datasetFinalSimple : datasetFinalAdvanced),
        {
          label: 'lõpphindeid kokku',
          data: data.finalGrades.finalGradeTotal,
          borderColor: '#4b6584',
          backgroundColor: '#778ca3',
        },
      ],
    };
  } else if (graphType == 'absences') {
    return {
      labels: data.absences.dates,
      datasets: [
        {
          label: 'põhjuseta puudumised',
          data: data.absences.noReason,
          borderWidth: 2,
          borderColor: '#a5b1c2',
          backgroundColor: '#d1d8e0',
          fill: true,
          stack: 'absences',
        },
        {
          label: 'põhjusega puudumised',
          data: data.absences.withReason,
          borderWidth: 2,
          borderColor: '#3867d6',
          backgroundColor: '#4b7bec',
          fill: true,
          stack: 'absences',
        },
        {
          label: 'puudumisi kokku',
          data: data.absences.absencesTotal,
          borderColor: '#2d98da',
          backgroundColor: '#45aaf2',
          fill: true,
          stack: 'none',
        },
        {
          label: 'tunde kokku',
          data: data.absences.lessons,
          borderColor: '#4b6584',
          backgroundColor: '#778ca3',
          fill: true,
        },
      ],
    };
  }
};

// TODO: Refactor graphData to be cleaner