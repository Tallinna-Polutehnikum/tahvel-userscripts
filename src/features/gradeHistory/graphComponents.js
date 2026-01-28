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

  toggleLogin() {
    this.#isLoginVisible = !this.#isLoginVisible;
    this.#login.style.display = this.#isLoginVisible ? "flex" : "none";
  }

  toggleLoading() {
    this.#isLoadingVisible = !this.#isLoadingVisible;
    this.#loading.style.display = this.#isLoadingVisible ? "flex" : "none";
  }
};