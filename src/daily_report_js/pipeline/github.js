import path from 'node:path';
import { collectGithub } from '../collectors/github_trending.js';
import { processGithubRaw } from '../postprocessors/github.js';
import { renderHtml } from '../renderers/html.js';
import { renderMarkdown } from '../renderers/markdown.js';
import { renderPng } from '../renderers/png.js';
import { writeJson, writeText } from '../utils/io.js';
import { renderTemplate } from '../utils/template.js';
import { generateVerifiedReport } from './generate_verified_report.js';

export async function runGithub({ outDir, config, reportDate }) {
  console.log('\n🐙 [GITHUB] Fetching trending...');
  const secCfg = config.github || {};
  const llmCfg = config.llm || {};
  const outputCfg = config.output || {};
  const outputLanguage = String(outputCfg.language || 'zh-cn');
  const fixedTitle = String((outputCfg.section_titles || {}).github || '');
  const maxResults = Number(secCfg.max_results || 15);
  const maxRepairAttempts = Number((config.verify || {}).max_repair_attempts || 2);
  const directive = renderTemplate(secCfg.llm_directive || '', {
    max_items: maxResults,
    output_language: outputLanguage,
  });

  const raw = await collectGithub({ since: secCfg.since || 'daily', lang: '' });
  writeJson(path.join(outDir, 'raw.json'), raw);
  console.log(`  💾 raw.json: ${raw.count} repos`);

  console.log('  🧹 Post-processing github raw data...');
  const post = processGithubRaw(raw, { max_results: maxResults });
  writeJson(path.join(outDir, 'post.json'), post);
  console.log(`  💾 post.json: ${post.item_count} repos`);

  if (post.item_count === 0) {
    console.log('  ⚠  No github items collected — skipping LLM generation');
    return;
  }

  console.log('  🤖 Generating report JSON via LLM...');
  const report = await generateVerifiedReport({
    outDir,
    section: 'github',
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
  console.log(`  ✅ GitHub report done → ${outDir}`);
}
