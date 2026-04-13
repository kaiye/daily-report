import path from 'node:path';
import { generateSectionReport, repairSectionReport } from '../generators/llm_report.js';
import { writeJson } from '../utils/io.js';
import { verifySection } from './verify.js';

function buildSourceIndex(section, post) {
  const byKey = new Map();
  for (const item of (post?.items || [])) {
    if (section === 'github' && item?.repo) byKey.set(String(item.repo), item);
    if (section === 'media' && (item?.url || item?.link)) byKey.set(String(item.url || item.link), item);
    if (section === 'x' && item?.id) byKey.set(String(item.id), item);
  }
  return byKey;
}

function fillMissingRequiredFields(section, report, post) {
  const sourceIndex = buildSourceIndex(section, post);
  const items = Array.isArray(report?.items) ? report.items : [];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;

    if (section === 'github') {
      const source = sourceIndex.get(String(item.repo || ''));
      if (!item.description || !String(item.description).trim()) {
        const sourceDescription = String(source?.description || '').trim();
        if (sourceDescription) {
          item.description = sourceDescription;
        } else {
          const repoName = String(item.repo || '').split('/').pop() || '该项目';
          item.description = `仓库原始描述缺失，项目名为 ${repoName}。`;
        }
      }
    }

    if (section === 'media') {
      const source = sourceIndex.get(String(item.url || ''));
      if ((!item.summary || !String(item.summary).trim())) {
        item.summary = String(source?.summary || source?.description || item.title || '').trim();
      }
    }

    if (section === 'x') {
      const source = sourceIndex.get(String(item.id || ''));
      if ((!item.text || !String(item.text).trim()) && source?.text) {
        item.text = String(source.text).trim();
      }
    }
  }

  return report;
}

function cleanMediaSummary(report) {
  const items = Array.isArray(report?.items) ? report.items : [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const title = String(item.title || '').trim();
    let summary = String(item.summary || '').trim();
    const source = String(item.source || '').trim();
    if (!summary) continue;

    if (title) {
      const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      summary = summary.replace(new RegExp(`^${escapedTitle}[：:，,、—\\-\\s]*`), '').trim();
    }

    if (source) {
      const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      summary = summary.replace(new RegExp(`^${escapedSource}(称|报道|表示|指出|认为)?[：:，,、—\\-\\s]*`), '').trim();
    }

    item.summary = summary;
  }
  return report;
}

export async function generateVerifiedReport({
  outDir,
  section,
  post,
  reportDate,
  directive,
  llmCfg,
  fixedTitle = '',
  maxRepairAttempts = 2,
}) {
  const applyFixedTitle = (report) => {
    if (!fixedTitle) return report;
    return { ...report, title: fixedTitle };
  };

  let report = fillMissingRequiredFields(section, applyFixedTitle(
    await generateSectionReport(section, post, reportDate, directive, llmCfg),
  ), post);
  if (section === 'media') report = cleanMediaSummary(report);

  for (let attempt = 0; attempt <= maxRepairAttempts; attempt += 1) {
    writeJson(path.join(outDir, 'report.json'), report);

    const verification = verifySection(reportDate, section, { fix: false });
    if (verification.passed) {
      return report;
    }

    if (attempt >= maxRepairAttempts) {
      const examples = (verification.issues || []).slice(0, 3).map((i) => i.message).join('; ');
      throw new Error(
        `Verification failed after ${maxRepairAttempts + 1} attempts for section=${section}; issueTotal=${verification.issueTotal}; examples=${examples}`,
      );
    }

    console.log(
      `  ♻️  Verification failed (issues=${verification.issueTotal}). Asking LLM to repair report.json (attempt ${attempt + 1}/${maxRepairAttempts})...`,
    );

    report = fillMissingRequiredFields(section, applyFixedTitle(await repairSectionReport(
      section,
      post,
      reportDate,
      directive,
      llmCfg,
      report,
      verification.issues || [],
    )), post);
    if (section === 'media') report = cleanMediaSummary(report);
  }

  throw new Error(`Unexpected verification loop exit for section=${section}`);
}
