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

test('createBranch operation creates branch', async () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-create-'));
  require('child_process').execSync('git init', { cwd: repoDir });
  require('child_process').execSync('git config user.email "test@example.com"', { cwd: repoDir });
  require('child_process').execSync('git config user.name "Test"', { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'README.md'), 'hello');
  require('child_process').execSync('git add README.md', { cwd: repoDir });
  require('child_process').execSync('git commit -m "init"', { cwd: repoDir });

  const node = new GitExtended();
  const context = new TestContext({ operation: 'createBranch', repoPath: repoDir, branchName: 'feature' });
  await node.execute.call(context);
  const branches = require('child_process').execSync('git branch', { cwd: repoDir }).toString();
  assert.ok(branches.includes('feature'));
  fs.rmSync(repoDir, { recursive: true, force: true });
});

test('renameBranch operation renames branch', async () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-rename-'));
  require('child_process').execSync('git init', { cwd: repoDir });
  require('child_process').execSync('git config user.email "test@example.com"', { cwd: repoDir });
  require('child_process').execSync('git config user.name "Test"', { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'README.md'), 'hello');
  require('child_process').execSync('git add README.md', { cwd: repoDir });
  require('child_process').execSync('git commit -m "init"', { cwd: repoDir });
  require('child_process').execSync('git branch old', { cwd: repoDir });

  const node = new GitExtended();
  const context = new TestContext({ operation: 'renameBranch', repoPath: repoDir, currentName: 'old', newName: 'new' });
  await node.execute.call(context);
  const branches = require('child_process').execSync('git branch', { cwd: repoDir }).toString();
  assert.ok(branches.includes('new') && !branches.includes('old'));
  fs.rmSync(repoDir, { recursive: true, force: true });
});

test('deleteBranch operation deletes branch', async () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-delete-'));
  require('child_process').execSync('git init', { cwd: repoDir });
  require('child_process').execSync('git config user.email "test@example.com"', { cwd: repoDir });
  require('child_process').execSync('git config user.name "Test"', { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'README.md'), 'hello');
  require('child_process').execSync('git add README.md', { cwd: repoDir });
  require('child_process').execSync('git commit -m "init"', { cwd: repoDir });
  require('child_process').execSync('git branch temp', { cwd: repoDir });

  const node = new GitExtended();
  const context = new TestContext({ operation: 'deleteBranch', repoPath: repoDir, branchName: 'temp' });
  await node.execute.call(context);
  const branches = require('child_process').execSync('git branch', { cwd: repoDir }).toString();
  assert.ok(!branches.includes('temp'));
  fs.rmSync(repoDir, { recursive: true, force: true });
});

test('switch operation can create branch', async () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-switch-'));
  require('child_process').execSync('git init', { cwd: repoDir });
  require('child_process').execSync('git config user.email "test@example.com"', { cwd: repoDir });
  require('child_process').execSync('git config user.name "Test"', { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'README.md'), 'hello');
  require('child_process').execSync('git add README.md', { cwd: repoDir });
  require('child_process').execSync('git commit -m "init"', { cwd: repoDir });

  const node = new GitExtended();
  const context = new TestContext({ operation: 'switch', repoPath: repoDir, target: 'newbranch', create: true });
  await node.execute.call(context);
  const branch = require('child_process').execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoDir }).toString().trim();
  assert.strictEqual(branch, 'newbranch');
  fs.rmSync(repoDir, { recursive: true, force: true });
});

test('stash operation stashes changes', async () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-stash-'));
  require('child_process').execSync('git init', { cwd: repoDir });
  require('child_process').execSync('git config user.email "test@example.com"', { cwd: repoDir });
  require('child_process').execSync('git config user.name "Test"', { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'file.txt'), 'a');
  require('child_process').execSync('git add file.txt', { cwd: repoDir });
  require('child_process').execSync('git commit -m "init"', { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'file.txt'), 'b');

  const node = new GitExtended();
  const context = new TestContext({ operation: 'stash', repoPath: repoDir });
  await node.execute.call(context);
  const status = require('child_process').execSync('git status --porcelain', { cwd: repoDir }).toString();
  assert.strictEqual(status.trim(), '');
  fs.rmSync(repoDir, { recursive: true, force: true });
});

test('fetch operation fetches remote', async () => {
  const remoteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-remote-'));
  require('child_process').execSync('git init --bare', { cwd: remoteDir });

  const pushDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-push-'));
  require('child_process').execSync(`git clone ${remoteDir} .`, { cwd: pushDir });
  require('child_process').execSync('git config user.email "test@example.com"', { cwd: pushDir });
  require('child_process').execSync('git config user.name "Test"', { cwd: pushDir });
  fs.writeFileSync(path.join(pushDir, 'a.txt'), '1');
  require('child_process').execSync('git add a.txt', { cwd: pushDir });
  require('child_process').execSync('git commit -m "first"', { cwd: pushDir });
  require('child_process').execSync('git push origin master', { cwd: pushDir });

  const localDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-local-'));
  require('child_process').execSync(`git clone ${remoteDir} .`, { cwd: localDir });

  fs.writeFileSync(path.join(pushDir, 'b.txt'), '2');
  require('child_process').execSync('git add b.txt', { cwd: pushDir });
  require('child_process').execSync('git commit -m "second"', { cwd: pushDir });
  require('child_process').execSync('git push origin master', { cwd: pushDir });

  const node = new GitExtended();
  const context = new TestContext({ operation: 'fetch', repoPath: localDir, remote: 'origin' });
  await node.execute.call(context);
  const result = require('child_process').execSync('git rev-list origin/master --count', { cwd: localDir }).toString().trim();
  assert.strictEqual(result, '2');
  fs.rmSync(remoteDir, { recursive: true, force: true });
  fs.rmSync(pushDir, { recursive: true, force: true });
  fs.rmSync(localDir, { recursive: true, force: true });
});

test('rebase operation rebases branch', async () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-rebase-'));
  require('child_process').execSync('git init', { cwd: repoDir });
  require('child_process').execSync('git config user.email "test@example.com"', { cwd: repoDir });
  require('child_process').execSync('git config user.name "Test"', { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'a.txt'), '1');
  require('child_process').execSync('git add a.txt', { cwd: repoDir });
  require('child_process').execSync('git commit -m "base"', { cwd: repoDir });
  require('child_process').execSync('git checkout -b feature', { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'b.txt'), '2');
  require('child_process').execSync('git add b.txt', { cwd: repoDir });
  require('child_process').execSync('git commit -m "feature"', { cwd: repoDir });
  require('child_process').execSync('git checkout master', { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'c.txt'), '3');
  require('child_process').execSync('git add c.txt', { cwd: repoDir });
  require('child_process').execSync('git commit -m "master"', { cwd: repoDir });

  require('child_process').execSync('git checkout feature', { cwd: repoDir });

  const node = new GitExtended();
  const context = new TestContext({ operation: 'rebase', repoPath: repoDir, upstream: 'master' });
  await node.execute.call(context);
  const log = require('child_process').execSync('git log --oneline', { cwd: repoDir }).toString();
  assert.ok(log.split('\n')[0].includes('feature'));
  fs.rmSync(repoDir, { recursive: true, force: true });
});

test('cherryPick operation applies commit', async () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-cherry-'));
  require('child_process').execSync('git init', { cwd: repoDir });
  require('child_process').execSync('git config user.email "test@example.com"', { cwd: repoDir });
  require('child_process').execSync('git config user.name "Test"', { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'a.txt'), '1');
  require('child_process').execSync('git add a.txt', { cwd: repoDir });
  require('child_process').execSync('git commit -m "first"', { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'b.txt'), '2');
  require('child_process').execSync('git add b.txt', { cwd: repoDir });
  require('child_process').execSync('git commit -m "second"', { cwd: repoDir });
  const commit = require('child_process').execSync('git rev-parse HEAD', { cwd: repoDir }).toString().trim();
  require('child_process').execSync('git reset --hard HEAD~1', { cwd: repoDir });

  const node = new GitExtended();
  const context = new TestContext({ operation: 'cherryPick', repoPath: repoDir, commit });
  await node.execute.call(context);
  const log = require('child_process').execSync('git log -1 --pretty=%B', { cwd: repoDir }).toString().trim();
  assert.strictEqual(log, 'second');
  fs.rmSync(repoDir, { recursive: true, force: true });
});

test('revert operation reverts commit', async () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-revert-'));
  require('child_process').execSync('git init', { cwd: repoDir });
  require('child_process').execSync('git config user.email "test@example.com"', { cwd: repoDir });
  require('child_process').execSync('git config user.name "Test"', { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'a.txt'), '1');
  require('child_process').execSync('git add a.txt', { cwd: repoDir });
  require('child_process').execSync('git commit -m "first"', { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'b.txt'), '2');
  require('child_process').execSync('git add b.txt', { cwd: repoDir });
  require('child_process').execSync('git commit -m "second"', { cwd: repoDir });
  const commit = require('child_process').execSync('git rev-parse HEAD', { cwd: repoDir }).toString().trim();

  const node = new GitExtended();
  const context = new TestContext({ operation: 'revert', repoPath: repoDir, commit });
  await node.execute.call(context);
  const log = require('child_process').execSync('git log -1 --pretty=%B', { cwd: repoDir }).toString();
  assert.ok(log.includes('Revert'));
  fs.rmSync(repoDir, { recursive: true, force: true });
});

test('reset operation resets to commit', async () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-reset-'));
  require('child_process').execSync('git init', { cwd: repoDir });
  require('child_process').execSync('git config user.email "test@example.com"', { cwd: repoDir });
  require('child_process').execSync('git config user.name "Test"', { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'a.txt'), '1');
  require('child_process').execSync('git add a.txt', { cwd: repoDir });
  require('child_process').execSync('git commit -m "first"', { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'b.txt'), '2');
  require('child_process').execSync('git add b.txt', { cwd: repoDir });
  require('child_process').execSync('git commit -m "second"', { cwd: repoDir });
  const first = require('child_process').execSync('git rev-list --max-parents=0 HEAD', { cwd: repoDir }).toString().trim();

  const node = new GitExtended();
  const context = new TestContext({ operation: 'reset', repoPath: repoDir, commit: first });
  await node.execute.call(context);
  const head = require('child_process').execSync('git rev-parse HEAD', { cwd: repoDir }).toString().trim();
  assert.strictEqual(head, first);
  fs.rmSync(repoDir, { recursive: true, force: true });
});

test('tag operation creates tag', async () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-tag-'));
  require('child_process').execSync('git init', { cwd: repoDir });
  require('child_process').execSync('git config user.email "test@example.com"', { cwd: repoDir });
  require('child_process').execSync('git config user.name "Test"', { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'a.txt'), '1');
  require('child_process').execSync('git add a.txt', { cwd: repoDir });
  require('child_process').execSync('git commit -m "first"', { cwd: repoDir });

  const node = new GitExtended();
  const context = new TestContext({ operation: 'tag', repoPath: repoDir, tagName: 'v1' });
  await node.execute.call(context);
  const tags = require('child_process').execSync('git tag', { cwd: repoDir }).toString();
  assert.ok(tags.includes('v1'));
  fs.rmSync(repoDir, { recursive: true, force: true });
});

test('checkout operation checks out branch', async () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-checkout-'));
  require('child_process').execSync('git init', { cwd: repoDir });
  require('child_process').execSync('git config user.email "test@example.com"', {
    cwd: repoDir,
  });
  require('child_process').execSync('git config user.name "Test"', {
    cwd: repoDir,
  });
  fs.writeFileSync(path.join(repoDir, 'a.txt'), '1');
  require('child_process').execSync('git add a.txt', { cwd: repoDir });
  require('child_process').execSync('git commit -m "first"', { cwd: repoDir });
  require('child_process').execSync('git branch feature', { cwd: repoDir });

  const node = new GitExtended();
  const context = new TestContext({
    operation: 'checkout',
    repoPath: repoDir,
    target: 'feature',
  });
  await node.execute.call(context);
  const branch = require('child_process').execSync(
    'git rev-parse --abbrev-ref HEAD',
    { cwd: repoDir },
  ).toString().trim();
  assert.strictEqual(branch, 'feature');
  fs.rmSync(repoDir, { recursive: true, force: true });
});

test('applyPatch operation applies patch', async () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ext-apply-'));
  require('child_process').execSync('git init', { cwd: repoDir });
  require('child_process').execSync('git config user.email "test@example.com"', {
    cwd: repoDir,
  });
  require('child_process').execSync('git config user.name "Test"', {
    cwd: repoDir,
  });
  fs.writeFileSync(path.join(repoDir, 'file.txt'), '1\n');
  require('child_process').execSync('git add file.txt', { cwd: repoDir });
  require('child_process').execSync('git commit -m "first"', { cwd: repoDir });

  fs.writeFileSync(path.join(repoDir, 'file.txt'), '2\n');
  const patchText = require('child_process').execSync('git diff file.txt', {
    cwd: repoDir,
  }).toString();
  require('child_process').execSync('git checkout -- file.txt', { cwd: repoDir });

  const node = new GitExtended();
  const context = new TestContext({
    operation: 'applyPatch',
    repoPath: repoDir,
    // The 'patchInput' parameter specifies the format of the patch. It is required by the GitExtended node.
    patchInput: 'text',
    patchText,
  });
  await node.execute.call(context);
  const content = fs.readFileSync(path.join(repoDir, 'file.txt'), 'utf8').trim();
  assert.strictEqual(content, '2');
  fs.rmSync(repoDir, { recursive: true, force: true });
});
