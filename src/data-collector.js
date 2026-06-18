import './modules/sessionKeepAlive.js';
import {
  collectStudentData,
  autoRunCollectStudentData
} from './modules/studentData.js';

if (typeof globalThis.GM_registerMenuCommand === 'function') {
	globalThis.GM_registerMenuCommand('Run student data collection now', () => {
		void collectStudentData(/*{ source: 'menu' }*/);
	});
}

void autoRunCollectStudentData();
