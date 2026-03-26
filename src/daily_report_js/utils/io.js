import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf-8')) || {};
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

export function writeYaml(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, yaml.dump(data, { sortKeys: false, noRefs: true }), 'utf-8');
}

export function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text, 'utf-8');
}

export function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function exists(filePath) {
  return fs.existsSync(filePath);
}

export function listDir(dirPath) {
  return fs.existsSync(dirPath) ? fs.readdirSync(dirPath) : [];
}
