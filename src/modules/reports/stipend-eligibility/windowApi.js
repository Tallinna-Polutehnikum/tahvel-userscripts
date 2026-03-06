import { normalizeGroupReport } from "./normalize.js";
import { aggregateAll } from "./aggregate.js";
import { exportStudentReportTsv, exportSubjectReportTsv, studentToTsvRow } from "./tsv.js";

function getRootWindow() {
  // Tampermonkey/Greasemonkey: expose into page context when possible
  // eslint-disable-next-line no-undef
  if (typeof unsafeWindow !== "undefined" && unsafeWindow) return unsafeWindow;
  if (typeof window !== "undefined" && window) return window;
  return null;
}

function getCookieValue(root, name) {
  try {
    const cookie = root?.document?.cookie ?? "";
    const parts = cookie.split(";");
    for (const p of parts) {
      const [k, ...rest] = p.trim().split("=");
      if (k === name) return rest.join("=");
    }
  } catch {
    // ignore
  }
  return null;
}

function createRequestHeaders(root) {
  const xsrf = getCookieValue(root, "XSRF-TOKEN");
  const headers = {
    Accept: "application/json, text/plain, */*",
    "X-Requested-With": "XMLHttpRequest"
  };

  if (xsrf) headers["X-XSRF-TOKEN"] = decodeURIComponent(xsrf);
  return headers;
}

async function fetchJsonWithAuth(root, url) {
  const res = await root.fetch(url, {
    credentials: "include",
    headers: createRequestHeaders(root)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed (${res.status}) ${url}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

function normalizeCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function findExactAutocompleteMatch(candidates, groupCode) {
  const wanted = normalizeCode(groupCode);
  if (!wanted || !Array.isArray(candidates)) return null;

  return (
    candidates.find(c => normalizeCode(c?.nameEt) === wanted) ??
    candidates.find(c => normalizeCode(c?.nameEn) === wanted) ??
    candidates.find(c => normalizeCode(c?.nameRu) === wanted) ??
    null
  );
}

async function fetchAllStudentGroups({
  apiBase,
  isValid = true,
  lang = "ET",
  size = 200,
  sort = "CODE",
  logger = console.warn
} = {}) {
  const root = getRootWindow();
  if (!root) throw new Error("No window context available");

  const base = apiBase ?? `${root.location.origin}/hois_back`;
  const all = [];

  let page = 0;
  let totalElements = null;
  let keepGoing = true;

  while (keepGoing) {
    const url = new URL(`${base}/studentgroups`);
    url.searchParams.set("isValid", String(Boolean(isValid)));
    url.searchParams.set("lang", String(lang));
    url.searchParams.set("page", String(page));
    url.searchParams.set("size", String(size));
    url.searchParams.set("sort", String(sort));

    const payload = await fetchJsonWithAuth(root, url.toString());
    const content = Array.isArray(payload?.content) ? payload.content : [];

    all.push(...content);

    if (typeof payload?.totalElements === "number") totalElements = payload.totalElements;

    const number = typeof payload?.number === "number" ? payload.number : page;
    const last = payload?.last === true;
    const totalPages = typeof payload?.totalPages === "number" ? payload.totalPages : null;

    if (last) {
      keepGoing = false;
    } else if (totalPages != null) {
      keepGoing = number + 1 < totalPages;
      page = number + 1;
    } else if (content.length >= size) {
      page += 1;
      keepGoing = true;
    } else {
      keepGoing = false;
    }
  }

  if (totalElements != null && all.length < totalElements) {
    try {
      logger("fetchAllStudentGroups fetched fewer groups than totalElements", {
        fetched: all.length,
        totalElements,
        size
      });
    } catch {
      // ignore
    }
  }

  return all;
}

async function fetchStudentGroupAutocomplete(groupCode, {
  apiBase,
  lang = "ET",
  basic = true,
  secondary = true,
  valid = true,
  vocational = true
} = {}) {
  const root = getRootWindow();
  if (!root) throw new Error("No window context available");

  const base = apiBase ?? `${root.location.origin}/hois_back`;

  const url = new URL(`${base}/autocomplete/studentgroups`);
  url.searchParams.set("basic", String(Boolean(basic)));
  url.searchParams.set("lang", String(lang));
  url.searchParams.set("name", String(groupCode));
  url.searchParams.set("secondary", String(Boolean(secondary)));
  url.searchParams.set("valid", String(Boolean(valid)));
  url.searchParams.set("vocational", String(Boolean(vocational)));

  const payload = await fetchJsonWithAuth(root, url.toString());
  return Array.isArray(payload) ? payload : [];
}

async function resolveGroupReportParams(groupCode, opts = {}) {
  const candidates = await fetchStudentGroupAutocomplete(groupCode, opts);
  const exact = findExactAutocompleteMatch(candidates, groupCode);

  return {
    groupCode,
    exactMatchFound: Boolean(exact),
    studentGroup: exact?.id ?? null,
    curriculumVersion: exact?.curriculumVersion ?? null,
    autocompleteMatch: exact ?? null,
    autocompleteCandidates: candidates
  };
}

async function resolveAllGroupReportParams({
  apiBase,
  logger = console.warn,
  concurrency = 6,
  ...opts
} = {}) {
  const groups = await fetchAllStudentGroups({ apiBase, logger, ...opts });
  const queue = groups.map(g => ({
    id: g?.id ?? null,
    code: g?.code ?? "",
    teacher: g?.teacher ?? null,
    curriculumVersionFromGroups: g?.curriculumVersion ?? null,
    source: g
  }));

  const results = new Array(queue.length);
  const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, 20));

  let index = 0;

  async function worker() {
    while (true) {
      const cur = index;
      index += 1;
      if (cur >= queue.length) return;

      const item = queue[cur];

      try {
        const resolved = await resolveGroupReportParams(item.code, { apiBase, ...opts });
        const finalStudentGroup = resolved.studentGroup ?? item.id;

        results[cur] = {
          groupCode: item.code,
          studentGroup: finalStudentGroup,
          curriculumVersion: resolved.curriculumVersion,
          exactMatchFound: resolved.exactMatchFound,
          groupIdFromStudentGroups: item.id,
          curriculumVersionFromStudentGroups: item.curriculumVersionFromGroups,
          teacher: item.teacher,
          autocompleteMatch: resolved.autocompleteMatch,
          autocompleteCandidates: resolved.autocompleteCandidates,
          source: item.source
        };
      } catch (error) {
        try {
          logger("Failed to resolve group report params", {
            groupCode: item.code,
            error: error?.message ?? String(error)
          });
        } catch {
          // ignore
        }

        results[cur] = {
          groupCode: item.code,
          studentGroup: item.id,
          curriculumVersion: item.curriculumVersionFromGroups,
          exactMatchFound: false,
          groupIdFromStudentGroups: item.id,
          curriculumVersionFromStudentGroups: item.curriculumVersionFromGroups,
          teacher: item.teacher,
          autocompleteMatch: null,
          autocompleteCandidates: [],
          source: item.source,
          error: error?.message ?? String(error)
        };
      }
    }
  }

  const workers = [];
  for (let i = 0; i < workerCount; i++) workers.push(worker());
  await Promise.all(workers);

  const unresolved = results.filter(r => !r?.exactMatchFound || r?.curriculumVersion == null);

  if (unresolved.length > 0) {
    try {
      logger("resolveAllGroupReportParams has unresolved groups", {
        unresolvedCount: unresolved.length,
        total: results.length,
        sample: unresolved.slice(0, 10).map(r => ({
          groupCode: r.groupCode,
          exactMatchFound: r.exactMatchFound,
          curriculumVersion: r.curriculumVersion
        }))
      });
    } catch {
      // ignore
    }
  }

  return {
    groups,
    resolved: results,
    unresolved,
    summary: {
      totalGroups: results.length,
      exactMatches: results.filter(r => r?.exactMatchFound).length,
      withCurriculumVersion: results.filter(r => r?.curriculumVersion != null).length,
      unresolved: unresolved.length
    }
  };
}

async function aggregateAndExportAllGroups({
  apiBase,
  logger = console.warn,
  resolverOptions,
  reportOptions,
  aggregationOptions,
  concurrency = 4,
  includeHeader = true,
  sortByName = true
} = {}) {
  const resolvedPack = await resolveAllGroupReportParams({
    apiBase,
    logger,
    ...(resolverOptions ?? {})
  });

  const resolved = Array.isArray(resolvedPack?.resolved) ? resolvedPack.resolved : [];
  const ready = resolved.filter(r => r?.studentGroup != null && r?.curriculumVersion != null);
  const skipped = resolved.filter(r => r?.studentGroup == null || r?.curriculumVersion == null);

  const normalizedGroups = [];
  const fetchErrors = [];

  const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, 20));
  let index = 0;

  async function worker() {
    while (true) {
      const cur = index;
      index += 1;
      if (cur >= ready.length) return;

      const item = ready[cur];

      try {
        const raw = await fetchGroupTeacherReport(item.groupCode, {
          apiBase,
          studentGroup: item.studentGroup,
          curriculumVersion: item.curriculumVersion,
          ...(reportOptions ?? {})
        });

        const normalized = normalizeGroupReport(raw, item.groupCode);
        if (!normalized) {
          throw new Error("normalizeGroupReport returned null");
        }

        normalizedGroups.push(normalized);
      } catch (error) {
        const failure = {
          groupCode: item.groupCode,
          studentGroup: item.studentGroup,
          curriculumVersion: item.curriculumVersion,
          error: error?.message ?? String(error)
        };

        fetchErrors.push(failure);

        try {
          logger("Failed to fetch/normalize group report", failure);
        } catch {
          // ignore
        }
      }
    }
  }

  const workers = [];
  for (let i = 0; i < workerCount; i++) workers.push(worker());
  await Promise.all(workers);

  const state = aggregateAll(normalizedGroups, {
    logger,
    ...(aggregationOptions ?? {})
  });
  const tsv = exportStudentReportTsv(state, { includeHeader, sortByName });

  const totalStudents = Object.values(state?.groups ?? {}).reduce((acc, arr) => {
    return acc + (Array.isArray(arr) ? arr.length : 0);
  }, 0);

  return {
    state,
    tsv,
    resolved,
    unresolved: resolvedPack?.unresolved ?? [],
    skipped,
    fetchErrors,
    summary: {
      totalGroupsDiscovered: resolved.length,
      groupsReadyForFetch: ready.length,
      groupsFetched: normalizedGroups.length,
      groupsSkipped: skipped.length,
      groupsFailed: fetchErrors.length,
      totalStudents
    }
  };
}

function toSerializableSnapshotData(data) {
  if (!data || typeof data !== "object") return data;

  const state = data?.state && typeof data.state === "object"
    ? {
        ...data.state,
        problematicJournalSet: [...(data.state.problematicJournalSet ?? [])]
      }
    : null;

  if (!state) return { ...data };
  return { ...data, state };
}

function fromSerializableSnapshotData(data) {
  if (!data || typeof data !== "object") return data;
  if (!data?.state || typeof data.state !== "object") return { ...data };

  const state = {
    ...data.state,
    problematicJournalSet: new Set(data.state.problematicJournalSet ?? [])
  };

  return { ...data, state };
}

function saveSnapshotToLocalStorage(data, { key = "stipendEligibilitySnapshot" } = {}) {
  const root = getRootWindow();
  if (!root) throw new Error("No window context available");
  if (!root.localStorage) throw new Error("localStorage is not available");

  const serializable = toSerializableSnapshotData(data);
  const payload = {
    ...serializable,
    savedAt: new Date().toISOString()
  };

  root.localStorage.setItem(String(key), JSON.stringify(payload));
  return payload;
}

function loadSnapshotFromLocalStorage({ key = "stipendEligibilitySnapshot" } = {}) {
  const root = getRootWindow();
  if (!root) throw new Error("No window context available");
  if (!root.localStorage) throw new Error("localStorage is not available");

  const raw = root.localStorage.getItem(String(key));
  if (!raw) return null;

  const parsed = JSON.parse(raw);
  return fromSerializableSnapshotData(parsed);
}

function buildStudentGroupTeacherReportUrl(
  base,
  {
    studentGroup,
    curriculumVersion,
    from,
    canceledStudents = false,
    graduatedStudents = false,
    lang = "ET",
    studyYear = "",
    weightedAverageGrade = true,
    entryType,
    entryTypes
  } = {}
) {
  if (studentGroup == null) throw new Error("studentGroup is required");
  if (curriculumVersion == null) throw new Error("curriculumVersion is required");

  const defaultEntryType = {
    SISSEKANNE_H: true,
    SISSEKANNE_R: true,
    SISSEKANNE_O: false,
    SISSEKANNE_L: true,
    SISSEKANNE_P: true,
    SISSEKANNE_T: true,
    SISSEKANNE_E: true,
    SISSEKANNE_I: true
  };

  const finalEntryType = entryType ?? defaultEntryType;
  const finalEntryTypes =
    entryTypes ??
    Object.keys(finalEntryType).filter(k => Boolean(finalEntryType[k]));

  const url = new URL(`${base}/reports/studentgroupteacher`);
  const sp = url.searchParams;

  sp.set("canceledStudents", String(Boolean(canceledStudents)));
  sp.set("curriculumVersion", String(curriculumVersion));
  sp.set("entryType", JSON.stringify(finalEntryType));
  for (const t of finalEntryTypes) sp.append("entryTypes", String(t));
  if (from) sp.set("from", String(from));
  sp.set("graduatedStudents", String(Boolean(graduatedStudents)));
  sp.set("lang", String(lang));
  sp.set("studentGroup", String(studentGroup));
  sp.set("studyYear", String(studyYear ?? ""));
  sp.set("weightedAverageGrade", String(Boolean(weightedAverageGrade)));

  return url.toString();
}

async function fetchGroupTeacherReport(
  groupCode,
  {
    apiBase,
    // New report endpoint params (copied from browser request)
    studentGroup,
    curriculumVersion,
    from,
    canceledStudents,
    graduatedStudents,
    lang,
    studyYear,
    weightedAverageGrade,
    entryType,
    entryTypes,
    // Force old endpoint if needed
    useLegacyTeacherEndpoint = false
  } = {}
) {
  const root = getRootWindow();
  if (!root) throw new Error("No window context available");

  const base = apiBase ?? `${root.location.origin}/hois_back`;

  // If caller provides the report params, prefer the real report endpoint.
  const shouldUseReportEndpoint =
    !useLegacyTeacherEndpoint &&
    (studentGroup != null || curriculumVersion != null || from != null || entryType != null || entryTypes != null);

  const url = shouldUseReportEndpoint
    ? buildStudentGroupTeacherReportUrl(base, {
        studentGroup,
        curriculumVersion,
        from,
        canceledStudents,
        graduatedStudents,
        lang,
        studyYear,
        weightedAverageGrade,
        entryType,
        entryTypes
      })
    : `${base}/teacher/studentGroupTeacherReport?studentGroupCode=${encodeURIComponent(groupCode)}`;

  return fetchJsonWithAuth(root, url);
}

async function buildStateForGroup(
  groupCode,
  {
    logger = console.warn,
    apiBase,
    aggregationOptions,
    ...fetchOpts
  } = {}
) {
  const raw = await fetchGroupTeacherReport(groupCode, { apiBase, ...fetchOpts });
  const normalized = normalizeGroupReport(raw, groupCode);
  if (!normalized) throw new Error("normalizeGroupReport returned null");
  return aggregateAll([normalized], {
    logger,
    ...(aggregationOptions ?? {})
  });
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
    exportSubjectReportTsv,
    studentToTsvRow,
    fetchAllStudentGroups,
    fetchStudentGroupAutocomplete,
    resolveGroupReportParams,
    resolveAllGroupReportParams,
    aggregateAndExportAllGroups,
    saveSnapshotToLocalStorage,
    loadSnapshotFromLocalStorage,
    fetchGroupTeacherReport,
    buildStudentGroupTeacherReportUrl,
    buildStateForGroup
  });
}

attachToWindow();
