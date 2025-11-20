import * as env from 'env';

let msalInstance;
let msalReady = new Promise(resolve => {
  let gradeHistoryScript = document.getElementById('msal-script');

  function onMsalReady() {
    resolve(initMsal());
  }

  if (!gradeHistoryScript) {
    gradeHistoryScript = document.createElement('script');
    gradeHistoryScript.id = 'msal-script';
    gradeHistoryScript.src = 'https://alcdn.msauth.net/browser/2.35.0/js/msal-browser.min.js';
    gradeHistoryScript.type = 'text/javascript';
    gradeHistoryScript.onload = onMsalReady;
    document.body.appendChild(gradeHistoryScript);
  } else if (window.msal && window.PublicClientApplication) {
    resolve(initMsal());
  } else {
    gradeHistoryScript.onload = onMsalReady;
  }
});

function initMsal() {
  const msalConfig = {
    auth: {
      clientId: env.MSAL_CLIENT_ID,
      authority: 'https://login.microsoftonline.com/' + env.MSAL_TENANT_ID,
      redirectUri: 'https://tahvel.edu.ee/',
    },
    cache: { cacheLocation: 'localStorage' },
  };
  msalInstance = new msal.PublicClientApplication(msalConfig);
  return msalInstance;
}

export { msalInstance, msalReady };
