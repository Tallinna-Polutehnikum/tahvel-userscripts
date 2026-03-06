/**
 * XHR interception infrastructure.
 *
 * Patches XMLHttpRequest.prototype.open/send once. Feature modules (and this file)
 * register interceptors with addXHRInterceptor(filterFn, callback).
 *
 * Shared application state populated by interceptors is exported as getter functions
 * so feature modules can read the latest snapshot without coupling to mutation timing.
 */

/** @type {Array<{filterFn: function(string): boolean, callback: function(any): void}>} */
const xhrInterceptors = [];

/**
 * Register a handler that receives parsed JSON (or raw text on parse failure)
 * for every completed XHR whose URL satisfies filterFn.
 * @param {function(url: string): boolean} filterFn
 * @param {function(data: any): void} callback
 */
export function addXHRInterceptor(filterFn, callback) {
  xhrInterceptors.push({ filterFn, callback });
}

// Patch XMLHttpRequest once at module evaluation time.
const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (method, url) {
  this._requestURL = url;
  this._requestMethod = method;
  return originalOpen.apply(this, arguments);
};

XMLHttpRequest.prototype.send = function () {
  const xhr = this;
  this.addEventListener('readystatechange', function () {
    if (xhr.readyState !== XMLHttpRequest.DONE) return;

    for (const { filterFn, callback } of xhrInterceptors) {
      if (!filterFn(xhr._requestURL)) continue;
      try {
        callback(JSON.parse(xhr.responseText));
      } catch {
        callback(xhr.responseText);
      }
    }
  });
  return originalSend.apply(this, arguments);
};

// ---------------------------------------------------------------------------
// Shared application state
// ---------------------------------------------------------------------------

let _currentStudent = null;
let _currentClassTeacherReport = null;
let _currentStudentModules = null;

/** @returns {any|null} The last student object received from hois_back/students/{id} */
export function getCurrentStudent() {
  return _currentStudent;
}

/** @returns {any|null} The last class-teacher report from hois_back/reports/studentgroupteacher */
export function getCurrentClassTeacherReport() {
  return _currentClassTeacherReport;
}

/** @returns {any|null} The last vocational results from hois_back/students/{id}/vocationalResults */
export function getCurrentStudentModules() {
  return _currentStudentModules;
}

// ---------------------------------------------------------------------------
// Built-in interceptors
// ---------------------------------------------------------------------------

// Persist teacher and school IDs from the user-info endpoint.
addXHRInterceptor(
  url => url.includes('hois_back/changeUser') || url.includes('hois_back/user'),
  data => {
    if (data?.teacher) {
      localStorage.setItem('currentTeacherId', JSON.stringify(data.teacher));
    }
    if (data?.school?.id) {
      localStorage.setItem('schoolId', JSON.stringify(data.school.id));
    }
  }
);

// Populate shared RJA report state.
addXHRInterceptor(
  url => url.includes('hois_back/reports/studentgroupteacher'),
  data => {
    _currentClassTeacherReport = data;
  }
);

// Populate shared student state (exact student endpoint, no trailing sub-path).
addXHRInterceptor(
  url => url.match(/hois_back\/students\/\d+$/) !== null,
  data => {
    _currentStudent = data;
  }
);

// Populate shared student modules state.
addXHRInterceptor(
  url => url.match(/hois_back\/students\/\d+\/vocationalResults$/) !== null,
  data => {
    _currentStudentModules = data;
  }
);
