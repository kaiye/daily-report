#!/usr/bin/env node
import path from 'node:path';
import { collectGithub } from '../src/daily_report_js/collectors/github_trending.js';
import { collectMedia } from '../src/daily_report_js/collectors/media_rss.js';
import { collectX } from '../src/daily_report_js/collectors/x_twitter.js';
import { loadConfig, loadRssSources, loadXKeywords, parseArgs } from '../src/daily_report_js/config.js';
import { OUTPUT_DIR } from '../src/daily_report_js/project.js';
import { processGithubRaw } from '../src/daily_report_js/postprocessors/github.js';
import { processMediaRaw } from '../src/daily_report_js/postprocessors/media.js';
import { processXRaw } from '../src/daily_report_js/postprocessors/x.js';
import { renderHtml } from '../src/daily_report_js/renderers/html.js';
import { renderMarkdown } from '../src/daily_report_js/renderers/markdown.js';
import { renderPng } from '../src/daily_report_js/renderers/png.js';
import { ensureDir, writeJson, writeText } from '../src/daily_report_js/utils/io.js';
import { inferUtcDateFromReportDate } from '../src/daily_report_js/utils/time.js';

const LLM_FAILURE_SUMMARY = 'LLM 网关当前返回 packyapi EOF，本报告由已清洗数据按原始排序降级生成。';

function firstSentence(text, fallback = '') {
  const value = String(text || fallback || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  const match = value.match(/^(.{1,180}?[。！？.!?])/);
  return match ? match[1] : `${value.slice(0, 120)}。`;
}

function mediaReport(post, reportDate, title, maxItems) {
  const items = (post.items || []).slice(0, maxItems).map((item) => ({
    source: item.source,
    title: firstSentence(item.title, 'AI 资讯更新').replace(/[。！？.!?]$/, ''),
    url: item.url,
    published_at: item.published_at,
    summary: firstSentence(item.summary || item.title, item.title),
  }));
  return { report_date: reportDate, section: 'media', title, summary: LLM_FAILURE_SUMMARY, items };
}

function githubReport(post, reportDate, title) {
  const items = (post.items || []).map((item) => ({
    repo: item.repo,
    url: item.url,
    description: firstSentence(item.description, '仓库描述缺失'),
    language: item.language,
    stars_today: Number(item.stars_today || 0),
    stars_total: Number(item.stars_total || 0),
  }));
  return { report_date: reportDate, section: 'github', title, summary: LLM_FAILURE_SUMMARY, items };
}

function xReport(post, reportDate, title, topN) {
  const items = (post.items || []).slice(0, topN).map((item) => ({
    id: String(item.id || ''),
    author_name: item.author?.name || '',
    author_handle: item.author?.userName || '',
    text: firstSentence(item.text, 'X 热点内容'),
    url: item.url,
    view_count: Number(item.viewCount || 0),
    like_count: Number(item.likeCount || 0),
  }));
  return { report_date: reportDate, section: 'x', title, summary: LLM_FAILURE_SUMMARY, items };
}

async function writeReport(outDir, report) {
  writeJson(path.join(outDir, 'report.json'), report);
  writeText(path.join(outDir, 'report.md'), renderMarkdown(report));
  const html = renderHtml(report);
  writeText(path.join(outDir, 'report.html'), html);
  await renderPng(html, path.join(outDir, 'report.png'));
}

async function main() {
  const { reportDate, section } = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const baseOut = path.join(OUTPUT_DIR, reportDate);
  const sections = section === 'all' ? ['media', 'github', 'x'] : [section];
  const rssSources = loadRssSources();
  const xKeywords = loadXKeywords();
  ensureDir(baseOut);

  console.log(`📅 Report date: ${reportDate}`);
  console.log(`📁 Output dir:  ${baseOut}`);
  console.log(`⚠️  ${LLM_FAILURE_SUMMARY}`);

  for (const s of sections) {
    const outDir = path.join(baseOut, s);
    ensureDir(outDir);

    if (s === 'media') {
      console.log('\n📰 [MEDIA] fallback collect/post/render');
      const secCfg = config.media || {};
      const ppCfg = (config.post_process || {}).media || {};
      const raw = await collectMedia(rssSources, Number(secCfg.hours || 24), {
        html2mdStrategy: String(ppCfg.html2md_strategy || 'article'),
      });
      writeJson(path.join(outDir, 'raw.json'), raw);
      const post = processMediaRaw(raw, reportDate, OUTPUT_DIR, ppCfg, xKeywords);
      writeJson(path.join(outDir, 'post.json'), post);
      if (post.item_count > 0) {
        await writeReport(outDir, mediaReport(
          post,
          reportDate,
          String((config.output?.section_titles || {}).media || '媒体资讯'),
          Number(secCfg.max_items || 9),
        ));
      }
      console.log(`  raw=${raw.item_count || 0}, post=${post.item_count || 0}`);
    }

    if (s === 'github') {
      console.log('\n🐙 [GITHUB] fallback collect/post/render');
      const secCfg = config.github || {};
      const raw = await collectGithub({ since: secCfg.since || 'daily', lang: '' });
      writeJson(path.join(outDir, 'raw.json'), raw);
      const post = processGithubRaw(raw, { max_results: Number(secCfg.max_results || 15) });
      writeJson(path.join(outDir, 'post.json'), post);
      if (post.item_count > 0) {
        await writeReport(outDir, githubReport(
          post,
          reportDate,
          String((config.output?.section_titles || {}).github || 'Github 趋势'),
        ));
      }
      console.log(`  raw=${raw.count || 0}, post=${post.item_count || 0}`);
    }

    if (s === 'x') {
      console.log('\n🐦 [X] fallback collect/post/render');
      const secCfg = config.x || {};
      const ppCfg = (config.post_process || {}).x || {};
      const utcDate = inferUtcDateFromReportDate(reportDate);
      try {
        const raw = await collectX({
          keywords: xKeywords,
          minFaves: Number(secCfg.min_faves || 1000),
          utcDate,
        });
        writeJson(path.join(outDir, 'raw.json'), raw);
        const post = processXRaw(raw, utcDate, {
          min_text_length: Number(ppCfg.min_text_length || 20),
          max_items: Number(ppCfg.max_items || 0),
        });
        writeJson(path.join(outDir, 'post.json'), post);
        if (post.item_count > 0) {
          await writeReport(outDir, xReport(
            post,
            reportDate,
            String((config.output?.section_titles || {}).x || 'X 热点'),
            Number(secCfg.top_n || 10),
          ));
        }
        console.log(`  raw=${raw.raw_count || 0}, post=${post.item_count || 0}`);
      } catch (err) {
        console.log(`  ⚠ X skipped: ${err.message || String(err)}`);
      }
    }
  }

  console.log(`\n🎉 Fallback done! Output: ${baseOut}`);
}

main().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});
