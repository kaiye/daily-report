import { getUtcWindow, parseDate, toIsoDateString } from '../utils/time.js';

function normalizeText(text) {
  return String(text || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyOfficial(author = {}) {
  const handle = String(author.userName || author.username || '').toLowerCase();
  const name = String(author.name || '').toLowerCase();
  const verifiedType = String(author.verifiedType || '').toLowerCase();

  if (author.isVerified === true) return true;
  if (verifiedType && verifiedType !== 'none') return true;

  const orgPattern = /(openai|anthropic|claude|deepmind|google|gemini|meta|microsoft|nvidia|huggingface|xai|grok|perplexity|mistral|qwen|minimax|kimi|glm|baidu|alibaba|labs|research|official|team|inc|corp|company|studio|ai)/i;
  return orgPattern.test(handle) || orgPattern.test(name);
}

export function processXRaw(rawData, utcDate, cfg = {}) {
  const tweets = rawData.raw_tweets || rawData.tweets || rawData.items || [];
  const minTextLength = Number(cfg.min_text_length || 20);
  const maxItems = Number(cfg.max_items || 0);

  const [sinceTs, untilTs] = getUtcWindow(utcDate);
  const start = new Date(sinceTs * 1000);
  const end = new Date(untilTs * 1000);

  const timeFiltered = [];
  for (const t of tweets) {
    const dt = parseDate(t.createdAt);
    if (dt && dt >= start && dt <= end) timeFiltered.push(t);
  }

  const seenIds = new Set();
  const textFiltered = [];
  for (const t of timeFiltered) {
    const id = String(t.id || '').trim();
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);

    if (normalizeText(t.text).length < minTextLength) continue;

    const author = t.author || {};
    textFiltered.push({
      id: t.id,
      text: t.text,
      createdAt: t.createdAt,
      viewCount: Number(t.viewCount || 0),
      likeCount: Number(t.likeCount || 0),
      retweetCount: Number(t.retweetCount || 0),
      author: {
        userName: author.userName || author.username || '',
        name: author.name || '',
        isVerified: Boolean(author.isVerified),
        isBlueVerified: Boolean(author.isBlueVerified),
        verifiedType: author.verifiedType || '',
      },
      url: t.twitterUrl || t.url || '',
      is_official: isLikelyOfficial(author),
    });
  }

  const items = maxItems > 0 ? textFiltered.slice(0, maxItems) : textFiltered;

  return {
    generated_at: new Date().toISOString(),
    source_raw: 'raw.json',
    utc_date: toIsoDateString(utcDate),
    source_count: tweets.length,
    time_filtered_count: timeFiltered.length,
    text_filtered_count: textFiltered.length,
    item_count: items.length,
    items,
  };
}
