export class GraphComponents {
  #graph;
  #login;
  #loading;

  #isLoginVisible = false;
  #isLoadingVisible = false;

  constructor({graph, login, loading}) {
    if (!graph || !login || !loading) {
      console.error({ graph, login, loading });
      throw new Error("GraphComponents: missing DOM elements");
    }
    
    this.#graph = graph;
    this.#login = login;
    this.#loading = loading;
  }

  get graphComponent() {
    return this.#graph;
  };

  get isLoginVisible() {
    return this.#isLoginVisible;
  }

  get isLoadingVisible() {
    return this.#isLoadingVisible;
  }

  showLogin() {
    this.#isLoginVisible = true;
    this.#login.style.display = "flex";
  }

  hideLogin() {
    this.#isLoginVisible = false;
    this.#login.style.display = "none";
  }

  showLoading() {
    this.#isLoadingVisible = true;
    this.#loading.style.display = "flex";
  }

  hideLoading() {
    this.#isLoadingVisible = false;
    this.#loading.style.display = "none";
  }
};