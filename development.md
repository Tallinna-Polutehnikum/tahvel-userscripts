# Development Guide

## Setup

```bash
npm install
npm run build   # outputs to build/
```

---

## Project Structure

```
docs/                  - explanations and guides of features
src/
  core/
    config.js          – shared constants (TAHVEL_API_URL)
    settings.js        – feature registry, isFeatureEnabled(), generateMenuItems()
    observer.js        – single MutationObserver, registerFeatureHandler()
    xhrInterceptor.js  – XHR patch, addXHRInterceptor(), shared state getters
  utils/
    auth.js            – getCsrfToken()
    misc.js            – getAllGroupDurations(), simulateTyping(), hook()
  modules/
    teachers.js        – coordinator: imports all features, starts observer
    journal/           – averageGrade, entryTooltips, batchAbsent, notifyStudent
    studentProfile/    – agePin, negativeResults, moduleLinks
    rja/               – parameters, summaryColumns
    journalList/       – todayJournals
    rooms/             – seatInfo
    gradeHistory/      – chart (MSAL auth, external API)
    reports/           – stipend-eligibility tools
  tahvel-userscripts.user.js  – top-level entry (imports teachers.js + misc)
  data-collector.js           – separate bundle for data collection
header1.js   – Tampermonkey metadata for main script
header2.js   – Tampermonkey metadata for data-collector
build/       – compiled output (do not edit)
```

---

## Adding a Feature

We have created some tools that help you add new features with minimal boilerplate. The main idea is to register a feature handler that reacts to DOM changes on specific pages.

There is mutation observer logic built in to avoid running the same code twice on Angular partial re-renders.

Angular already query data from the API when navigating to a page, so we can hook into the XHR responses to get the relevant data without needing to reverse-engineer Angular's internal state management or query twice.

Create a file under the relevant `src/modules/` subfolder. Register the feature and handler at module load time (side-effect import):

```js
// src/modules/journal/myFeature.js
import { registerFeature } from '../../core/settings.js';
import { registerFeatureHandler, addAppliedMarker, isAlreadyApplied } from '../../core/observer.js';

registerFeature({
  id: 'journal.myFeature',
  label: 'My feature label',
  description: 'Shown in Tampermonkey menu.',
  defaultEnabled: true,
});

registerFeatureHandler({
  featureId: 'journal.myFeature',
  match: () => window.location.href.includes('journal'),
  run() {
    const marker = document.querySelector('.some-element');
    if (!marker || isAlreadyApplied(marker)) return;
    // … DOM work …
    addAppliedMarker(marker);
  },
  cleanup() {
    // called when match() returns false (user navigated away)
  },
});
```

Then add a side-effect import in `src/modules/teachers.js`:

```js
import './journal/myFeature.js';
```

Run `npm run build`. The Tampermonkey menu entry is generated automatically.

---

## Feature Settings

`registerFeature` accepts an optional `settings` array for sub-settings (checkboxes nested under a feature).

```js
registerFeature({
  id: 'rja.parameters',
  label: 'RJA automaatne täitmine',
  defaultEnabled: true,
  settings: [
    {
      id: 'rja.oppetoetus',
      label: 'Õppetoetuse režiim',
      description: 'Muudab kuupäeva ja checkboxe.',
      defaultEnabled: false,
    },
  ],
});
```

Read a sub-setting anywhere via `isFeatureEnabled('rja.oppetoetus')`. State is persisted in `localStorage` under `tahvelUserscripts.features.{id}`.

---

## XHR Interceptors

Register an interceptor to react to API responses:

```js
import { addXHRInterceptor } from '../../core/xhrInterceptor.js';

addXHRInterceptor(
  url => url.match(/hois_back\/students\/\d+$/) !== null,
  data => {
    console.log('Student loaded', data.id);
  }
);
```

Three shared state getters are already wired up by `xhrInterceptor.js` and can be imported when needed:

```js
import {
  getCurrentStudent,
  getCurrentClassTeacherReport,
  getCurrentStudentModules,
} from '../../core/xhrInterceptor.js';
```

---

## Applied Markers

Angular re-renders the DOM on route changes. Use `data-userscript-applied` to avoid running the same code twice:

```js
import { addAppliedMarker, isAlreadyApplied } from '../../core/observer.js';

const row = document.querySelector('tbody tr');
if (row && !isAlreadyApplied(row)) {
  // … work …
  addAppliedMarker(row);
}
```

For nested observers that must be torn down on navigation, use `observeTargetChange` and return a cleanup from your handler.

---

## Build

```bash
npm run build
```

Outputs `build/tahvel-userscripts.user.js` and `build/data-collector.user.js`.  
The MSAL and SERVER_URL env warnings at build time are expected when no `.env` file is present – they do not affect the rest of the script.

