import { Msal } from "./msal";
import * as env from 'env';

export class Authentication extends Msal {
  #accounts = [];

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
    if (this.#accounts.length === 0) return false;

    this.msalInstance.setActiveAccount(this.#accounts[0]);

    try {
      this.msalInstance.acquireTokenSilent({ scopes: [env.MSAL_CLIENT_ID + '/.default'], account: this.#accounts[0] });
      return true;
    } catch (error) {
      console.error('Token acquisition failed: ', error);
      return false;
    }
  };

  async getToken() {
    const silentRequest = { scopes: [env.MSAL_CLIENT_ID + '/.default'], account: this.#accounts[0] };

    if (!this.checkAuth()) {
      this.login();
      return null;
    }

    try {
      const response = await this.msalInstance.acquireTokenSilent(silentRequest);
      return await response.accessToken;
    }
    catch (error) {
      console.error('Silent token acquisition failed: ', error);
      this.login();
      return null;
    }
  };
};

// Old implementation
// scopes: ['openid', 'profile']