const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { GitExtended } = require('../dist/nodes/GitExtended/GitExtended.node.js');

class TestContext {
  constructor(parameters) {
    this.parameters = parameters;
  }
  getInputData() {
    return [{ json: {} }];
  }
  getNodeParameter(name) {
    return this.parameters[name];
  }
  getNode() {
    return { name: 'GitExtended' };
  }
  continueOnFail() {
    return false;
  }
}

test('init operation creates git repository', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-test-'));
  const node = new GitExtended();
  const context = new TestContext({ operation: 'init', repoPath: tempDir });
  await node.execute.call(context);
  assert.ok(fs.existsSync(path.join(tempDir, '.git')));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('unsupported operation throws error', async () => {
  const node = new GitExtended();
  const context = new TestContext({ operation: 'unknown', repoPath: '.' });
  await assert.rejects(async () => {
    await node.execute.call(context);
  }, /Unsupported operation/);
});
