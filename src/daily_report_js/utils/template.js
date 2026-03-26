export function renderTemplate(template, variables = {}) {
  const source = String(template || '');
  return source.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    if (!Object.prototype.hasOwnProperty.call(variables, key)) return '';
    return String(variables[key]);
  });
}
