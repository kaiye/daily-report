import path from 'node:path';
import { collectMedia } from '../collectors/media_rss.js';
import { processMediaRaw } from '../postprocessors/media.js';
import { renderHtml } from '../renderers/html.js';
import { renderMarkdown } from '../renderers/markdown.js';
import { renderPng } from '../renderers/png.js';
import { writeJson, writeText } from '../utils/io.js';
import { renderTemplate } from '../utils/template.js';
import { generateVerifiedReport } from './generate_verified_report.js';

function cleanKeyword(raw) {
  return String(raw || '')
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function runMedia({ outDir, outputRoot, config, reportDate, sources, priorityKeywords = [] }) {
  console.log('\n📰 [MEDIA] Fetching RSS feeds...');
  if (!sources.length) {
    console.log('  ⚠  No RSS sources configured in config/rss_sources.yaml — skipping media');
    return;
  }

  const secCfg = config.media || {};
  const ppCfg = (config.post_process || {}).media || {};
  const llmCfg = config.llm || {};
  const outputCfg = config.output || {};
  const outputLanguage = String(outputCfg.language || 'zh-cn');
  const fixedTitle = String((outputCfg.section_titles || {}).media || '');
  const maxItems = Number(secCfg.max_items || 9);
  const maxRepairAttempts = Number((config.verify || {}).max_repair_attempts || 2);
  const keywordHint = (priorityKeywords || [])
    .map(cleanKeyword)
    .filter((k) => k.length >= 2)
    .slice(0, 40)
    .join(', ');
  const directive = renderTemplate(secCfg.llm_directive || '', {
    max_items: maxItems,
    output_language: outputLanguage,
    priority_keywords: keywordHint,
  });

  const raw = await collectMedia(sources, Number(secCfg.hours || 24), {
    html2mdStrategy: String(ppCfg.html2md_strategy || 'article'),
  });
  writeJson(path.join(outDir, 'raw.json'), raw);
  console.log(`  💾 raw.json: ${raw.item_count} items`);

  console.log('  🧹 Post-processing media raw data...');
  const post = processMediaRaw(raw, reportDate, outputRoot, ppCfg, priorityKeywords);
  writeJson(path.join(outDir, 'post.json'), post);
  console.log(`  💾 post.json: ${post.item_count} items`);

  if (post.item_count === 0) {
    console.log('  ⚠  No media items collected — skipping LLM generation');
    return;
  }

  console.log('  🤖 Generating report JSON via LLM...');
  const report = await generateVerifiedReport({
    outDir,
    section: 'media',
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
  console.log(`  ✅ Media report done → ${outDir}`);
}
