# Rühmajuhataja Aruanne (RJA) Enhancements

Two independent features improve the class-teacher report (*rühmajuhataja aruanne*) at `#/reports/studentgroupteacher`.

---

## 1 · Auto-fill Report Parameters

**Feature ID:** `rja.parameters`  
**Sub-setting:** `rja.oppetoetus` (default **off**)

Listens for group selection changes and automatically fills the start date, checkboxes, and study year.

### Date derivation
The group code is expected to contain a two-digit year (e.g. `IT22A`). The start date is set to **1 August** of `2000 + year`.

### Checkbox matrix (18 checkboxes, 1 = checked)

| Mode | Pattern |
|------|---------|
| Default | `1 1 0 1 1 1 1 1 0 0 0 0 0 0 0 0 0 0` |
| Õppetoetus | `1 1 0 1 1 1 1 1 0 0 0 0 0 1 1 0 0 0` |

When `rja.oppetoetus` is enabled:
- The end date is additionally set to **31 December of the previous year**.
- Checkboxes 14–15 (0-indexed 13–14) are also checked.

### Study year
After setting the date, the study year dropdown is opened and the **first option** is clicked (with a 120 ms delay for animation).

---

## 2 · Summary Columns

**Feature ID:** `rja.summaryColumns`  
**Sub-setting:** `rja.oppetoetusDownload` (default **off**)

Moves the summary columns to the front of the table (after the name column) and appends four new computed columns:

| Column | Description |
|--------|-------------|
| Neg. perioodi hinded | Count of period grades ending in MA / X / 1 / 2 |
| Neg. perioodi % | Percentage of above over all period grades |
| Neg. lõpuhinded | Count of negative final grades |
| Neg. lõpuhinde % | Percentage, colour-coded |

### Colour coding for Neg. lõpuhinde %
| Threshold | Background | Text |
|-----------|-----------|------|
| > 50 % | black | white |
| > 30 % | `#ff3333` | white |
| > 10 % | orange | black |
| > 0 % | yellow | black |
| 0 % | `#92D293` green | black |

### JSON download (oppetoetusDownload sub-setting)
When `rja.oppetoetusDownload` is enabled an XHR interceptor fires on every `hois_back/reports/studentgroupteacher` response. The raw JSON is offered as a download named after the current group selector value (falls back to `class-teacher-report.json`).
