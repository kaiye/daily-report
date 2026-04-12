const SECTION_SCHEMAS = {
  media: {
    reportContext: 'AI news',
    sourceContext: 'post-processed RSS data',
    requiredItemFields: ['source', 'title', 'url', 'published_at', 'summary'],
    deterministicStringFields: ['source', 'url', 'published_at'],
    deterministicNumberFields: [],
    keyField: 'url',
    itemExample: {
      source: 'string',
      title: 'string',
      url: 'string',
      published_at: 'string',
      summary: 'string',
    },
  },
  github: {
    reportContext: 'GitHub trending',
    sourceContext: 'post-processed trending data',
    requiredItemFields: ['repo', 'url', 'description', 'language', 'stars_today', 'stars_total'],
    deterministicStringFields: ['repo', 'url', 'language'],
    deterministicNumberFields: ['stars_today', 'stars_total'],
    keyField: 'repo',
    itemExample: {
      repo: 'string',
      url: 'string',
      description: 'string',
      language: 'string',
      stars_today: 0,
      stars_total: 0,
    },
  },
  x: {
    reportContext: 'X/Twitter trending',
    sourceContext: 'post-processed tweet data',
    requiredItemFields: ['id', 'author_name', 'author_handle', 'text', 'url', 'view_count', 'like_count'],
    deterministicStringFields: ['id', 'author_name', 'author_handle', 'url'],
    deterministicNumberFields: ['view_count', 'like_count'],
    keyField: 'id',
    itemExample: {
      id: 'string',
      author_name: 'string',
      author_handle: 'string',
      text: 'string',
      url: 'string',
      view_count: 0,
      like_count: 0,
    },
  },
};

export const REPORT_TOP_LEVEL_FIELDS = ['report_date', 'section', 'title', 'summary', 'items'];

export function getReportSections() {
  return Object.keys(SECTION_SCHEMAS);
}

export function getSectionSchema(section) {
  const schema = SECTION_SCHEMAS[section];
  if (!schema) {
    throw new Error(`Unknown section schema: ${section}`);
  }
  return schema;
}

export function getReportSchemaExample(section) {
  const schema = getSectionSchema(section);
  return {
    report_date: 'YYYY-MM-DD',
    section,
    title: 'string',
    summary: 'string',
    items: [schema.itemExample],
  };
}

export function getReportSchemaPrompt(section) {
  return JSON.stringify(getReportSchemaExample(section), null, 2);
}
