# Room Seat Info Columns

**Feature ID:** `rooms.seatInfo`

Injects four additional columns into the free-rooms table at `#/lessonplans/rooms`.

## Trigger
`location.hash.startsWith('#/lessonplans/rooms')`. Uses a nested `observeTargetChange` so the columns are re-injected each time Angular re-renders the table. The nested observer is disconnected and nulled via `cleanup()` when leaving the page.

## Injected columns

| Position | Header | Data field | Notes |
|----------|--------|-----------|-------|
| 3 | Arvuteid | `computers` | Count of computers |
| 4 | Pindala | `area` | Displayed as `{area}m²` |
| 5 | Tahvel | `board` | Board type string |
| 6 | OS | `os` | Operating system string |

Headers are only injected once (guarded by `isAlreadyApplied` on the `<thead>` row). Body cells are re-injected on every re-render (guarded on `<tbody tr:first-child>`).

The existing **Kohtade arv** (seats) column is filled from `match.seats` when a room is found in the dataset.

`cloneCellStyle` copies `padding`, `font`, `verticalAlign`, `lineHeight`, `height`, `borderTop`, `borderBottom`, and `textAlign` from the reference cell (column 2) to each new cell.

## Data source
`src/datasets/RoomDetails.js` — an array of objects:

```js
{
  roomNumber: string,   // must match the text in the Ruum column exactly
  seats: number,
  computers: number,
  area: number,         // m²
  board: string,
  os: string,
}
```

To add a new room, append a new entry to the array in `RoomDetails.js` with the exact room number string as it appears in the Tahvel UI.
