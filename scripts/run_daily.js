#!/usr/bin/env node
import path from 'node:path';
import { loadConfig, loadRssSources, loadXKeywords, parseArgs } from '../src/daily_report_js/config.js';
import { OUTPUT_DIR } from '../src/daily_report_js/project.js';
import { runGithub } from '../src/daily_report_js/pipeline/github.js';
import { runMedia } from '../src/daily_report_js/pipeline/media.js';
import { runX } from '../src/daily_report_js/pipeline/x.js';
import { ensureDir } from '../src/daily_report_js/utils/io.js';

async function main() {
  const { reportDate, section } = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const baseOut = path.join(OUTPUT_DIR, reportDate);
  ensureDir(baseOut);

  console.log(`📅 Report date: ${reportDate}`);
  console.log(`📁 Output dir:  ${baseOut}`);

  const sections = section === 'all' ? ['media', 'github', 'x'] : [section];
  const rssSources = loadRssSources();
  const xKeywords = loadXKeywords();

  for (const s of sections) {
    const outDir = path.join(baseOut, s);
    ensureDir(outDir);

    if (s === 'media') {
      await runMedia({
        outDir,
        outputRoot: OUTPUT_DIR,
        config,
        reportDate,
        sources: rssSources,
        priorityKeywords: xKeywords,
      });
    } else if (s === 'github') {
      await runGithub({ outDir, config, reportDate });
    } else if (s === 'x') {
      await runX({ outDir, config, reportDate, keywords: xKeywords });
    }
  }

  console.log(`\n🎉 All done! Output: ${baseOut}`);
}

main().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});
