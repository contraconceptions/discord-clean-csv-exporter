import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
for (const file of ['core.js', 'content.js', 'popup.js']) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  const source = readFileSync(file, 'utf8');
  if (/\beval\s*\(|\bnew Function\s*\(|\bfetch\s*\(|XMLHttpRequest/.test(source)) throw new Error(`Unexpected dynamic code or networking in ${file}`);
}
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
if (manifest.manifest_version !== 3) throw new Error('Manifest V3 required');
for (const icon of Object.values(manifest.icons)) if (!existsSync(icon)) throw new Error(`Missing ${icon}`);
for (const permission of manifest.permissions) if (!['activeTab', 'scripting', 'storage'].includes(permission)) throw new Error(`Unexpected permission ${permission}`);
console.log('Syntax, manifest, assets, permission and network checks passed.');
