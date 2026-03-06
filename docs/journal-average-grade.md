# Journal Average Grade Column

Adds two extra columns per grading period to the journal student table: **Keskm.** (average) and **Summa** (total score). Also colours existing period-grade cells and adds a **Perioodide hinded** column before the final grade when multiple periods exist.

## Feature ID
`journal.averageGrade`

## Trigger
URL contains `journal` and the `.tahvel-table` has more than two rows.

## Column detection
| Column type | Header style `background-color` |
|-------------|----------------------------------|
| Regular grade columns | none (used as inputs) |
| Perioodi hinne (period grade) | `rgb(224, 231, 255)` – blue |
| Lõpptulemus (final grade) | `rgb(249, 168, 212)` – pink |

If no period-grade columns are found, the final grade column (or last column) is used as a fallback.

## Average calculation
- Grades containing `/` are split and the **last token** taken (latest override).
- `MA` and `X` are treated as `0`.
- Non-numeric values are ignored.
- Result: `(total / count).toFixed(1)`.

## Colour scale (average column)
| Grade | Background |
|-------|-----------|
| 5, 4  | `#b3ffb3` light green |
| 3     | `#ffffb3` light yellow |
| 2, 1, 0 | `#ffb3b3` light red |

## Total-score colour scale (sum column)
Normalised against the second-highest total in the column:
- `normalised > 0.6` → green gradient `rgb(255 − n×76, 255, 255 − n×76)`
- otherwise → red gradient `rgb(255, 255 − n×76, 255 − n×76)`

## columnBackgroundColors
Separately applies a semi-transparent tint to every body cell that falls under a coloured header (`background:` CSS on `.bordered` `<th>`). Opacity is `0.2` when the darkest RGB channel is below 120, otherwise `0.5`.
