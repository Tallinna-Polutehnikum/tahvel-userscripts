# Student Profile – Module Protocol & Journal Links

**Feature ID:** `studentProfile.moduleLinks`

Adds clickable links and action buttons to the **Õppekava täitmine** (curriculum fulfilment) tab of a student's profile page.

## Trigger
- URL matches `/students/.*/results`
- The **Õppekava täitmine** tab is active (`aria-label` match)
- `currentStudent.id` (from XHR interceptor) matches the `studentId` in the URL

## Data dependencies
| Variable | Source |
|----------|--------|
| `currentStudent` | XHR intercept of `hois_back/students/{id}` |
| `currentStudentModules` | XHR intercept of `hois_back/students/{id}/vocationalResults` |
| CSRF token | `getCsrfToken()` reads `XSRF-TOKEN` cookie |

## Module section (`.hois-collapse-parent`)
For every module span the feature:
1. Fetches `hois_back/moduleProtocols?isVocational=true&curriculumVersion={id}&lang=ET&page=0&size=75`.
2. Filters protocols whose `studentGroups` includes the current group code and whose first `curriculumVersionOccupationModules` name matches the module name (brackets stripped).
3. Appends a bold blue `<a>` link per matching protocol (opens in new tab).
4. Adds a **Uus protokoll** button that, on click:
   - Fetches `/school/studyYear/current-or-next-dto` for the current study year.
   - Fetches `/moduleProtocols/occupationModule/{studyYearId}/{moduleId}` for student list and default teacher.
   - Shows a `confirm()` dialog summarising the planned protocol.
   - On confirmation, `POST`s to `/moduleProtocols` with `X-XSRF-TOKEN` header and opens the new protocol in a new tab.

## Journal section (`.hois-collapse-body`)
Fetches `hois_back/students/{id}/vocationalConnectedEntities` and appends an `<a>` link (entity ID as label) for each journal whose `nameEt` matches the journal span text (brackets stripped).
