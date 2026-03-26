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
      lines.push(item.impact_and_outlook || item.why_it_matters || '');
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
      lines.push(`*👁 ${Number(item.view_count || 0).toLocaleString()} · ❤️ ${Number(item.like_count || 0).toLocaleString()}*`);
      lines.push('');
      lines.push(item.text || '');
      lines.push('');
    }
    return `${lines.join('\n').trim()}\n`;
  }

  const lines = [
    `# ${report.title || 'GitHub Trending'}`,
    '',
    report.summary || '',
    '',
  ];
  for (const item of report.items || []) {
    lines.push(`### [${item.repo || ''}](${item.url || ''})`);
    const meta = [];
    if (item.language) meta.push(item.language);
    if (item.stars_today) meta.push(`⭐ +${Number(item.stars_today).toLocaleString()} today`);
    if (item.stars_total) meta.push(`${Number(item.stars_total).toLocaleString()} total`);
    if (meta.length) lines.push(`*${meta.join(' · ')}*`);
    lines.push('');
    if (item.description) {
      lines.push(item.description);
      lines.push('');
    }
  }
  return `${lines.join('\n').trim()}\n`;
}
