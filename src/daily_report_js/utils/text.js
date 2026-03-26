export function cleanText(s) {
  if (!s) return '';
  return String(s)
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/&#\d+;/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

export function isHtmlLike(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  const starts = s.startsWith('<') || s.startsWith('&lt;');
  const ends = s.endsWith('>') || s.endsWith('&gt;');
  return starts && ends;
}

export function stripFences(text) {
  return String(text || '')
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
}

export function fixYaml(text) {
  return String(text || '')
    .split('\n')
    .map((line) => {
      const m = line.match(/^(\s*)([a-zA-Z_][a-zA-Z0-9_ -]*?):\s+(.+)$/);
      if (!m) return line;
      const [, indent, key, value] = m;
      if (value.includes(':') && !/^(https?:\/\/|"|'|\||>)/.test(value)) {
        const escaped = value.replaceAll('"', '\\"');
        return `${indent}${key}: "${escaped}"`;
      }
      return line;
    })
    .join('\n');
}

export function formatNum(v) {
  const n = Number(v || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
