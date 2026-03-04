import { normalizeGroupReport } from "./normalize.js";
import { aggregateAll } from "./aggregate.js";
import { exportStudentReportTsv, studentToTsvRow } from "./tsv.js";

function getRootWindow() {
  // Tampermonkey/Greasemonkey: expose into page context when possible
  // eslint-disable-next-line no-undef
  if (typeof unsafeWindow !== "undefined" && unsafeWindow) return unsafeWindow;
  if (typeof window !== "undefined" && window) return window;
  return null;
}

async function fetchGroupTeacherReport(groupCode, { apiBase } = {}) {
  const root = getRootWindow();
  if (!root) throw new Error("No window context available");

  const base = apiBase ?? `${root.location.origin}/hois_back`;
  const url = `${base}/teacher/studentGroupTeacherReport?studentGroupCode=${encodeURIComponent(groupCode)}`;

  const res = await root.fetch(url, { credentials: "include" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to fetch group report (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function buildStateForGroup(groupCode, { logger = console.warn, apiBase } = {}) {
  const raw = await fetchGroupTeacherReport(groupCode, { apiBase });
  const normalized = normalizeGroupReport(raw, groupCode);
  if (!normalized) throw new Error("normalizeGroupReport returned null");
  return aggregateAll([normalized], { logger });
}

function attachToWindow() {
  const root = getRootWindow();
  if (!root) return;

  if (!root.reports) root.reports = {};
  if (!root.reports.stipend) root.reports.stipend = {};

  Object.assign(root.reports.stipend, {
    normalizeGroupReport,
    aggregateAll,
    exportStudentReportTsv,
    studentToTsvRow,
    fetchGroupTeacherReport,
    buildStateForGroup
  });
}

attachToWindow();
