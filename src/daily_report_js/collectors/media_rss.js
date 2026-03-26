import RSSParser from 'rss-parser';
import { main as html2md4llm } from 'html2md4llm';
import { parseDate } from '../utils/time.js';
import { cleanText, isHtmlLike } from '../utils/text.js';

export async function collectMedia(sources, hours = 24, { html2mdStrategy = 'article' } = {}) {
  const parser = new RSSParser({
    timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DailyReport/1.0)' },
  });

  const now = new Date();
  const cutoff = new Date(now.getTime() - hours * 3600 * 1000);
  const allItems = [];

  for (const src of sources) {
    const name = src.name || src.url || 'unknown';
    const url = src.url || '';

    if (/127\.0\.0\.1|localhost/.test(url)) {
      console.log(`  ⚠  ${name}: local RSS URLs not supported — skipping`);
      continue;
    }

    try {
      const feed = await parser.parseURL(url);
      const items = (feed.items || [])
        .map((item) => {
          const pub = parseDate(item.isoDate || item.pubDate || item.published || item.updated);
          const richFields = {};
          for (const [k, v] of Object.entries(item)) {
            if (typeof v !== 'string') continue;
            if (['title', 'link', 'guid', 'id', 'pubDate', 'isoDate', 'summary', 'contentSnippet'].includes(k)) continue;
            if (v.length < 100) continue;
            const cleaned = String(v || '').trim();
            richFields[k] = isHtmlLike(cleaned)
              ? html2md4llm(cleaned, { strategy: html2mdStrategy, outputFormat: 'markdown' })
              : cleaned;
          }

          return {
            source: name,
            source_url: url,
            title: cleanText(item.title || ''),
            link: String(item.link || item.guid || item.id || ''),
            published_at: pub ? pub.toISOString() : null,
            description: cleanText(
              item.summary
                || item.contentSnippet
                || item['content:encoded']
                || item.content
                || ''
            ).slice(0, 400),
            rich_fields: richFields,
          };
        })
        .filter((x) => x.title && x.title.length >= 4)
        .filter((x) => {
          if (!x.published_at) return true;
          return new Date(x.published_at) >= cutoff;
        });

      allItems.push(...items);
      console.log(`  ✅ ${name.padEnd(30)} ${String(items.length).padStart(3)} items`);
    } catch (err) {
      console.log(`  ❌ ${name}: ${err.message || String(err)}`);
      console.log(`  ✅ ${name.padEnd(30)}   0 items`);
    }
  }

  allItems.sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')));

  return {
    source: 'media_rss',
    collected_at: now.toISOString(),
    hours,
    sources_count: sources.length,
    item_count: allItems.length,
    items: allItems,
  };
}
