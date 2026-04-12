import { formatNum } from '../utils/text.js';

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDateLabel(reportDate) {
  const text = String(reportDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return escapeHtml(text);
  const [year, month, day] = text.split('-');
  const monthMap = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${monthMap[Number(month) - 1] || month} ${day}, ${year}`;
}

function formatFullDateTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return escapeHtml(raw);

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss} UTC`;
}

function getSectionTheme(section) {
  if (section === 'github') {
    return {
      heroStart: '#e9f2ff',
      heroEnd: '#f6f9ff',
      accentSoft: '#cfe2ff',
      accentAlt: '#91caff',
      ink: '#111827',
      line: '#d6e4ff',
      titlePrefix: '🐙',
      subline: 'GitHub Trending Snapshot',
    };
  }

  if (section === 'x') {
    return {
      heroStart: '#eee8ff',
      heroEnd: '#f8f6ff',
      accentSoft: '#e0d2ff',
      accentAlt: '#c9b4ff',
      ink: '#1f1730',
      line: '#e4dbff',
      titlePrefix: '🐦',
      subline: 'X Daily Hotspots',
    };
  }

  return {
    heroStart: '#ffe8cc',
    heroEnd: '#fff7ed',
    accentSoft: '#ffd8ab',
    accentAlt: '#ffc069',
    ink: '#2a1f0f',
    line: '#ffe0bf',
    titlePrefix: '📰',
    subline: 'Media & News Watch',
  };
}

function getItemView(section, item, index) {
  if (section === 'github') {
    return {
      rank: String(index + 1).padStart(2, '0'),
      badge: escapeHtml(item.language || 'Repo'),
      title: escapeHtml(item.repo || ''),
      content: escapeHtml(item.description || ''),
      metric: `⭐ +${formatNum(item.stars_today || 0)} today · ${formatNum(item.stars_total || 0)} total`,
      url: escapeHtml(item.url || ''),
      tone: 'info',
    };
  }

  if (section === 'x') {
    const handle = item.author_handle ? `@${item.author_handle}` : item.author_name || '';
    return {
      rank: String(index + 1).padStart(2, '0'),
      badge: escapeHtml(handle),
      title: escapeHtml(item.author_name || handle),
      content: escapeHtml(item.text || ''),
      metric: `👁 ${formatNum(item.view_count || 0)} · ❤️ ${formatNum(item.like_count || 0)}`,
      url: escapeHtml(item.url || ''),
      tone: 'hot',
    };
  }

  return {
    rank: String(index + 1).padStart(2, '0'),
    badge: escapeHtml(item.source || 'Media'),
    title: escapeHtml(item.title || ''),
    content: escapeHtml(item.summary || item.impact_and_outlook || item.why_it_matters || ''),
    metric: formatFullDateTime(item.published_at),
    url: escapeHtml(item.url || ''),
    tone: 'warn',
  };
}

export function renderHtml(report) {
  const section = report.section || 'github';
  const theme = getSectionTheme(section);
  const dateLabel = formatDateLabel(report.report_date || '');
  const title = escapeHtml(report.title || '');
  const summary = escapeHtml(report.summary || '');
  const items = (report.items || []).map((item, i) => getItemView(section, item, i));

  const styles = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100dvh;
    display: flex;
    justify-content: center;
    padding: 18px;
    background: #eef1f6;
    font-family: "SF Pro Display","SF Pro Text",-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue",sans-serif;
    color: ${theme.ink};
  }
  .pixel-card-shell {
    position: relative;
    width: 760px;
    min-height: 980px;
    overflow: hidden;
    box-shadow: 0 14px 38px rgba(15,23,42,0.12), 0 6px 18px rgba(15,23,42,0.08);
    background: #ffffff;
  }
  .hero-panel::before,
  .hero-panel::after {
    content: "";
    position: absolute;
    border-radius: 999px;
    filter: blur(62px);
    pointer-events: none;
    opacity: 0.6;
    z-index: 0;
  }
  .hero-panel::before {
    top: -92px;
    left: -110px;
    width: 260px;
    height: 260px;
    background: ${theme.accentAlt};
    opacity: 0.5;
  }
  .hero-panel::after {
    right: -120px;
    bottom: -120px;
    width: 280px;
    height: 280px;
    background: ${theme.accentSoft};
    opacity: 0.44;
  }
  .hero-panel, .list-panel, .pixel-footer { position: relative; z-index: 1; }
  .hero-panel {
    background: linear-gradient(145deg, ${theme.heroStart} 0%, ${theme.heroEnd} 100%);
    padding: 30px 34px 24px;
    border-bottom: 1px solid ${theme.line};
  }
  .hero-panel > * {
    position: relative;
    z-index: 1;
  }
  .meta-strip {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }
  .brand-name {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .brand-subline {
    margin: 4px 0 0;
    font-size: 11px;
    color: rgba(0,0,0,0.55);
    letter-spacing: 0.03em;
  }
  .date-chip {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .hero-title {
    margin: 24px 0 0;
    font-family: "HarmonyOS Sans SC","Alibaba PuHuiTi 3.0","PingFang SC","Source Han Sans SC","Noto Sans CJK SC",sans-serif;
    font-size: 46px;
    line-height: 1.08;
    letter-spacing: -0.03em;
    font-weight: 800;
  }
  .hero-summary {
    margin: 14px 0 0;
    font-size: 16px;
    line-height: 1.62;
    color: rgba(0,0,0,0.7);
  }
  .list-panel {
    background: #ffffff;
    padding: 6px 26px 20px;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .ranking-item {
    border-top: 1px solid ${theme.line};
    padding: 16px 2px 14px;
  }
  .ranking-item:first-child {
    border-top: 0;
    margin: 0;
    padding: 16px 2px 14px;
    background: #ffffff;
  }
  .item-inline { display: flex; gap: 12px; align-items: flex-start; }
  .item-meta {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(0,0,0,0.42);
  }
  .item-rank { color: rgba(0,0,0,0.36); min-width: 22px; display: inline-block; }
  .item-badge { font-style: italic; color: rgba(0,0,0,0.42); }
  .item-content {
    margin: 6px 0 0;
    font-size: 18px;
    line-height: 1.56;
    color: rgba(0,0,0,0.76);
    overflow: visible;
    word-break: break-word;
  }
  .item-title-inline {
    font-weight: 800;
    color: rgba(0,0,0,0.88);
    padding: 0 0.08em 0.02em;
    border-radius: 3px;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
    background-image: linear-gradient(
      to top,
      color-mix(in srgb, ${theme.accentAlt} 88%, white) 0%,
      color-mix(in srgb, ${theme.accentAlt} 88%, white) 34%,
      transparent 34%,
      transparent 100%
    );
  }
  .item-metric {
    margin: 8px 0 0;
    font-size: 13px;
    line-height: 1.45;
    color: rgba(0,0,0,0.58);
  }
  .item-link {
    display: inline-block;
    margin-top: 6px;
    font-size: 12px;
    font-style: italic;
    color: rgba(0,0,0,0.48);
  }
  .pixel-footer {
    margin-top: auto;
    background: #ffffff;
    border-top: 1px solid ${theme.line};
    padding: 8px 34px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .footer-left, .footer-right {
    margin: 0;
    font-size: 12px;
    color: rgba(0,0,0,0.5);
    letter-spacing: 0.02em;
  }
  .tone-hot .item-badge,
  .tone-info .item-badge,
  .tone-warn .item-badge { color: rgba(0,0,0,0.42); }
  `;

  const listHtml = items.map((item) => `
    <article class="ranking-item tone-${item.tone}">
      <div class="item-inline">
        <div class="item-copy">
          <p class="item-meta">
            <span class="item-rank">${item.rank}</span>
            <span class="item-badge">${item.badge}</span>
          </p>
          <p class="item-content">
            <span class="item-title-inline">${item.title}</span>${item.content ? `：${item.content}` : ''}
          </p>
          ${item.metric ? `<p class="item-metric">${item.metric}</p>` : ''}
          ${item.url ? `<a class="item-link" href="${item.url}">${item.url}</a>` : ''}
        </div>
      </div>
    </article>
  `).join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>${styles}</style>
</head>
<body>
  <main class="pixel-card-shell">
    <section class="hero-panel">
      <div class="meta-strip">
        <div class="brand-lockup">
          <p class="brand-name">AI 日报</p>
          <p class="brand-subline">${theme.subline}</p>
        </div>
        <p class="date-chip">${dateLabel}</p>
      </div>
      <h1 class="hero-title">${title}</h1>
      <p class="hero-summary">${summary}</p>
    </section>
    <section class="list-panel">${listHtml}</section>
    <footer class="pixel-footer">
      <p class="footer-left">来源微信公众号：猫哥ai编程</p>
      <p class="footer-right">manbo.im</p>
    </footer>
  </main>
</body>
</html>`;
}
