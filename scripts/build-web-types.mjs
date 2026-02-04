import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pkg from '../package.json' with { type: 'json' };

const root = process.cwd();
const templatePath = resolve(root, 'web-types.template.json');
const outPath = resolve(root, 'web-types.json');

const templateRaw = await readFile(templatePath, 'utf8');
const version = pkg.version || '0.0.0';
const output = templateRaw.replace(/__VERSION__/g, version);

await writeFile(outPath, output, 'utf8');
