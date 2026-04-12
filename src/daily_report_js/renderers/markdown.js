import { formatNum } from '../utils/text.js';

export function renderMarkdown(report) {
  const section = report.section || 'github';
  if (section === 'media') {
    const lines = [
      `# ${report.title || 'Media Report'}`,
      '',
      report.summary || '',
      '',
    ];
    for (const item of report.items || []) {
      const pub = item.published_at ? String(item.published_at).slice(0, 10) : '';
      lines.push(`### [${item.title || ''}](${item.url || ''})`);
      lines.push(`*${item.source || ''}* · ${pub}`);
      lines.push('');
      lines.push(`${item.title || ''}：${item.summary || item.impact_and_outlook || item.why_it_matters || ''}`);
      lines.push('');
    }
    return `${lines.join('\n').trim()}\n`;
  }

  if (section === 'x') {
    const lines = [
      `# ${report.title || 'X Trending'}`,
      '',
      report.summary || '',
      '',
    ];
    for (const item of report.items || []) {
      const author = item.author_handle ? `@${item.author_handle}` : item.author_name || '';
      lines.push(`### [${author}](${item.url || ''})`);
      lines.push(`*👁 ${formatNum(item.view_count || 0)} · ❤️ ${formatNum(item.like_count || 0)}*`);
      lines.push('');
      lines.push(item.text || '');
      lines.push('');
    }
    return `${lines.join('\n').trim()}\n`;
  }

  const lines = [
    `# ${report.title || 'GitHub Trending'}`,
    '',
  ];
  for (const item of report.items || []) {
    const total = Number(item.stars_total || 0).toLocaleString();
    const today = Number(item.stars_today || 0).toLocaleString();
    const desc = item.description ? ` — ${item.description}` : '';
    lines.push(`\`${item.repo || ''}\` ⭐ ${total} (+${today})${desc}`);
    lines.push(`> ${item.url || ''}`);
    lines.push('');
  }
  return `${lines.join('\n').trim()}\n`;
}
