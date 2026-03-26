import path from 'node:path';
import { listDir, loadJson } from '../utils/io.js';
import { parseDate } from '../utils/time.js';

function cleanKeyword(raw) {
  return String(raw || '')
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectSignalTags(text) {
  const s = String(text || '');
  const tags = [];
  if (/(launch|launched|release|released|unveil|unveiled|preview|beta|feature|update|推出|发布|上线|接入|升级|开源)/i.test(s)) {
    tags.push('product_update');
  }
  if (/(raises?|raised|funding|valuation|acquire|acquired|acquisition|merger|募资|融资|估值|收购|并购)/i.test(s)) {
    tags.push('funding_mna');
  }
  if (/(breakthrough|algorithm|model|chip|cpu|agent|benchmark|compression|memory|词元|旋转90°|world model|世界模型)/i.test(s)) {
    tags.push('technical_breakthrough');
  }
  return tags;
}

function computePriority(item, keywords = []) {
  const title = String(item.title || '');
  const summary = String(item.summary || '');
  const haystack = `${title}\n${summary}`.toLowerCase();

  const matchedKeywords = [];
  for (const k of keywords) {
    if (!k) continue;
    if (haystack.includes(k.toLowerCase())) matchedKeywords.push(k);
  }

  const signalTags = detectSignalTags(`${title}\n${summary}`);
  let score = matchedKeywords.length * 100;
  if (signalTags.includes('product_update')) score += 28;
  if (signalTags.includes('funding_mna')) score += 24;
  if (signalTags.includes('technical_breakthrough')) score += 22;

  return { matchedKeywords, signalTags, score };
}

function findPrevMediaRawFiles(outputRoot, reportDate, maxDays = 3) {
  const results = [];
  const today = new Date(`${reportDate}T00:00:00Z`);
  const dateDirs = listDir(outputRoot);

  for (const d of dateDirs) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const dateObj = new Date(`${d}T00:00:00Z`);
    const diffDays = Math.floor((today - dateObj) / (24 * 3600 * 1000));
    if (diffDays <= 0 || diffDays > maxDays) continue;

    const rawPath = path.join(outputRoot, d, 'media', 'raw.json');
    try {
      loadJson(rawPath);
      results.push(rawPath);
    } catch {
      // ignore missing/unreadable history files
    }
  }

  results.sort();
  return results;
}

export function processMediaRaw(rawData, reportDate, outputRoot, cfg = {}, priorityKeywords = []) {
  const historyDays = Number(cfg.history_days || 3);
  const truncateChars = Number(cfg.truncate_chars || 300);
  const normalizedKeywords = (priorityKeywords || [])
    .map(cleanKeyword)
    .filter((k) => k.length >= 2);

  const prevFiles = findPrevMediaRawFiles(outputRoot, reportDate, historyDays);
  const prevLinkDates = new Map();

  for (const filePath of prevFiles) {
    const datePart = path.basename(path.dirname(path.dirname(filePath)));
    try {
      const data = loadJson(filePath);
      for (const item of data.items || []) {
        const link = item.link || '';
        if (!link) continue;
        if (!prevLinkDates.has(link) || datePart < prevLinkDates.get(link)) {
          prevLinkDates.set(link, datePart);
        }
      }
    } catch {
      // ignore bad history files
    }
  }

  const processed = [];
  for (const srcItem of rawData.items || []) {
    const item = { ...srcItem };
    const link = item.link || item.url || '';

    if (!item.published_at) {
      if (link && prevLinkDates.has(link)) {
        const earliest = prevLinkDates.get(link);
        item.published_at = `${earliest}T00:00:00+00:00`;
        item.published_at_inferred = 'historical';
      } else {
        item.published_at = `${reportDate}T00:00:00+00:00`;
        item.published_at_inferred = 'today';
      }
    }

    const rich = item.rich_fields && typeof item.rich_fields === 'object' ? item.rich_fields : {};
    const candidates = [];
    if (item.description) candidates.push(String(item.description).trim());
    for (const v of Object.values(rich)) {
      if (typeof v === 'string' && v.trim()) candidates.push(v.trim());
    }

    const summary = candidates
      .sort((a, b) => b.length - a.length)[0] || '';

    const base = {
      source: item.source,
      title: item.title,
      url: link,
      published_at: item.published_at,
      ...(item.published_at_inferred ? { published_at_inferred: item.published_at_inferred } : {}),
      summary: summary.slice(0, truncateChars),
    };
    const priority = computePriority(base, normalizedKeywords);
    processed.push({
      ...base,
      priority_score: priority.score,
      matched_keywords: priority.matchedKeywords,
      signal_tags: priority.signalTags,
    });
  }

  const nowRef = parseDate(rawData.collected_at) || new Date(`${reportDate}T00:00:00Z`);
  const hours = Number(rawData.hours || 24);
  const cutoff = new Date(nowRef.getTime() - hours * 3600 * 1000);

  const filtered = processed.filter((item) => {
    if (!item.url) return false;
    if (!item.published_at) return false;
    const dt = parseDate(item.published_at);
    if (!dt) return true;
    return dt >= cutoff;
  }).sort((a, b) => {
    const byPriority = Number(b.priority_score || 0) - Number(a.priority_score || 0);
    if (byPriority !== 0) return byPriority;
    return String(b.published_at || '').localeCompare(String(a.published_at || ''));
  });

  return {
    generated_at: new Date().toISOString(),
    source_raw: 'raw.json',
    history_files_used: prevFiles.length,
    history_days: historyDays,
    priority_keywords_used: normalizedKeywords.length,
    item_count: filtered.length,
    items: filtered,
  };
}
