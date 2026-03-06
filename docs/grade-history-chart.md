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
