import path from 'node:path';
import { generateSectionReport, repairSectionReport } from '../generators/llm_report.js';
import { writeJson } from '../utils/io.js';
import { verifySection } from './verify.js';

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

  let report = applyFixedTitle(
    await generateSectionReport(section, post, reportDate, directive, llmCfg),
  );

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

    report = applyFixedTitle(await repairSectionReport(
      section,
      post,
      reportDate,
      directive,
      llmCfg,
      report,
      verification.issues || [],
    ));
  }

  throw new Error(`Unexpected verification loop exit for section=${section}`);
}
