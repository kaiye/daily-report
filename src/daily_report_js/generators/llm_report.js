import { ProxyAgent } from 'undici';
import { getReportSchemaPrompt, getSectionSchema } from '../schema/report_schema.js';
import { stripFences } from '../utils/text.js';

function buildNaturalRulesFromSchema(section, schema) {
  const rules = [];
  const deterministicFields = [
    ...schema.deterministicStringFields,
    ...schema.deterministicNumberFields,
  ];

  rules.push(`section must be "${section}".`);
  rules.push('report_date must exactly equal the input report_date.');
  rules.push(`Each item must include exactly these fields: ${schema.requiredItemFields.join(', ')}.`);

  if (schema.requiredItemFields.includes('url')) {
    rules.push('Do not fabricate URLs. Use URLs only from post.items.url.');
  }
  if (deterministicFields.length > 0) {
    rules.push(`Keep these fields exactly consistent with post.items: ${deterministicFields.join(', ')}.`);
  }
  if (schema.deterministicNumberFields.length > 0) {
    rules.push(`Return ${schema.deterministicNumberFields.join(', ')} as JSON numbers (not strings).`);
  }

  if (schema.requiredItemFields.includes('description')) {
    rules.push('description should stay close to the repository\'s own wording and read like a faithful Chinese translation, not a generic rewrite.');
    rules.push('description must be no more than one sentence.');
    rules.push('Avoid mechanical patterns such as “一个……用于……” unless the source itself uses that framing.');
  }
  if (schema.requiredItemFields.includes('text')) {
    rules.push('text should be a concise paraphrase in the original tone and perspective.');
  }
  if (schema.requiredItemFields.includes('summary') && section === 'media') {
    rules.push('For each media item, summary must be exactly one sentence.');
    rules.push('The sentence should primarily summarize what happened in the original article, with at most a light implication if clearly supported by the title/summary.');
    rules.push('Do not simply repeat the full title verbatim inside item.summary.');
    rules.push('Keep the outlet\'s framing and avoid switching into a third-party analyst voice.');
    rules.push('Avoid mechanical phrases such as "这说明" or "这显示".');
    rules.push('Do not invent outlook or predictions that are not supported by post.items.title/summary.');
  }

  rules.push(`Do not output duplicate items with the same ${schema.keyField}.`);
  rules.push('summary must be exactly one sentence about the most important shared trend across items.');
  return rules;
}

function buildSystemPrompt(section, directive) {
  const schema = getSectionSchema(section);
  const ruleLines = buildNaturalRulesFromSchema(section, schema).map((rule) => `- ${rule}`).join('\n');
  return `You are generating a structured daily ${schema.reportContext} report JSON from ${schema.sourceContext}.
Return ONLY valid JSON, no markdown fences, no commentary.
IMPORTANT:
${ruleLines}

User directive: ${directive || '(none — use your best judgment)'}

Schema (JSON):
${getReportSchemaPrompt(section)}`;
}

const REPAIR_APPENDIX = `
You are repairing an existing JSON report after verification errors.
You MUST fix every listed issue while preserving correct fields.
If an issue says URL/number/author/repo mismatch, values must exactly match post.items.
Return only valid JSON.
`;

const PROXY_AGENT_CACHE = new Map();

function parseBooleanLike(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

function getProxyAgent(proxyUrl, insecureMode = false) {
  const cacheKey = `${proxyUrl}::${insecureMode ? 'insecure' : 'secure'}`;
  if (!PROXY_AGENT_CACHE.has(cacheKey)) {
    if (insecureMode) {
      PROXY_AGENT_CACHE.set(cacheKey, new ProxyAgent({
        uri: proxyUrl,
        requestTls: { rejectUnauthorized: false },
      }));
    } else {
      PROXY_AGENT_CACHE.set(cacheKey, new ProxyAgent(proxyUrl));
    }
  }
  return PROXY_AGENT_CACHE.get(cacheKey);
}

function parseJsonFromContent(content, section) {
  const cleaned = stripFences(String(content || '')).trim();
  if (!cleaned) throw new Error(`LLM returned empty response for section ${section}`);

  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first >= 0 && last > first) {
      const candidate = cleaned.slice(first, last + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        // continue to throw
      }
    }
  }

  const preview = cleaned.slice(0, 400).replace(/\s+/g, ' ');
  throw new Error(`LLM returned invalid JSON for section ${section}: ${preview}`);
}

async function requestJsonFromLlm(section, payload, directive, llmCfg = {}, repairMode = false) {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is not set');

  const baseUrl = (process.env.OPENAI_BASE_URL || llmCfg.base_url || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || llmCfg.model || 'gpt-5.4';
  const envProxyDefined = Object.prototype.hasOwnProperty.call(process.env, 'OPENAI_PROXY');
  let proxyUrl = String(envProxyDefined ? process.env.OPENAI_PROXY : (llmCfg.proxy || '')).trim();
  if (/^(off|none|false|0)$/i.test(proxyUrl)) proxyUrl = '';
  const insecureProxyTls = parseBooleanLike(process.env.OPENAI_PROXY_INSECURE || llmCfg.proxy_insecure || '');
  const temperature = Number(llmCfg.temperature ?? 0.2);

  const systemPromptBase = buildSystemPrompt(section, directive);
  const systemPrompt = repairMode ? `${systemPromptBase}\n${REPAIR_APPENDIX}` : systemPromptBase;

  const requestInit = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      temperature,
    }),
  };

  if (proxyUrl) {
    requestInit.dispatcher = getProxyAgent(proxyUrl, insecureProxyTls);
    console.log(`  🌐 LLM proxy enabled: ${proxyUrl}`);
    if (insecureProxyTls) {
      console.log('  ⚠  LLM proxy TLS verification disabled (OPENAI_PROXY_INSECURE=1)');
    }
  }

  let resp;
  try {
    resp = await fetch(`${baseUrl}/chat/completions`, requestInit);
  } catch (err) {
    const cause = err?.cause;
    const causeMsg = cause?.message || '';
    const causeCode = cause?.code ? ` code=${cause.code}` : '';
    throw new Error(
      `LLM network request failed via ${proxyUrl || 'direct'}: ${err.message || String(err)}${causeCode}${causeMsg ? `; cause=${causeMsg}` : ''}`,
    );
  }

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`LLM request failed: HTTP ${resp.status} ${body.slice(0, 500)}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content || '';
  return parseJsonFromContent(content, section);
}

export async function generateSectionReport(section, postData, reportDate, directive, llmCfg = {}) {
  const payload = {
    report_date: reportDate,
    post: postData,
  };
  return await requestJsonFromLlm(section, payload, directive, llmCfg, false);
}

export async function repairSectionReport(
  section,
  postData,
  reportDate,
  directive,
  llmCfg = {},
  currentReport,
  verifyIssues,
) {
  const payload = {
    report_date: reportDate,
    post: postData,
    current_report: currentReport,
    verify_issues: verifyIssues,
  };
  return await requestJsonFromLlm(section, payload, directive, llmCfg, true);
}
