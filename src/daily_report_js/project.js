import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT = path.resolve(__dirname, '../..');
export const CONFIG_DIR = path.join(ROOT, 'config');
export const OUTPUT_DIR = path.join(ROOT, 'output');
