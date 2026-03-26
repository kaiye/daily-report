import { getUtcWindow, toIsoDateString } from '../utils/time.js';

export function buildXQuery(keywords, sinceTs, untilTs, minFaves) {
  return `(${keywords.join(' OR ')}) lang:en since_time:${sinceTs} until_time:${untilTs} min_faves:${minFaves} filter:safe -filter:nativeretweets`;
}

async function fetchXRaw(apiKey, query) {
  const params = new URLSearchParams({ query, queryType: 'Top' });
  const url = `https://api.twitterapi.io/twitter/tweet/advanced_search?${params.toString()}`;
  const resp = await fetch(url, {
    headers: {
      'X-API-Key': apiKey,
      'User-Agent': 'Mozilla/5.0',
    },
  });
  if (!resp.ok) {
    throw new Error(`TwitterAPI.io HTTP ${resp.status}`);
  }
  const data = await resp.json();
  return data.tweets || [];
}

export async function collectX({ keywords, minFaves = 1000, utcDate }) {
  const apiKey = process.env.TWITTERAPI_IO_KEY || '';
  if (!apiKey) throw new Error('TWITTERAPI_IO_KEY environment variable is not set');

  const [sinceTs, untilTs] = getUtcWindow(utcDate);
  const query = buildXQuery(keywords, sinceTs, untilTs, minFaves);
  console.log(`  🔍 Query window: UTC ${toIsoDateString(utcDate)} 00:00 – 23:59 (min_faves=${minFaves})`);

  const rawTweets = await fetchXRaw(apiKey, query);
  console.log(`  📥 Fetched ${rawTweets.length} raw tweets`);

  return {
    source: 'x_twitter',
    collected_at: new Date().toISOString(),
    utc_date: toIsoDateString(utcDate),
    query,
    query_hash: Buffer.from(query).toString('base64').slice(0, 8),
    raw_count: rawTweets.length,
    raw_tweets: rawTweets,
    item_count: rawTweets.length,
    items: rawTweets,
  };
}
