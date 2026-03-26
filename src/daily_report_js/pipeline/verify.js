import { runValidation } from '../verify/validate_reports.js';

export function verifySection(reportDate, section, { fix = false } = {}) {
  console.log(`  🔎 Verifying ${section} report JSON...`);
  const result = runValidation({ date: reportDate, section, fix });
  return {
    passed: result.issueTotal === 0,
    ...result,
  };
}
