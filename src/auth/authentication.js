import { Msal } from "./msal";
import * as env from 'env';

export class Authentication extends Msal {
  #accounts = [];
  #msalToken = null;

  constructor() {
    super();

    this.init();
  };

  async init() {
    await this.msalReady;

    this.#accounts = this.msalInstance.getAllAccounts();
  };

  async login() {
    await this.msalReady;
    
    await this.msalInstance
      .loginPopup({ scopes: ['user.read'] })
      .catch(error => {
        console.error('Login failed:', error);
        return false;
      });

    this.#accounts = await this.msalInstance.getAllAccounts();
    
    return true;
  }

  checkAuth() {
    if (this.#accounts.length === 0) {
      return false;
    }

    this.msalInstance.setActiveAccount(this.#accounts[0]);

    return true;
  };

  async getToken() {
    const silentRequest = { scopes: [env.MSAL_CLIENT_ID + '/.default'], account: this.#accounts[0] };

    if (!this.checkAuth()) {
      return null;
    }

    if (!this.#msalToken) {
      try {
        const response = await this.msalInstance.acquireTokenSilent(silentRequest);
        this.#msalToken = response.accessToken;
      }
      catch (error) {
        console.error('Silent token acquisition failed. Acquiring token using popup', error);
        return null;
      }
    };

    return this.#msalToken;
  };
};

// Old implementation
// scopes: ['openid', 'profile']