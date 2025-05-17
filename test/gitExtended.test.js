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

test('clone operation clones repository', async () => {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-src-'));
  const repoDir = path.join(sourceDir, 'repo');
  fs.mkdirSync(repoDir);
  fs.writeFileSync(path.join(repoDir, 'README.md'), 'hello');
  require('child_process').execSync('git init', { cwd: repoDir });
  // Configure git user for committing inside the test repository
  require('child_process').execSync('git config user.email "test@example.com"', {
    cwd: repoDir,
  });
  require('child_process').execSync('git config user.name "Test"', {
    cwd: repoDir,
  });
  require('child_process').execSync('git add README.md', { cwd: repoDir });
  require('child_process').execSync('git commit -m "init"', { cwd: repoDir });

  const cloneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-clone-'));
  const node = new GitExtended();
  const targetPath = path.join(cloneDir, 'cloned');
  const context = new TestContext({
    operation: 'clone',
    repoPath: cloneDir,
    repoUrl: repoDir,
    targetPath,
  });
  await node.execute.call(context);
  assert.ok(fs.existsSync(path.join(targetPath, '.git')));

  fs.rmSync(sourceDir, { recursive: true, force: true });
  fs.rmSync(cloneDir, { recursive: true, force: true });
});
