# Grade History Chart

**Feature ID:** `gradeHistory`

Renders an interactive Chart.js line/bar graph of a student's grade history on their profile page.

## Trigger
URL hash contains `/results` or `/myResults`. Runs once per navigation (guarded by `#grade-history-marker` element presence). The marker is removed via `cleanup()` when navigating away.

## Authentication
Uses **MSAL** (Microsoft Authentication Library) to obtain a Bearer token for the external API. Requires environment variables at build time:

| Variable | Purpose |
|----------|---------|
| `MSAL_CLIENT_ID` | Azure AD app registration client ID |
| `MSAL_TENANT_ID` | Azure AD tenant ID |
| `SERVER_URL` | Base URL of the grade-history backend |

Token acquisition is attempted silently first (`acquireTokenSilent`); if that fails, a redirect is triggered.

## API call
`GET {SERVER_URL}/api/StudentRecord/StudentRecordsByStudentId?studentId={id}`

The student ID is read from the URL (`/students/{id}`).

## Chart modes
Three views are available (toggled by buttons injected above the chart):

| Mode | Chart type | Description |
|------|-----------|-------------|
| Timeline | Line | Grades over calendar time, one series per subject |
| Average | Bar | Average grade per subject, sorted descending |
| Distribution | Bar | Count of each grade value (1–5, MA, X) |

## DOM injection
The chart container (`#grade-history-marker`) is inserted before the first `.hois-collapse-parent` element on the page. The canvas is sized to `100% × 400px`.

## Dependencies
- `chart.js` — loaded via `@require` in the userscript header (CDN)
- `src/auth/authentication.js` — token helper
- `src/auth/msal.js` — MSAL config wrapper
- `src/modules/gradeHistory/gradeDataCollector.js` — data collection and submission module

## Data Collection & Submission

The grade history feature relies on a **separate backend service** (in another repository) to store and retrieve grade data. The data collection process is handled by `gradeDataCollector.js`:

### Collection workflow
1. **Group fetching**: Retrieves all student groups from Tahvel
2. **Grade aggregation**: For each group, fetches student data and categorizes grades:
   - Negative grades (X, MA, 1, 2)
   - Fine grades (3)
   - Good grades (4)
   - Great grades (5)
   - **Note:** SISSEKANNE_A (A = arvestatud/credited) is intentionally ignored as it's not a real grade and not comparable to grade 5. Drop in total grades count after fixing "MA" is a expected side-effect of this decision.
3. **Data deduplication**: Keeps the most complete student record when a student appears in multiple groups
4. **Backend submission**: POSTs aggregated student grade data to the backend
5. **Weekly scheduling**: Runs automatically on Mondays, cached to prevent duplicate runs

### API endpoints (backend service)
- `POST {SERVER_URL}/api/StudentRecord/switch` — WIP: Toggles transaction mode for batch operations
- `POST {SERVER_URL}/api/StudentRecord` — Submits individual student grade records

### Backend refactoring note
The `/switch` endpoint was originally implemented as a work-in-progress feature to manage database transactions for batch operations. However, this approach should be refactored to send the entire group dataset as a single array query instead of individual student records. This would:
- Improve performance by reducing API calls
- Simplify transaction handling
- Reduce network overhead

