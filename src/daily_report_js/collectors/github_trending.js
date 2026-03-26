export async function fetchGithubPage(since = 'daily', lang = '') {
  let url = 'https://github.com/trending';
  if (lang) url += `/${lang}`;
  url += `?since=${since}`;

  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return await resp.text();
}

export function parseGithubTrending(html) {
  const articles = [...html.matchAll(/<article class="Box-row">([\s\S]*?)<\/article>/g)].map((m) => m[1]);
  const items = [];

  articles.forEach((block, i) => {
    const name = block.match(/<h2[^>]*>\s*<a[^>]+href="\/([^"]+)"/)?.[1]?.trim() || '';
    if (!name) return;

    const descRaw = block.match(/<p[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1] || '';
    const desc = descRaw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    const lang = block.match(/itemprop="programmingLanguage"[^>]*>(.*?)<\/span>/)?.[1]?.trim() || '';
    const starsTotal = Number((block.match(/href="\/[^/]+\/[^/]+\/stargazers"[^>]*>.*?<\/svg>\s*([\d,]+)/s)?.[1] || '0').replaceAll(',', ''));
    const forks = Number((block.match(/href="\/[^/]+\/[^/]+\/forks"[^>]*>.*?<\/svg>\s*([\d,]+)/s)?.[1] || '0').replaceAll(',', ''));
    const starsToday = Number((block.match(/([\d,]+)\s*stars today/)?.[1] || '0').replaceAll(',', ''));

    items.push({
      rank: i + 1,
      repo: name,
      url: `https://github.com/${name}`,
      description: desc,
      language: lang,
      stars_total: starsTotal,
      forks,
      stars_today: starsToday,
    });
  });

  return items;
}

export async function collectGithub({ since = 'daily', lang = '' }) {
  const html = await fetchGithubPage(since, lang);
  const items = parseGithubTrending(html);
  const now = new Date();

  return {
    source: 'github_trending',
    collected_at: now.toISOString(),
    since,
    lang_filter: lang || 'all',
    count: items.length,
    items,
  };
}
