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

test('branches operation lists branches', async () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-branches-'));
  require('child_process').execSync('git init', { cwd: repoDir });
  require('child_process').execSync('git config user.email "test@example.com"', {
    cwd: repoDir,
  });
  require('child_process').execSync('git config user.name "Test"', {
    cwd: repoDir,
  });
  fs.writeFileSync(path.join(repoDir, 'README.md'), 'hello');
  require('child_process').execSync('git add README.md', { cwd: repoDir });
  require('child_process').execSync('git commit -m "init"', { cwd: repoDir });
  require('child_process').execSync('git branch feature', { cwd: repoDir });

  const node = new GitExtended();
  const context = new TestContext({ operation: 'branches', repoPath: repoDir });
  const result = await node.execute.call(context);
  const output = result[0][0].json.stdout;
  assert.ok(output.includes('feature'));

  fs.rmSync(repoDir, { recursive: true, force: true });
});

test('commits operation lists commits', async () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-commits-'));
  require('child_process').execSync('git init', { cwd: repoDir });
  require('child_process').execSync('git config user.email "test@example.com"', {
    cwd: repoDir,
  });
  require('child_process').execSync('git config user.name "Test"', {
    cwd: repoDir,
  });
  fs.writeFileSync(path.join(repoDir, 'README.md'), 'hello');
  require('child_process').execSync('git add README.md', { cwd: repoDir });
  require('child_process').execSync('git commit -m "init"', { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'file.txt'), 'second');
  require('child_process').execSync('git add file.txt', { cwd: repoDir });
  require('child_process').execSync('git commit -m "second"', { cwd: repoDir });

  const node = new GitExtended();
  const context = new TestContext({ operation: 'commits', repoPath: repoDir });
  const result = await node.execute.call(context);
  const output = result[0][0].json.stdout;
  assert.ok(output.includes('second'));

  fs.rmSync(repoDir, { recursive: true, force: true });
});

test('createBranch operation creates a new branch', async () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-create-'));
  require('child_process').execSync('git init', { cwd: repoDir });
  require('child_process').execSync('git config user.email "test@example.com"', {
    cwd: repoDir,
  });
  require('child_process').execSync('git config user.name "Test"', {
    cwd: repoDir,
  });
  fs.writeFileSync(path.join(repoDir, 'README.md'), 'hello');
  require('child_process').execSync('git add README.md', { cwd: repoDir });
  require('child_process').execSync('git commit -m "init"', { cwd: repoDir });

  const node = new GitExtended();
  const context = new TestContext({ operation: 'createBranch', repoPath: repoDir, target: 'feature' });
  await node.execute.call(context);

  const branches = require('child_process').execSync('git branch', { cwd: repoDir }).toString();
  assert.ok(branches.includes('feature'));

  fs.rmSync(repoDir, { recursive: true, force: true });
});

test('deleteBranch operation deletes a branch', async () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-delete-'));
  require('child_process').execSync('git init', { cwd: repoDir });
  require('child_process').execSync('git config user.email "test@example.com"', {
    cwd: repoDir,
  });
  require('child_process').execSync('git config user.name "Test"', {
    cwd: repoDir,
  });
  fs.writeFileSync(path.join(repoDir, 'README.md'), 'hello');
  require('child_process').execSync('git add README.md', { cwd: repoDir });
  require('child_process').execSync('git commit -m "init"', { cwd: repoDir });
  require('child_process').execSync('git branch feature', { cwd: repoDir });

  const node = new GitExtended();
  const context = new TestContext({ operation: 'deleteBranch', repoPath: repoDir, target: 'feature' });
  await node.execute.call(context);

  const branches = require('child_process').execSync('git branch', { cwd: repoDir }).toString();
  assert.ok(!branches.includes('feature'));

  fs.rmSync(repoDir, { recursive: true, force: true });
});

test('showCommit operation displays commit details', async () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-show-'));
  require('child_process').execSync('git init', { cwd: repoDir });
  require('child_process').execSync('git config user.email "test@example.com"', {
    cwd: repoDir,
  });
  require('child_process').execSync('git config user.name "Test"', {
    cwd: repoDir,
  });
  fs.writeFileSync(path.join(repoDir, 'README.md'), 'hello');
  require('child_process').execSync('git add README.md', { cwd: repoDir });
  require('child_process').execSync('git commit -m "first"', { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'file.txt'), 'second');
  require('child_process').execSync('git add file.txt', { cwd: repoDir });
  require('child_process').execSync('git commit -m "second"', { cwd: repoDir });
  const commitHash = require('child_process').execSync('git rev-parse HEAD', { cwd: repoDir }).toString().trim();

  const node = new GitExtended();
  const context = new TestContext({ operation: 'showCommit', repoPath: repoDir, target: commitHash });
  const result = await node.execute.call(context);
  const output = result[0][0].json.stdout;
  assert.ok(output.includes('second'));

  fs.rmSync(repoDir, { recursive: true, force: true });
});
