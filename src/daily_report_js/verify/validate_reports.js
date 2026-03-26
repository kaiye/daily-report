import fs from 'node:fs';
import path from 'node:path';
import { OUTPUT_DIR } from '../project.js';
import { getReportSections, getSectionSchema, REPORT_TOP_LEVEL_FIELDS } from '../schema/report_schema.js';

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

function normStr(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normUrl(value) {
  return normStr(value).replaceAll('&amp;', '&');
}

function normHandle(value) {
  return normStr(value).replace(/^@/, '');
}

function isSingleSentence(text) {
  const s = normStr(text);
  if (!s) return false;
  const sentenceMarks = s.match(/[。！？!?]/g) || [];
  return sentenceMarks.length <= 1;
}

function isValidHttpUrl(value) {
  try {
    const u = new URL(normUrl(value));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function pushIssue(issues, issue, options = {}) {
  issues.push(issue);
  if (options.log !== false) {
    console.log(issue.message);
  }
}

function loadSourceForValidation(dayDir, section) {
  const postPath = path.join(dayDir, section, 'post.json');
  const rawPath = path.join(dayDir, section, 'raw.json');
  if (fs.existsSync(postPath)) return loadJson(postPath);
  if (fs.existsSync(rawPath)) return loadJson(rawPath);
  return null;
}

function buildMediaExpected(source) {
  const items = (source?.items || []).map((item) => ({
    source: normStr(item.source),
    title: normStr(item.title),
    url: normUrl(item.url || item.link),
    published_at: normStr(item.published_at),
  })).filter((item) => item.url);

  const byUrl = new Map();
  const bySourceTime = new Map();
  const byTitle = new Map();

  for (const item of items) {
    byUrl.set(item.url, item);

    const sourceTimeKey = `${item.source}\t${item.published_at}`;
    if (!bySourceTime.has(sourceTimeKey)) bySourceTime.set(sourceTimeKey, []);
    bySourceTime.get(sourceTimeKey).push(item);

    if (item.title) {
      if (!byTitle.has(item.title)) byTitle.set(item.title, []);
      byTitle.get(item.title).push(item);
    }
  }

  return { items, byUrl, bySourceTime, byTitle };
}

function findMediaExpected(index, item) {
  const byUrl = index.byUrl.get(normUrl(item.url));
  if (byUrl) return byUrl;

  const sourceTimeKey = `${normStr(item.source)}\t${normStr(item.published_at)}`;
  const sourceTimeMatches = index.bySourceTime.get(sourceTimeKey) || [];
  if (sourceTimeMatches.length === 1) return sourceTimeMatches[0];

  const titleMatches = index.byTitle.get(normStr(item.title)) || [];
  if (titleMatches.length === 1) return titleMatches[0];

  return null;
}

function buildGithubExpected(source) {
  const items = (source?.items || []).map((item) => ({
    repo: normStr(item.repo),
    url: normUrl(item.url),
    language: normStr(item.language),
    stars_today: Number(item.stars_today || 0),
    stars_total: Number(item.stars_total || 0),
  })).filter((item) => item.repo);

  const byRepo = new Map();
  const byUrl = new Map();
  for (const item of items) {
    byRepo.set(item.repo, item);
    if (item.url) byUrl.set(item.url, item);
  }
  return { items, byRepo, byUrl };
}

function findGithubExpected(index, item) {
  const byRepo = index.byRepo.get(normStr(item.repo));
  if (byRepo) return byRepo;
  const byUrl = index.byUrl.get(normUrl(item.url));
  if (byUrl) return byUrl;
  return null;
}

function buildXExpected(source) {
  const items = (source?.items || []).map((item) => {
    const author = item.author || {};
    return {
      id: normStr(item.id),
      author_name: normStr(item.author_name || author.name),
      author_handle: normHandle(item.author_handle || author.userName || author.username),
      url: normUrl(item.url || item.twitterUrl),
      view_count: Number(item.view_count ?? item.viewCount ?? 0),
      like_count: Number(item.like_count ?? item.likeCount ?? 0),
    };
  }).filter((item) => item.id);

  const byId = new Map();
  const byUrl = new Map();
  const byHandle = new Map();
  for (const item of items) {
    byId.set(item.id, item);
    if (item.url) byUrl.set(item.url, item);
    if (item.author_handle && !byHandle.has(item.author_handle)) byHandle.set(item.author_handle, item);
  }
  return { items, byId, byUrl, byHandle };
}

function findXExpected(index, item) {
  const byId = index.byId.get(normStr(item.id));
  if (byId) return byId;
  const byUrl = index.byUrl.get(normUrl(item.url));
  if (byUrl) return byUrl;
  const byHandle = index.byHandle.get(normHandle(item.author_handle));
  if (byHandle) return byHandle;
  return null;
}

function getExpectedIndex(section, source) {
  if (section === 'media') return buildMediaExpected(source);
  if (section === 'github') return buildGithubExpected(source);
  return buildXExpected(source);
}

function findExpected(section, index, item) {
  if (section === 'media') return findMediaExpected(index, item);
  if (section === 'github') return findGithubExpected(index, item);
  return findXExpected(index, item);
}

function normalizeComparable(field, value) {
  if (field === 'url') return normUrl(value);
  if (field === 'author_handle') return normHandle(value);
  return normStr(value);
}

function validateTopLevel(report, section, reportDate, issues) {
  const unknownTopFields = Object.keys(report).filter((k) => !REPORT_TOP_LEVEL_FIELDS.includes(k));
  for (const k of unknownTopFields) {
    pushIssue(issues, {
      section,
      type: 'schema_unknown_top_field',
      message: `[${section}] schema: unknown top-level field "${k}"`,
      field: k,
    });
  }

  for (const f of REPORT_TOP_LEVEL_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(report, f)) {
      pushIssue(issues, {
        section,
        type: 'schema_missing_top_field',
        message: `[${section}] schema: missing top-level field "${f}"`,
        field: f,
      });
    }
  }

  if (normStr(report.section) !== section) {
    pushIssue(issues, {
      section,
      type: 'schema_section_mismatch',
      message: `[${section}] schema: section must be "${section}", got "${normStr(report.section)}"`,
      field: 'section',
    });
  }

  if (normStr(report.report_date).slice(0, 10) !== reportDate) {
    pushIssue(issues, {
      section,
      type: 'schema_report_date_mismatch',
      message: `[${section}] schema: report_date must match "${reportDate}", got "${normStr(report.report_date)}"`,
      field: 'report_date',
    });
  }

  if (!isSingleSentence(report.summary)) {
    pushIssue(issues, {
      section,
      type: 'schema_summary_not_single_sentence',
      message: `[${section}] schema: summary must be exactly one sentence`,
      field: 'summary',
    });
  }

  if (!Array.isArray(report.items)) {
    pushIssue(issues, {
      section,
      type: 'schema_items_not_array',
      message: `[${section}] schema: items must be an array`,
      field: 'items',
    });
  }
}

function validateItemSchema(report, section, issues) {
  const spec = getSectionSchema(section);
  const allowedFields = new Set(spec.requiredItemFields);
  const items = Array.isArray(report.items) ? report.items : [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      pushIssue(issues, {
        section,
        index: i + 1,
        type: 'schema_item_not_object',
        message: `[${section} #${i + 1}] schema: item must be an object`,
      });
      continue;
    }

    const itemFields = Object.keys(item);
    for (const field of itemFields) {
      if (!allowedFields.has(field)) {
        pushIssue(issues, {
          section,
          index: i + 1,
          type: 'schema_unknown_item_field',
          message: `[${section} #${i + 1}] schema: unknown field "${field}"`,
          field,
        });
      }
    }

    for (const field of spec.requiredItemFields) {
      const val = item[field];
      if (val === undefined || val === null || normStr(val) === '') {
        pushIssue(issues, {
          section,
          index: i + 1,
          type: 'schema_missing_field',
          message: `[${section} #${i + 1}] schema: missing required field "${field}"`,
          field,
        });
      }
    }

    if (!isValidHttpUrl(item.url || '')) {
      pushIssue(issues, {
        section,
        index: i + 1,
        type: 'schema_invalid_url',
        message: `[${section} #${i + 1}] schema: url must be a valid http(s) URL`,
        field: 'url',
      });
    }

    for (const field of spec.deterministicStringFields) {
      if (typeof item[field] !== 'string') {
        pushIssue(issues, {
          section,
          index: i + 1,
          type: 'schema_type_mismatch',
          message: `[${section} #${i + 1}] schema: field "${field}" must be string`,
          field,
        });
      }
    }

    for (const field of spec.deterministicNumberFields) {
      if (typeof item[field] !== 'number' || !Number.isFinite(item[field])) {
        pushIssue(issues, {
          section,
          index: i + 1,
          type: 'schema_type_mismatch',
          message: `[${section} #${i + 1}] schema: field "${field}" must be number`,
          field,
        });
      }
    }
  }
}

function validateDeterministicValues(report, section, expectedIndex, fix, issues) {
  const spec = getSectionSchema(section);
  const items = Array.isArray(report.items) ? report.items : [];
  let changed = 0;
  let manual = 0;

  const seenKeys = new Set();
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i] || {};
    const keyNorm = normalizeComparable(spec.keyField, item[spec.keyField]);
    if (keyNorm) {
      if (seenKeys.has(keyNorm)) {
        pushIssue(issues, {
          section,
          index: i + 1,
          type: 'value_duplicate_key',
          field: spec.keyField,
          message: `[${section} #${i + 1}] value: duplicate "${spec.keyField}" "${keyNorm}"`,
        });
        manual += 1;
      }
      seenKeys.add(keyNorm);
    }

    const expected = findExpected(section, expectedIndex, item);
    if (!expected) {
      pushIssue(issues, {
        section,
        index: i + 1,
        type: 'value_unresolved_item',
        message: `[${section} #${i + 1}] value: cannot map report item to post.json`,
      });
      manual += 1;
      continue;
    }

    for (const field of spec.deterministicStringFields) {
      const current = normalizeComparable(field, item[field]);
      const expectedValue = normalizeComparable(field, expected[field]);
      if (current === expectedValue) continue;

      pushIssue(issues, {
        section,
        index: i + 1,
        type: 'value_mismatch',
        field,
        message: `[${section} #${i + 1}] value: "${field}" mismatch: "${current}" -> "${expectedValue}"`,
        current,
        expected: expectedValue,
      });

      if (fix && expectedValue) {
        if (field === 'author_handle') {
          item[field] = expectedValue;
        } else {
          item[field] = expected[field];
        }
        changed += 1;
      } else {
        manual += 1;
      }
    }

    for (const field of spec.deterministicNumberFields) {
      const current = Number(item[field]);
      const expectedValue = Number(expected[field]);
      if (Number.isFinite(current) && Number.isFinite(expectedValue) && current === expectedValue) continue;

      pushIssue(issues, {
        section,
        index: i + 1,
        type: 'value_mismatch',
        field,
        message: `[${section} #${i + 1}] value: "${field}" mismatch: ${current} -> ${expectedValue}`,
        current,
        expected: expectedValue,
      });

      if (fix && Number.isFinite(expectedValue)) {
        item[field] = expectedValue;
        changed += 1;
      } else {
        manual += 1;
      }
    }
  }

  return { changed, manual };
}

function validateSection(dayDir, section, fix = false) {
  const reportPath = path.join(dayDir, section, 'report.json');
  if (!fs.existsSync(reportPath)) {
    console.log(`[${section}] skip: report.json missing`);
    return { changed: 0, manual: 0, issueTotal: 0, issues: [] };
  }

  const source = loadSourceForValidation(dayDir, section);
  if (!source) {
    console.log(`[${section}] skip: post/raw json missing`);
    return { changed: 0, manual: 0, issueTotal: 0, issues: [] };
  }

  let report;
  try {
    report = loadJson(reportPath);
  } catch (err) {
    const msg = err?.message || String(err);
    const issue = {
      section,
      type: 'json_invalid',
      message: `[${section}] report.json invalid JSON: ${msg}`,
    };
    console.log(issue.message);
    return { changed: 0, manual: 1, issueTotal: 1, issues: [issue] };
  }

  const issues = [];
  validateTopLevel(report, section, path.basename(dayDir), issues);
  validateItemSchema(report, section, issues);

  let changed = 0;
  let manual = issues.length;
  if (Array.isArray(report.items)) {
    const expectedIndex = getExpectedIndex(section, source);
    const deterministic = validateDeterministicValues(report, section, expectedIndex, fix, issues);
    changed += deterministic.changed;
    manual += deterministic.manual;
  }

  if (fix && changed > 0) {
    saveJson(reportPath, report);
    console.log(`[${section}] fixed ${changed} deterministic fields`);
  } else if (issues.length === 0) {
    console.log(`[${section}] ok`);
  }

  return { changed, manual, issueTotal: issues.length, issues };
}

export function runValidation({ date, section = 'all', fix = false, outputBase = OUTPUT_DIR }) {
  const dayDir = path.join(outputBase, date);
  if (!fs.existsSync(dayDir)) {
    throw new Error(`Date output directory not found: ${dayDir}`);
  }

  const allSections = getReportSections();
  const sections = section === 'all' ? allSections : [section];
  let changedTotal = 0;
  let manualTotal = 0;
  let issueTotal = 0;
  const issues = [];

  for (const s of sections) {
    const result = validateSection(dayDir, s, fix);
    changedTotal += result.changed;
    manualTotal += result.manual;
    issueTotal += result.issueTotal;
    issues.push(...(result.issues || []));
  }

  const remainingIssueTotal = fix ? manualTotal : issueTotal;
  console.log(`done: issue_total=${issueTotal}, fixed=${changedTotal}, remaining=${remainingIssueTotal}`);
  return { changedTotal, manualTotal, issueTotal, remainingIssueTotal, issues };
}

export function parseValidationArgs(argv) {
  const sectionOptions = ['all', ...getReportSections()];
  let date = '';
  let section = 'all';
  let fix = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--date') {
      date = argv[i + 1] || '';
      i += 1;
    } else if (arg === '--section') {
      section = argv[i + 1] || 'all';
      i += 1;
    } else if (arg === '--fix') {
      fix = true;
    } else if (arg === '-h' || arg === '--help') {
      console.log(`Usage: node scripts/validate_reports.js --date YYYY-MM-DD [--section ${sectionOptions.join('|')}] [--fix]`);
      process.exit(0);
    }
  }

  if (!date) {
    throw new Error('--date is required');
  }

  if (!sectionOptions.includes(section)) {
    throw new Error(`Invalid --section: ${section}`);
  }

  return { date, section, fix };
}
