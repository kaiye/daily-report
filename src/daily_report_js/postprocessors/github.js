export function processGithubRaw(rawData, cfg = {}) {
  const maxResults = Number(cfg.max_results || 15);

  const items = (rawData.items || [])
    .map((item) => ({
      rank: Number(item.rank || 0),
      repo: String(item.repo || ''),
      url: String(item.url || ''),
      description: String(item.description || ''),
      language: String(item.language || '').trim() || 'Unknown',
      stars_today: Number(item.stars_today || 0),
      stars_total: Number(item.stars_total || 0),
      forks: Number(item.forks || 0),
    }))
    .filter((item) => item.repo && item.url)
    .filter((item) => item.stars_today >= 100)
    .sort((a, b) => {
      const ar = Number.isFinite(a.rank) ? a.rank : Number.MAX_SAFE_INTEGER;
      const br = Number.isFinite(b.rank) ? b.rank : Number.MAX_SAFE_INTEGER;
      if (ar !== br) return ar - br;
      return 0;
    })
    .slice(0, maxResults);

  const languageBreakdown = {};
  for (const item of items) {
    const language = item.language || 'Unknown';
    languageBreakdown[language] = (languageBreakdown[language] || 0) + 1;
  }

  return {
    generated_at: new Date().toISOString(),
    source_raw: 'raw.json',
    source_count: Number(rawData.count || (rawData.items || []).length || 0),
    item_count: items.length,
    language_breakdown: languageBreakdown,
    items,
  };
}
