import './modules/sessionKeepAlive.js';
import { calculateStudentData, maybeRunStudentDataForCurrentWeek } from './modules/studentData.js';

if (typeof globalThis.GM_registerMenuCommand === 'function') {
	globalThis.GM_registerMenuCommand('Run student data collection now', () => {
		void calculateStudentData({ source: 'menu' });
	});
}

void maybeRunStudentDataForCurrentWeek();

