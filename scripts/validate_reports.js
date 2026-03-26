#!/usr/bin/env node
import { runValidation, parseValidationArgs } from '../src/daily_report_js/verify/validate_reports.js';

try {
  const args = parseValidationArgs(process.argv.slice(2));
  const { remainingIssueTotal } = runValidation(args);
  if (remainingIssueTotal > 0) process.exit(2);
} catch (err) {
  console.error(err.message || String(err));
  process.exit(1);
}
