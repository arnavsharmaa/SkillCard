// Print the CHANGELOG section for one version, for use as GitHub Release notes.
// Usage: node scripts/release-notes.mjs v0.3.0   (accepts "v0.3.0" or "0.3.0")

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const version = (process.argv[2] || '').replace(/^v/, '');
if (!version) {
  console.error('usage: node scripts/release-notes.mjs <version>');
  process.exit(1);
}

const changelog = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'CHANGELOG.md'),
  'utf8'
);

// A section starts at "## [x.y.z]" and runs until the next "## [" or the link refs.
const start = changelog.indexOf(`## [${version}]`);
if (start === -1) {
  console.error(`No CHANGELOG section for version ${version}`);
  process.exit(1);
}
const rest = changelog.slice(start);
const bodyStart = rest.indexOf('\n') + 1;
const nextSection = rest.indexOf('\n## [', bodyStart);
const section = rest.slice(bodyStart, nextSection === -1 ? undefined : nextSection);

// Strip trailing link-reference lines if this is the last section.
process.stdout.write(section.replace(/\n\[[^\]]+\]:.*$/gs, '').trim() + '\n');
