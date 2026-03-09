import './modules/sessionKeepAlive.js';
import { collectAndAggregateGradeData, maybeRunGradeDataForCurrentWeek } from './modules/gradeHistory/gradeDataCollector.js';

if (typeof globalThis.GM_registerMenuCommand === 'function') {
	globalThis.GM_registerMenuCommand('Run student data collection now', () => {
		void collectAndAggregateGradeData({ source: 'menu' });
	});
}

void maybeRunGradeDataForCurrentWeek();

