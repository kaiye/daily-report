import path from 'node:path';
import { CONFIG_DIR } from './project.js';
import { exists, readYaml } from './utils/io.js';
import { bjNow, toIsoDateString } from './utils/time.js';

const CONFIG_FILE = path.join(CONFIG_DIR, 'defaults.yaml');
const RSS_SOURCES_FILE = path.join(CONFIG_DIR, 'rss_sources.yaml');
const X_KEYWORDS_FILE = path.join(CONFIG_DIR, 'x_keywords.yaml');

export function loadConfig() {
  return exists(CONFIG_FILE) ? readYaml(CONFIG_FILE) : {};
}

export function loadRssSources() {
  if (!exists(RSS_SOURCES_FILE)) return [];
  const data = readYaml(RSS_SOURCES_FILE);
  return (data.sources || []).filter((source) => {
    const url = String(source.url || '').trim();
    return url && !/127\.0\.0\.1|localhost/.test(url);
  });
}

export function loadXKeywords() {
  if (!exists(X_KEYWORDS_FILE)) {
    return ['OpenAI', 'Anthropic', 'Claude', 'ChatGPT', 'LLM', 'AGI'];
  }
  const data = readYaml(X_KEYWORDS_FILE);
  return data.keywords || [];
}

export function parseArgs(argv) {
  let reportDate = '';
  let section = 'all';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--date') {
      reportDate = argv[i + 1] || '';
      i += 1;
    } else if (arg === '--section') {
      section = argv[i + 1] || 'all';
      i += 1;
    } else if (arg === '-h' || arg === '--help') {
      console.log('Usage: node scripts/run_daily.js [--date YYYY-MM-DD] [--section media|github|x|all]');
      process.exit(0);
    }
  }

  if (!reportDate) reportDate = toIsoDateString(bjNow());
  if (!['media', 'github', 'x', 'all'].includes(section)) {
    throw new Error(`Invalid --section: ${section}`);
  }

  return { reportDate, section };
}
