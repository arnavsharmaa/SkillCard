// Drift guard: docs/openapi.yaml must describe exactly the routes the server
// implements — no undocumented endpoints, no documented ghosts. Routes are
// extracted from server/index.js source, so this needs no running server.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const spec = load(fs.readFileSync(path.join(root, 'docs', 'openapi.yaml'), 'utf8'));
const serverSrc = fs.readFileSync(path.join(root, 'server', 'index.js'), 'utf8');

// app.get('/api/...') / app.post('/api/...') — Express ":param" → OpenAPI "{param}".
function implementedRoutes() {
  const out = new Set();
  for (const m of serverSrc.matchAll(/app\.(get|post|put|patch|delete)\('([^']+)'/g)) {
    out.add(`${m[1].toUpperCase()} ${m[2].replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`);
  }
  return out;
}

function documentedRoutes() {
  const out = new Set();
  for (const [p, methods] of Object.entries(spec.paths)) {
    for (const method of Object.keys(methods)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
        out.add(`${method.toUpperCase()} ${p}`);
      }
    }
  }
  return out;
}

test('openapi.yaml is valid and carries the basics', () => {
  assert.equal(spec.openapi, '3.1.0');
  assert.ok(spec.info?.title && spec.info?.version);
  assert.ok(Object.keys(spec.paths).length > 0);
});

test('every implemented route is documented', () => {
  const documented = documentedRoutes();
  for (const route of implementedRoutes()) {
    assert.ok(documented.has(route), `undocumented route: ${route} — add it to docs/openapi.yaml`);
  }
});

test('every documented route is implemented', () => {
  const implemented = implementedRoutes();
  for (const route of documentedRoutes()) {
    assert.ok(implemented.has(route), `documented but not implemented: ${route}`);
  }
});

test('spec version tracks package.json', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(spec.info.version, pkg.version, 'bump docs/openapi.yaml info.version with the release');
});
