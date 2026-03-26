import { formatNum } from '../utils/text.js';

export function renderHtml(report) {
  const section = report.section || 'github';
  const styles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 860px; margin: 40px auto; padding: 0 20px 60px; line-height: 1.65; color: #1a1a2e; background: #f8f9fc; }
  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 16px; padding: 28px 32px; margin-bottom: 32px; }
  .header h1 { font-size: 1.8rem; font-weight: 700; margin-bottom: 8px; }
  .header .meta { opacity: 0.85; font-size: 0.9rem; }
  .summary { background: white; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; color: #444; font-size: 1rem; border-left: 4px solid #667eea; }
  .card { background: white; border-radius: 12px; padding: 20px 24px; margin-bottom: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
  .card h3 { font-size: 1.05rem; margin-bottom: 6px; }
  .card h3 a { color: #2563eb; text-decoration: none; }
  .card .meta { font-size: 0.82rem; color: #888; margin-bottom: 10px; }
  .card .why { color: #333; font-size: 0.95rem; }
  .tweet-text { background: #f3f4f6; border-radius: 8px; padding: 12px 16px; font-size: 0.93rem; color: #222; margin-bottom: 10px; white-space: pre-wrap; word-break: break-word; }
  .tag { display: inline-block; background: #ede9fe; color: #5b21b6; border-radius: 6px; padding: 2px 8px; font-size: 0.78rem; margin-right: 6px; }
  .stars { color: #f59e0b; }
  `;

  if (section === 'media') {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${report.title || ''}</title><style>${styles}</style></head><body><div class="header"><h1>📰 ${report.title || ''}</h1><div class="meta">${report.report_date || ''} · Media & News</div></div><div class="summary">${report.summary || ''}</div>${(report.items || []).map((item) => `<div class="card"><h3><a href="${item.url || ''}">${item.title || ''}</a></h3><div class="meta"><span class="tag">${item.source || ''}</span> ${item.published_at ? String(item.published_at).slice(0, 10) : ''}</div><div class="why">${item.impact_and_outlook || item.why_it_matters || ''}</div></div>`).join('')}</body></html>`;
  }

  if (section === 'x') {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${report.title || ''}</title><style>${styles}</style></head><body><div class="header"><h1>🐦 ${report.title || ''}</h1><div class="meta">${report.report_date || ''} · X / Twitter Trending</div></div><div class="summary">${report.summary || ''}</div>${(report.items || []).map((item) => `<div class="card"><h3><a href="${item.url || ''}">@${item.author_handle || ''}${item.author_name ? ` · ${item.author_name}` : ''}</a></h3><div class="meta">👁 ${formatNum(item.view_count || 0)} · ❤️ ${formatNum(item.like_count || 0)}</div><div class="tweet-text">${item.text || ''}</div></div>`).join('')}</body></html>`;
  }

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${report.title || ''}</title><style>${styles}</style></head><body><div class="header"><h1>🐙 ${report.title || ''}</h1><div class="meta">${report.report_date || ''} · GitHub Trending</div></div><div class="summary">${report.summary || ''}</div>${(report.items || []).map((item) => `<div class="card"><h3><a href="${item.url || ''}">${item.repo || ''}</a></h3><div class="meta">${item.language ? `<span class="tag">${item.language}</span>` : ''} ${item.stars_today ? `<span class="stars">⭐ +${formatNum(item.stars_today)} today</span>` : ''} ${item.stars_total ? ` · ${formatNum(item.stars_total)} total` : ''}</div>${item.description ? `<div class="why" style="color:#666;margin-bottom:6px;">${item.description}</div>` : ''}</div>`).join('')}</body></html>`;
}
