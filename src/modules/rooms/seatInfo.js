/**
 * Feature: Inject extra columns (computers, area, board, OS) into the free-rooms table.
 *
 * Reads room metadata from the static RoomDetails dataset and injects four new
 * columns after the existing "seats" column. Also fills in the seat count from
 * the dataset where the Tahvel-provided value may be missing.
 *
 * See docs/room-seat-info.md for the dataset structure and how to add new rooms.
 */

import { registerFeature } from '../../core/settings.js';
import { registerFeatureHandler, addAppliedMarker, isAlreadyApplied, observeTargetChange } from '../../core/observer.js';
import { RoomDetails } from '../../datasets/RoomDetails.js';

registerFeature({
  id: 'rooms.seatInfo',
  label: 'Ruumide lisainfo (arvutid, pindala, tahvel, OS)',
  description: 'Lisab vabade ruumide tabelisse arvutite arvu, pindala, tahvli ja operatsioonisüsteemi veerud.',
  defaultEnabled: true,
});

// The rooms view uses its own nested observer because the table re-renders
// independently on filter changes while the hash stays the same.
let roomsObserver = null;

registerFeatureHandler({
  featureId: 'rooms.seatInfo',
  match: url => url.includes('#/lessonplans/rooms') || location.hash.startsWith('#/lessonplans/rooms'),
  run() {
    if (roomsObserver) return; // Already watching
    roomsObserver = observeTargetChange(document.body, () => {
      injectSeatInfoToColumn(RoomDetails);
    });
  },
  cleanup() {
    if (roomsObserver) {
      roomsObserver.disconnect();
      roomsObserver = null;
    }
  },
});

function cloneCellStyle(fromEl, toEl) {
  const s = window.getComputedStyle(fromEl);
  toEl.style.padding      = s.padding;
  toEl.style.font         = s.font;
  toEl.style.verticalAlign = s.verticalAlign;
  toEl.style.lineHeight   = s.lineHeight;
  toEl.style.height       = s.height;
  toEl.style.borderTop    = s.borderTop;
  toEl.style.borderBottom = s.borderBottom;
  toEl.style.textAlign    = s.textAlign;
}

function injectSeatInfoToColumn(roomData) {
  const table     = document.querySelector('table.md-table');
  const firstRow  = table?.querySelector('tbody tr');
  const headerRow = table?.querySelector('thead tr');

  if (!table || !firstRow) return;

  if (!isAlreadyApplied(headerRow)) {
    const insertHeader = (text, position, ref) => {
      const th = document.createElement('th');
      th.textContent = text;
      headerRow.insertBefore(th, headerRow.children[position]);
      cloneCellStyle(ref, th);
    };
    const ref = headerRow.children[2];
    insertHeader('Arvuteid', 3, ref);
    insertHeader('Pindala',  4, ref);
    insertHeader('Tahvel',   5, ref);
    insertHeader('OS',       6, ref);
    addAppliedMarker(headerRow);
  }

  if (isAlreadyApplied(firstRow)) return;

  const headerCells    = table.querySelectorAll('thead th');
  const headers        = Array.from(headerCells).map(th =>
    th.textContent.trim().replace(/\s+/g, '').toLowerCase()
  );
  const roomColIndex   = headers.findIndex(t => t === 'ruum');
  const seatsColIndex  = headers.findIndex(t => t === 'kohtadearv') - 4; // 4 new cols before seats

  table.querySelectorAll('tbody tr').forEach(row => {
    const cells    = row.querySelectorAll('td');
    const roomText = cells[roomColIndex]?.textContent.trim() ?? '';
    const match    = roomData.find(r => r.roomNumber === roomText);

    if (match && seatsColIndex >= 0) cells[seatsColIndex].textContent = String(match.seats);

    const ref = row.children[2];
    const insertCell = (value, position) => {
      const td = document.createElement('td');
      td.textContent = value ?? '';
      row.insertBefore(td, row.children[position]);
      cloneCellStyle(ref, td);
    };
    insertCell(match?.computers,                  3);
    insertCell(match?.area ? `${match.area}m²` : '', 4);
    insertCell(match?.board,                      5);
    insertCell(match?.os,                         6);
  });

  addAppliedMarker(firstRow);
}
