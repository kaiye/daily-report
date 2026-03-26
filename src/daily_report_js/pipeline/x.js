import path from 'node:path';
import { collectX } from '../collectors/x_twitter.js';
import { processXRaw } from '../postprocessors/x.js';
import { renderHtml } from '../renderers/html.js';
import { renderMarkdown } from '../renderers/markdown.js';
import { renderPng } from '../renderers/png.js';
import { writeJson, writeText } from '../utils/io.js';
import { renderTemplate } from '../utils/template.js';
import { inferUtcDateFromReportDate } from '../utils/time.js';
import { generateVerifiedReport } from './generate_verified_report.js';

export async function runX({ outDir, config, reportDate, keywords }) {
  console.log('\n🐦 [X] Fetching tweets via TwitterAPI.io...');
  const secCfg = config.x || {};
  const ppCfg = (config.post_process || {}).x || {};
  const llmCfg = config.llm || {};
  const outputCfg = config.output || {};
  const outputLanguage = String(outputCfg.language || 'zh-cn');
  const fixedTitle = String((outputCfg.section_titles || {}).x || '');
  const topN = Number(secCfg.top_n || 10);
  const maxRepairAttempts = Number((config.verify || {}).max_repair_attempts || 2);
  const directive = renderTemplate(secCfg.llm_directive || '', {
    max_items: topN,
    output_language: outputLanguage,
  });

  const utcDate = inferUtcDateFromReportDate(reportDate);
  let raw;
  try {
    raw = await collectX({
      keywords,
      minFaves: Number(secCfg.min_faves || 1000),
      utcDate,
    });
  } catch (err) {
    console.log(`  ⚠  ${err.message || String(err)} — skipping X section`);
    return;
  }

  writeJson(path.join(outDir, 'raw.json'), raw);
  console.log(`  💾 raw.json: ${raw.raw_count} tweets`);

  console.log('  🧹 Post-processing X raw data...');
  const post = processXRaw(raw, utcDate, {
    min_text_length: Number(ppCfg.min_text_length || 20),
    max_items: Number(ppCfg.max_items || 0),
  });
  writeJson(path.join(outDir, 'post.json'), post);
  console.log(`  💾 post.json: ${post.item_count} tweets`);

  if (post.item_count === 0) {
    console.log('  ⚠  No tweets collected — skipping LLM generation');
    return;
  }

  console.log('  🤖 Generating report JSON via LLM...');
  const report = await generateVerifiedReport({
    outDir,
    section: 'x',
    post,
    reportDate,
    directive,
    llmCfg,
    fixedTitle,
    maxRepairAttempts,
  });

  writeText(path.join(outDir, 'report.md'), renderMarkdown(report));
  const html = renderHtml(report);
  writeText(path.join(outDir, 'report.html'), html);
  await renderPng(html, path.join(outDir, 'report.png'));
  console.log(`  ✅ X report done → ${outDir}`);
}
