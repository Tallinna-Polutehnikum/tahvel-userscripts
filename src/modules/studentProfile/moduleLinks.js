/**
 * Feature: Module protocol links and journal links on the "Õppekava täitmine" tab.
 *
 * For each curriculum module in the student's profile, injects links to existing
 * module protocols and a "Uus protokoll" button to create new ones.
 * For each journal row, injects a link to open the journal directly.
 *
 * Depends on getCurrentStudent() and getCurrentStudentModules() being populated
 * by the XHR interceptors before this feature runs.
 *
 * See docs/student-profile-links.md for the full fetch chain.
 */

import { registerFeature } from '../../core/settings.js';
import { registerFeatureHandler, addAppliedMarker, isAlreadyApplied } from '../../core/observer.js';
import { TAHVEL_API_URL } from '../../core/config.js';
import { getCurrentStudent, getCurrentStudentModules } from '../../core/xhrInterceptor.js';
import { getCsrfToken } from '../../utils/auth.js';

registerFeature({
  id: 'studentProfile.moduleLinks',
  label: 'Mooduli protokollide ja päevikute lingid',
  description: 'Lisab "Õppekava täitmine" vahekaardile lingid mooduli protokollidele ja päevikutele, ning nupu uue protokolli loomiseks.',
  defaultEnabled: true,
});

registerFeatureHandler({
  featureId: 'studentProfile.moduleLinks',
  match: url => /students\/.*\/results/.test(url),
  async run(url, dom) {
    if (!dom.querySelector(`.md-active[aria-label='Õppekava täitmine']`)) return;

    const studentId = url.match(/students\/(\d+)/)?.[1];
    const firstModule = dom.querySelector('.hois-collapse-parent div:first-of-type > span');

    if (!firstModule || isAlreadyApplied(firstModule)) return;

    const currentStudent = getCurrentStudent();
    if (currentStudent?.id != studentId) return;

    addAppliedMarker(firstModule);
    await studentProfileModuleAndJournalLinks(studentId);
  },
});

async function studentProfileModuleAndJournalLinks(studentId) {
  const currentStudent = getCurrentStudent();
  const currentStudentModules = getCurrentStudentModules();

  const curriculumVersionId = currentStudent?.curriculumVersion?.id;
  const groupCode = currentStudent?.curriculumVersion?.code;

  const modulesDom = document.querySelectorAll(
    '.hois-collapse-parent div:not(.subtext):not([ng-if]):first-of-type > span'
  );
  const journalsDom = document.querySelectorAll('.hois-collapse-body .tahvel-table td:first-of-type > span');

  const moduleProtocolsResponse = await fetch(
    `${TAHVEL_API_URL}/moduleProtocols?isVocational=true&curriculumVersion=${curriculumVersionId}&lang=ET&page=0&size=75`,
    { headers: { accept: 'application/json' } }
  );
  const moduleProtocols = await moduleProtocolsResponse.json();

  modulesDom.forEach(moduleDom => {
    const moduleName = moduleDom.textContent.trim().replace(/\s*\([^)]*\)$/, '');

    // Inject links to existing protocols
    moduleProtocols.content
      .filter(mp =>
        mp.studentGroups.includes(groupCode) &&
        mp.curriculumVersionOccupationModules?.[0]?.nameEt === moduleName
      )
      .forEach(mp => {
        const a = document.createElement('a');
        a.href = `#/moduleProtocols/module/${mp.id}/edit`;
        a.target = '_blank';
        a.textContent = mp.id;
        a.style.cssText = 'padding-right:5px;font-weight:bold;color:var(--color-new-primary-blue-1);text-decoration:none';
        moduleDom.appendChild(a);
      });

    // Inject "Uus protokoll" button
    const moduleData = currentStudentModules?.curriculumModules?.find(
      m => m.curriculumModule.nameEt === moduleName
    );
    if (!moduleData) return;

    const newLink = document.createElement('a');
    newLink.textContent = 'Uus protokoll';
    newLink.style.cssText =
      'padding-right:5px;color:var(--color-new-primary-blue-1);text-decoration:none;text-transform:none;border:1px solid var(--color-new-primary-blue-1);white-space:nowrap';

    newLink.addEventListener('click', async () => {
      newLink.style.pointerEvents = 'none';
      newLink.style.color = 'gray';
      newLink.textContent = 'Laeb...';

      const restore = () => {
        newLink.style.pointerEvents = '';
        newLink.style.color = 'var(--color-new-primary-blue-1)';
        newLink.textContent = 'Uus protokoll';
      };

      const studyYearRes = await fetch(`${TAHVEL_API_URL}/school/studyYear/current-or-next-dto`, {
        credentials: 'include',
        headers: { Accept: 'application/json, text/plain, */*' },
      });
      const studyYear = await studyYearRes.json();

      const studentsRes = await fetch(
        `${TAHVEL_API_URL}/moduleProtocols/occupationModule/${studyYear.id}/${moduleData.id}`,
        { credentials: 'include', headers: { Accept: 'application/json, text/plain, */*' } }
      );
      const students = await studentsRes.json();

      if (!(currentStudent.curriculumVersion.id && studyYear.id && students.teacher?.id && moduleData.id)) {
        console.error('Missing data for new protocol', { moduleData, students, studyYear, currentStudent });
        alert('Tekkis viga, vaata konsooli.');
        restore();
        return;
      }

      const confirmText =
        `Oled loomas uut protokolli moodulile ${moduleName}. ` +
        `Moodulile määratakse õppeaasta ${studyYear.nameEt}, ` +
        `õpetajaks ${students.teacher.nameEt} ja lisatakse ${students.occupationModuleStudents.length} õpilast.`;

      if (!confirm(confirmText)) { restore(); return; }

      const newModuleRes = await fetch(`${TAHVEL_API_URL}/moduleProtocols`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json;charset=utf-8',
          'X-XSRF-TOKEN': getCsrfToken(),
        },
        method: 'POST',
        body: JSON.stringify({
          protocolVdata: {
            curriculumVersionOccupationModule: moduleData.id,
            curriculumVersion: currentStudent.curriculumVersion.id,
            studyYear: studyYear.id,
            teacher: students.teacher.id,
          },
          protocolStudents: students.occupationModuleStudents.map(s => ({ studentId: s.studentId })),
          type: 'module',
          isBasic: false,
          isSecondary: false,
          isHigher: false,
          isVocational: true,
        }),
      });
      const newModule = await newModuleRes.json();
      window.open(`#/moduleProtocols/module/${newModule.id}/edit`, '_blank');
      restore();
    });

    moduleDom.appendChild(newLink);
  });

  // Journal links
  const journalsRes = await fetch(
    `${TAHVEL_API_URL}/students/${studentId}/vocationalConnectedEntities`,
    { headers: { accept: 'application/json' } }
  );
  const vocationalEntities = await journalsRes.json();

  journalsDom.forEach(journalDom => {
    const journalName = journalDom.textContent.trim().replace(/\s*\([^)]*\)$/, '');
    vocationalEntities
      .filter(e => e.type === 'journal' && e.nameEt === journalName)
      .forEach(e => {
        const a = document.createElement('a');
        a.href = `#/journal/${e.entityId}/edit`;
        a.target = '_blank';
        a.textContent = e.entityId;
        a.style.paddingRight = '5px';
        journalDom.appendChild(a);
      });
  });
}
