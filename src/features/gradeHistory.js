// https://tahvel.edu.ee/#/students/141230/results?_noback
// https://tahvel.edu.ee/#/students/myResults
import { msalInstance, msalReady } from './msal.js';
import * as env from 'env';

window.addEventListener('hashchange', () => {
  hash = window.location.hash;
  gradeHistoryMain();
});

let exampleData = {
  grades: [
    { date: '29.09', negativeGrades: '1', fineGrades: '3', goodGrades: '5', greatGrades: '5' },
    { date: '07.10', negativeGrades: '2', fineGrades: '4', goodGrades: '6', greatGrades: '6' },
    { date: '14.10', negativeGrades: '1', fineGrades: '4', goodGrades: '7', greatGrades: '7' },
    { date: '21.10', negativeGrades: '3', fineGrades: '5', goodGrades: '8', greatGrades: '8' },
    { date: '28.10', negativeGrades: '2', fineGrades: '5', goodGrades: '9', greatGrades: '9' },
    { date: '04.11', negativeGrades: '4', fineGrades: '6', goodGrades: '10', greatGrades: '10' },
    { date: '11.11', negativeGrades: '2', fineGrades: '6', goodGrades: '11', greatGrades: '11' },
    { date: '18.11', negativeGrades: '3', fineGrades: '7', goodGrades: '12', greatGrades: '12' },
    { date: '25.11', negativeGrades: '1', fineGrades: '7', goodGrades: '13', greatGrades: '13' },
    { date: '02.12', negativeGrades: '2', fineGrades: '8', goodGrades: '14', greatGrades: '14' },
    { date: '09.12', negativeGrades: '3', fineGrades: '8', goodGrades: '15', greatGrades: '15' },
    { date: '16.12', negativeGrades: '2', fineGrades: '9', goodGrades: '16', greatGrades: '16' },
    { date: '23.12', negativeGrades: '5', fineGrades: '9', goodGrades: '17', greatGrades: '17' },
    { date: '30.12', negativeGrades: '6', fineGrades: '10', goodGrades: '18', greatGrades: '18' },
    { date: '06.01', negativeGrades: '8', fineGrades: '11', goodGrades: '19', greatGrades: '19' },
    { date: '13.01', negativeGrades: '10', fineGrades: '12', goodGrades: '20', greatGrades: '20' },
    { date: '20.01', negativeGrades: '9', fineGrades: '13', goodGrades: '21', greatGrades: '21' },
    { date: '27.01', negativeGrades: '7', fineGrades: '14', goodGrades: '22', greatGrades: '22' },
    { date: '03.02', negativeGrades: '6', fineGrades: '15', goodGrades: '23', greatGrades: '23' },
    { date: '10.02', negativeGrades: '5', fineGrades: '16', goodGrades: '24', greatGrades: '24' },
    { date: '17.02', negativeGrades: '4', fineGrades: '17', goodGrades: '25', greatGrades: '25' },
    { date: '24.02', negativeGrades: '3', fineGrades: '18', goodGrades: '26', greatGrades: '26' },
    { date: '03.03', negativeGrades: '2', fineGrades: '19', goodGrades: '27', greatGrades: '27' },
    { date: '10.03', negativeGrades: '2', fineGrades: '20', goodGrades: '28', greatGrades: '28' },
    { date: '17.03', negativeGrades: '1', fineGrades: '21', goodGrades: '29', greatGrades: '29' },
  ],
  absences: [
    { date: '29.09', withReason: '2', noReason: '1', metric: '90' },
    { date: '29.09', withReason: '3', noReason: '2', metric: '80' },
    { date: '29.09', withReason: '4', noReason: '3', metric: '70' },
    { date: '29.09', withReason: '5', noReason: '4', metric: '60' },
  ],
};

let studentData = {};

// Inject CSS
const gradeHistoryStyle = document.createElement('style');
gradeHistoryStyle.textContent = `
  .chart-container {
    position: relative;
    height: 400px;
    margin: 2px;
    border: 1px solid #d9d9d6;
  }
  .graph-container {
    width: 100%;
    height: 90%;
  }
  .login-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(2px); /* Modern browsers - blurs background */
    z-index: 1;
  }
  .login-box {
    background: white;
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    width: 300px;
    height: 200px;
    text-align: center;
  }
  .spinner {
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: 1;
    width: 120px;
    height: 120px;
    margin: -76px 0 0 -76px;
    border: 16px solid #f3f3f3;
    border-radius: 50%;
    border-top: 16px solid #3498db;
    -webkit-animation: spin 2s linear infinite;
    animation: spin 2s linear infinite;
  }

  @-webkit-keyframes spin {
    0% { -webkit-transform: rotate(0deg); }
    100% { -webkit-transform: rotate(360deg); }
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(gradeHistoryStyle);

let hash = window.location.hash;

let simpleMode = true;
let graphType = 'grades';

async function createGradeHistory() {
  if (hash.includes('/results') || hash.includes('/myResults')) {
    const init = () => {
      const mainContent = document.querySelector('#main-content');
      const fieldSet = mainContent?.querySelector('fieldset');

      if (mainContent && fieldSet) {
        let elements;
        let graph = mainContent.querySelector('#gradeHistoryGraph');
        let loginOverlay = mainContent.querySelector('#loginOverlay');

        if (!graph || !loginOverlay) {
          elements = createGraphElements(fieldSet);
          graph = elements.graph;
          loginOverlay = elements.loginOverlay;
        }

        if (!manageLogin(graph, loginOverlay)) {
          initChart(graph, exampleData);
        }

        return true;
      }
      return false;
    };

    if (!init()) {
      const observer = new MutationObserver(() => {
        if (init()) {
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }
}

async function gradeHistoryMain() {
  console.log('Initializing grade history feature...');
  await createGradeHistory();
  if ((hash.includes('/results') || hash.includes('/myResults')) && document.querySelector('#gradeHistoryContainer')) {
    window.location.reload();
  }
}
gradeHistoryMain();

const request = { scopes: ['openid', 'profile'] };

function manageLogin(graph, loginOverlay) {
  console.log('Managing login state...');

  const accounts = msalInstance.getAllAccounts();

  if (accounts.length === 0) {
    // No accounts found, show login overlay
    console.log('No accounts found, showing login overlay.');
    loginOverlay.style.display = 'flex';
    return false;
  }

  // Set the first account as active (you can customize which to use)
  msalInstance.setActiveAccount(accounts[0]);

  // Include the active account in the request to acquireTokenSilent
  const silentRequest = { ...request, account: accounts[0] };

  msalInstance
    .acquireTokenSilent(silentRequest)
    .then(async response => {
      loginOverlay.style.display = 'none';
      initChart(graph, await fetchGradeHistory());
    })
    .catch(error => {
      console.log('Silent token acquisition failed, showing login overlay.');
      console.error(error);
      loginOverlay.style.display = 'flex';
    });

  return true;
}

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

  data.absences.forEach(e => {
    processedData.absences.dates.push(e.date);
    processedData.absences.noReason.push(e.noReason);
    processedData.absences.withReason.push(e.withReason);
    processedData.absences.absencesTotal.push(+e.noReason + +e.withReason);
    processedData.absences.lessons.push(((+e.noReason + +e.withReason) * 100) / +e.metric).toFixed(0); // Calculate lessons using all absences and absence percentage
    processedData.absences.metrics.push(e.metric);
  });

  return processedData;
}

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

  if (graphType == 'grades') {
    return {
      labels: data.grades.dates,
      datasets: [
        ...(simpleMode ? datasetSimple : datasetAdvanced),
        { label: 'hindeid kokku', data: data.grades.gradeTotal, borderColor: '#4b6584', backgroundColor: '#778ca3' },
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
}

function createGraphElements(previousElement) {
  // Create grade history container
  const gradeHistory = document.createElement('fieldset');
  gradeHistory.id = 'gradeHistoryContainer';
  gradeHistory.className = 'chart-container';

  const gradeHistoryLegend = document.createElement('legend');
  gradeHistoryLegend.textContent = 'Ajalugu';
  gradeHistory.appendChild(gradeHistoryLegend);

  // Create login container
  const loginOverlay = document.createElement('div');
  loginOverlay.id = 'loginOverlay';
  loginOverlay.className = 'login-overlay';
  loginOverlay.style.display = 'none';

  // Create loading container
  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'loadingOverlay';
  loadingOverlay.className = 'login-overlay';
  loadingOverlay.style.display = 'none';

  // Create graph container
  const graphContainer = document.createElement('div');
  graphContainer.id = 'graphContainer';
  graphContainer.className = 'graph-container';

  // Create graph controlls
  const graphControlls = document.createElement('div');
  const graphDataBtn = document.createElement('a');
  graphDataBtn.id = 'graphDataBtn';
  graphDataBtn.className = 'md-raised md-primary md-button md-ink-ripple';
  graphDataBtn.text = 'Puudumiste vaade';
  const graphModeBtn = document.createElement('a');
  graphModeBtn.id = 'graphModeBtn';
  graphModeBtn.className = 'md-raised md-secondary md-button md-ink-ripple';
  graphModeBtn.text = 'Täiustatud vaade';

  graphDataBtn.addEventListener('click', () => {
    graphType = graphType === 'grades' ? 'absences' : 'grades';
    graphDataBtn.text = graphDataBtn.text === 'Hinnete vaade' ? 'Puudumiste vaade' : 'Hinnete vaade';
    document.querySelector('#graphModeBtn').style.display =
      graphDataBtn.text === 'Puudumiste vaade' ? 'inline-block' : 'none';
    createGradeHistory();
  });
  graphModeBtn.addEventListener('click', () => {
    // Switch between simple mode true and false
    simpleMode = !simpleMode;
    graphModeBtn.text = graphModeBtn.text === 'Lihtne vaade' ? 'Täiustatud vaade' : 'Lihtne vaade';
    createGradeHistory();
  });

  graphControlls.appendChild(graphDataBtn);
  graphControlls.appendChild(graphModeBtn);

  // Create graph
  const graph = document.createElement('canvas');
  graph.id = 'gradeHistoryGraph';
  graph.height = '100%';
  graph.width = '100%';
  graph.style.margin = '2px';

  // Create login content
  const loginContent = document.createElement('div');
  loginContent.id = 'loginContent';
  loginContent.className = 'login-box';
  const loginText = document.createElement('h1');
  loginText.textContent = 'Logi sisse hinnete ajaloo nägemiseks';
  const loginBtn = document.createElement('a');
  loginBtn.id = 'loginBtn';
  loginBtn.className = 'md-raised md-primary md-button md-ink-ripple';
  loginBtn.text = 'Logi sisse';

  loginBtn.addEventListener('click', () => {
    msalInstance
      .loginPopup({ scopes: ['user.read'] })
      .then(response => {
        manageLogin(graph, loginOverlay);
      })
      .catch(error => {
        alert('Login failed: ' + error);
      });
  });

  loginContent.appendChild(loginText);
  loginContent.appendChild(loginBtn);

  // Create loading content
  const loadingSpinner = document.createElement('div');
  loadingSpinner.id = 'spinner';
  loadingSpinner.className = 'spinner';

  // Append elements
  graphContainer.appendChild(graphControlls);
  graphContainer.appendChild(graph);

  loginOverlay.appendChild(loginContent);

  loadingOverlay.appendChild(loadingSpinner);

  gradeHistory.appendChild(graphContainer);
  gradeHistory.appendChild(loginOverlay);
  gradeHistory.appendChild(loadingOverlay);

  previousElement.after(gradeHistory);

  return { graph, loginOverlay, graphContainer, loadingOverlay };
}

function initChart(graph, data) {
  let processedData = processData(data, simpleMode);

  let myChart = Chart.getChart(graph);

  if (!myChart) {
    myChart = new Chart(graph, {
      type: 'line',
      data: graphData(processedData, graphType),
      options: {
        plugins: {
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function (context) {
                let label = context.dataset.label || '';

                if (label && label === 'puudumisi kokku') {
                  return label + ': ' + context.parsed.y + ' | ' + processedData.absences.metrics[context.dataIndex] + '%';
                }
                if (label && label === 'negatiivseid hindeid') {
                  return (
                    label +
                    ': ' +
                    context.parsed.y +
                    ' | ' +
                    processedData.grades.negativeGradesMetric[context.dataIndex] +
                    '%'
                  );
                }

                return label + ': ' + context.parsed.y;
              },
            },
          },
          legend: {
            labels: { filter: legendItem => legendItem.text !== 'hindeid kokku' && legendItem.text !== 'puudumisi kokku' },
          },
        },
        scales: { y: { stacked: true, beginAtZero: true } },
      },
    });

    return;
  }

  myChart.data = graphData(processedData, graphType);

  myChart.update();
}

async function fetchGradeHistory() {
  try {
    const studentId = await getStudentId();

    console.log(studentData);
    // Check if we already have student data cached
    if (studentData && studentData[studentId]) {
      return studentData[studentId];
    }

    // Prepare token request - adjust scopes and account as needed
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
      throw new Error('No authenticated user found');
    }

    const loadingOverlay = document.querySelector('#loadingOverlay');
    loadingOverlay.style.display = 'inline-block';

    const tokenRequest = {
      scopes: [env.MSAL_CLIENT_ID + '/.default'], // Your API scopes here
      account: accounts[0], // Use the active or desired account
    };

    // Acquire token silently (handles caching and renewal)
    const response = await msalInstance.acquireTokenSilent(tokenRequest);
    const accessToken = response.accessToken;

    // Make the fetch request with the token
    const apiResponse = await fetch(env.SERVER_URL + `/api/StudentRecord/Student/${studentId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    }).then(res => res.json());

    studentData[studentId] = apiResponse;

    loadingOverlay.style.display = 'none';

    return apiResponse;
  } catch (error) {
    console.error('Error during fetchWithToken:', error);
    throw error;
  }
}

function getStudentId() {
  let id = null;

  const url = window.location.href;
  const match = url.match(/\/students\/(\d+)/);
  id = match ? match[1] : null;

  if (!id) {
    id = fetch('https://tahvel.edu.ee/hois_back/user', {
      method: 'GET',
      credentials: 'include',
      headers: { accept: 'application/json, text/plain, */*' },
    })
      .then(res => res.json())
      .then(data => data.student);
  }

  return id;
}
