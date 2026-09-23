import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {POLICY_VERSION} from './route.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = join(root, 'scripts/route.mjs');
const example = readFileSync(join(root, 'examples/local-route.json'), 'utf8');
const run = (input, args = []) => spawnSync(process.execPath, [cli, ...args], {
  input, encoding: 'utf8', timeout: 5000, env: {...process.env, TYPESAFE_API_KEY: ''},
});

test('documented local example runs from outside the repository without a key', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'codex-router-'));
  try {
    const result = spawnSync(process.execPath, [cli], {cwd, input: example, encoding: 'utf8', timeout: 5000});
    assert.equal(result.status, 0); assert.equal(result.stderr, '');
    const route = JSON.parse(result.stdout);
    assert.equal(route.status, 'planned'); assert.equal(route.typesafe.status, 'skipped');
    assert.equal(route.executionReceipt.dispatched, false);
  } finally {rmSync(cwd, {recursive: true, force: true});}
});
test('help and version need no key or input', () => {
  assert.match(run('', ['--help']).stdout, /Usage:/);
  const result = run('', ['--version']);
  assert.equal(result.status, 0); assert.equal(result.stdout.trim(), POLICY_VERSION);
  assert.equal(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version, POLICY_VERSION);
});
test('malformed, oversized and argument inputs exit 2 without reflection', () => {
  for (const [input, args] of [['private-canary', []], ['x'.repeat(16001), []], [example, ['--endpoint=private-canary']]]) {
    const result = run(input, args); assert.equal(result.status, 2); assert.equal(result.stdout, '');
    assert.ok(!result.stderr.includes('private-canary'));
  }
});
