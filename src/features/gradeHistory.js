// https://tahvel.edu.ee/#/students/141230/results?_noback
// https://tahvel.edu.ee/#/students/myResults

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
`;
document.head.appendChild(gradeHistoryStyle);

let hash = window.location.hash;

let simpleMode = true;
let graphType = 'grades';

function createGradeHistory() {
  if (hash.includes('/results') || hash.includes('/myResults')) {
    const init = () => {
      const mainContent = document.querySelector('#main-content');
      const fieldSet = mainContent?.querySelector('fieldset');

      if (mainContent && fieldSet) {
        let elements;
        let graph = mainContent.querySelector('#gradeHistoryGraph');

        if (!graph) {
          elements = createGraphElements(fieldSet);
          graph = elements.graph;
        }

        initChart(graph);
        manageLogin(elements);
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

createGradeHistory();

window.addEventListener('hashchange', () => {
  hash = window.location.hash;
  createGradeHistory();
});

function manageLogin(elements) {
  let isLoggedin = false; // TODO: add login check by createing a api endpoint to check it

  if (!isLoggedin) {
    elements.loginOverlay.style.display = 'flex';
    return;
  }
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
    },
    absences: { dates: [], noReason: [], withReason: [], absencesTotal: [], lessons: [] },
  };

  data.grades.forEach(e => {
    processedData.grades.dates.push(e.date);
    processedData.grades.negativeGrades.push(e.negativeGrades);
    processedData.grades.positiveGrades.push(+e.fineGrades + +e.goodGrades + +e.greatGrades);

    processedData.grades.fineGrades.push(e.fineGrades);
    processedData.grades.goodGrades.push(e.goodGrades);
    processedData.grades.greatGrades.push(e.greatGrades);

    processedData.grades.gradeTotal.push(+e.negativeGrades + +e.fineGrades + +e.goodGrades + +e.greatGrades);
  });

  data.absences.forEach(e => {
    processedData.absences.dates.push(e.date);
    processedData.absences.noReason.push(e.noReason);
    processedData.absences.withReason.push(e.withReason);
    processedData.absences.absencesTotal.push(+e.noReason + +e.withReason);
    processedData.absences.lessons.push(((+e.noReason + +e.withReason) * 100) / +e.metric); // Calculate lessons using all absences and absence percentage
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
  const gradeHistory = document.createElement('div');
  gradeHistory.id = 'gradeHistoryContainer';
  gradeHistory.className = 'chart-container';

  // Create login container
  const loginOverlay = document.createElement('div');
  loginOverlay.id = 'loginOverlay';
  loginOverlay.className = 'login-overlay';
  loginOverlay.style.display = 'none';

  // Create graph container
  const graphContainer = document.createElement('div');
  graphContainer.id = 'graphContainer';
  graphContainer.className = 'graph-container';

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

  loginContent.appendChild(loginText);
  loginContent.appendChild(loginBtn);

  // Create graph controlls
  const graphControlls = document.createElement('div');
  const graphDataBtn = document.createElement('a');
  graphDataBtn.id = 'graphDataBtn';
  graphDataBtn.className = 'md-raised md-primary md-button md-ink-ripple';
  graphDataBtn.text = 'Hinnete vaade';
  const graphModeBtn = document.createElement('a');
  graphModeBtn.id = 'graphModeBtn';
  graphModeBtn.className = 'md-raised md-secondary md-button md-ink-ripple';
  graphModeBtn.text = 'Lihtne vaade';

  graphDataBtn.addEventListener('click', () => {
    graphType = graphType === 'grades' ? 'absences' : 'grades';
    graphDataBtn.text = graphDataBtn.text === 'Hinnete vaade' ? 'Puudumiste vaade' : 'Hinnete vaade';
    document.querySelector('#graphModeBtn').style.display = graphDataBtn.text === 'Hinnete vaade' ? 'inline-block' : 'none';
    createGraph();
  });
  graphModeBtn.addEventListener('click', () => {
    // Switch between simple mode true and false
    simpleMode = !simpleMode;
    graphModeBtn.text = graphModeBtn.text === 'Lihtne vaade' ? 'Täiustatud vaade' : 'Lihtne vaade';
    createGraph();
  });

  graphControlls.appendChild(graphDataBtn);
  graphControlls.appendChild(graphModeBtn);

  // Create graph
  const graph = document.createElement('canvas');
  graph.id = 'gradeHistoryGraph';
  graph.height = '100%';
  graph.width = '100%';
  graph.style.margin = '2px';

  // Create login form
  graphContainer.appendChild(graphControlls);
  graphContainer.appendChild(graph);

  loginOverlay.appendChild(loginContent);

  gradeHistory.appendChild(graphContainer);
  gradeHistory.appendChild(loginOverlay);

  previousElement.after(gradeHistory);

  return { graph, loginOverlay, graphContainer };
}

function initChart(graph) {
  let processedData = processData(exampleData, simpleMode);

  let myChart = Chart.getChart(graph);

  if (!myChart) {
    myChart = new Chart(graph, {
      type: 'line',
      data: graphData(processedData, graphType),
      options: {
        plugins: {
          tooltip: { mode: 'index', intersect: false },
          legend: {
            labels: { filter: legendItem => legendItem.text !== 'hindeid kokku' && legendItem.text !== 'puudumisi kokku' },
          },
        },
        scales: { y: { stacked: true } },
      },
    });

    return;
  }

  myChart.data = graphData(processedData, graphType);

  myChart.update();
}
