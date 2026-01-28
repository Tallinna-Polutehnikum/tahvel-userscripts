import * as env from 'env';

export class Msal {
  #instance;
  #ready;

  constructor() {
    this.#ready = this.#loadScript().then(() => {
      this.#initMsal();
    });
  };

  get msalInstance() {
    return this.#instance;
  };

  get msalReady() {
    return this.#ready;
  };

  #initMsal() {
    const msalConfig = {
      auth: {
        clientId: env.MSAL_CLIENT_ID,
        authority: 'https://login.microsoftonline.com/' + env.MSAL_TENANT_ID,
        redirectUri: 'https://tahvel.edu.ee/',
      },
      cache: { cacheLocation: 'localStorage' },
    };
    this.#instance = new msal.PublicClientApplication(msalConfig);
  };

  #loadScript() {
    return new Promise((resolve) => {
      let gradeHistoryScript = document.getElementById('msal-script');

      function onMsalReady() {
        resolve();
      }

      if (!gradeHistoryScript) {
        gradeHistoryScript = document.createElement('script');
        gradeHistoryScript.id = 'msal-script';
        gradeHistoryScript.src = 'https://alcdn.msauth.net/browser/2.35.0/js/msal-browser.min.js';
        gradeHistoryScript.type = 'text/javascript';
        gradeHistoryScript.onload = onMsalReady;
        document.body.appendChild(gradeHistoryScript);
      } else if (window.msal && window.PublicClientApplication) {
        resolve();
      } else {
        gradeHistoryScript.onload = onMsalReady;
      }
    });
  }
};