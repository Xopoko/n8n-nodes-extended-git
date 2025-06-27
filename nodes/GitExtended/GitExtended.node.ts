import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import { exec as execCallback, spawn } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { URL } from 'url';
import { promisify } from 'util';

const exec = promisify(execCallback);

const execNoOutput = (command: string) =>
       new Promise<void>((resolve, reject) => {
               const child = spawn(command, { shell: true, stdio: 'ignore' });
               child.on('error', reject);
               child.on('exit', (code) => {
                       if (code === 0) resolve();
                       else reject(new Error(`Command failed with exit code ${code}`));
               });
       });

// Larger buffer for commands that produce a lot of output
const execLarge = (command: string) => exec(command, { maxBuffer: 200 * 1024 * 1024 });

enum Operation {
	Add = 'add',
	ApplyPatch = 'applyPatch',
	CreateBranch = 'createBranch',
	DeleteBranch = 'deleteBranch',
	Branches = 'branches',
	Checkout = 'checkout',
	Clone = 'clone',
	Commit = 'commit',
	Commits = 'commits',
	RenameBranch = 'renameBranch',
	Init = 'init',
	Log = 'log',
	Merge = 'merge',
	CherryPick = 'cherryPick',
	Fetch = 'fetch',
	Rebase = 'rebase',
	Reset = 'reset',
	Revert = 'revert',
	Stash = 'stash',
        Tag = 'tag',
        Pull = 'pull',
        Push = 'push',
        LfsPush = 'lfsPush',
        Status = 'status',
        Switch = 'switch',
        ConfigUser = 'configUser',
}

type CommandResult = { command: string; tempFile?: string };

type CommandBuilder = (
	this: IExecuteFunctions,
	index: number,
	repoPath: string,
) => Promise<CommandResult>;

const commandMap: Record<Operation, CommandBuilder> = {
        async [Operation.Clone](index, repoPath) {
                let repoUrl = this.getNodeParameter('repoUrl', index) as string;
                const auth = this.getNodeParameter('authentication', index) as string;
                const skipLfsSmudge = this.getNodeParameter('skipLfsSmudge', index, false) as boolean;
                if (auth === 'gitExtendedApi' || auth === 'custom') {
                        const creds =
                                auth === 'gitExtendedApi'
                                        ? await this.getCredentials('gitExtendedApi')
                                        : {
                                               username: this.getNodeParameter('customUsername', index) as string,
                                               password: this.getNodeParameter('customPassword', index) as string,
                                       };
                       try {
                               const url = new URL(repoUrl);
                               url.username = creds.username as string;
                               url.password = creds.password as string;
                               repoUrl = url.toString();
                       } catch (error) {
				throw new NodeOperationError(
					this.getNode(),
					`Failed to parse the repository URL: ${repoUrl}. Error: ${(error as Error).message}`,
				);
			}
                }
                const targetPath = this.getNodeParameter('targetPath', index) as string;
                let cmd = `git -C "${repoPath}" clone ${repoUrl} "${targetPath}"`;
                if (skipLfsSmudge) cmd = `GIT_LFS_SKIP_SMUDGE=1 ${cmd}`;
                return { command: cmd };
        },
	async [Operation.Init](_index, repoPath) {
		return { command: `git -C "${repoPath}" init` };
	},
	async [Operation.Add](index, repoPath) {
		const files = this.getNodeParameter('files', index) as string;
		return { command: `git -C "${repoPath}" add ${files}` };
	},
        async [Operation.Commit](index, repoPath) {
                const message = this.getNodeParameter('commitMessage', index) as string;
               const { stdout } = await execLarge(`git -C "${repoPath}" status --porcelain`);
                if (stdout.trim() === '') {
                        return { command: 'echo "No changes to commit"' };
                }

                // Stage all changed and untracked files so the commit succeeds
               await exec(`git -C "${repoPath}" add -A`);

               const { stdout: diff } = await execLarge(`git -C "${repoPath}" diff --cached --name-only`);
                if (diff.trim() === '') {
                        return { command: 'echo "No staged changes to commit"' };
                }

                return {
                        command: `git -C "${repoPath}" commit -m "${message.replace(/"/g, '\\"')}"`,
                };
        },
        async [Operation.Push](index, repoPath) {
               let remote = this.getNodeParameter('remote', index) as string;
               const branch = this.getNodeParameter('branch', index) as string;
               const auth = this.getNodeParameter('authentication', index) as string;
               if (remote) {
                       try {
                               if (auth === 'gitExtendedApi' || auth === 'custom') {
                                       const creds =
                                               auth === 'gitExtendedApi'
                                                       ? await this.getCredentials('gitExtendedApi')
                                                       : {
                                                               username: this.getNodeParameter('customUsername', index) as string,
                                                               password: this.getNodeParameter('customPassword', index) as string,
                                                       };
                                       const url = new URL(remote);
                                       url.username = creds.username as string;
                                       url.password = creds.password as string;
                                       remote = url.toString();
                               }
                       } catch {}
               }
               const forcePush = this.getNodeParameter('forcePush', index, false) as boolean;
               const pushLfsObjects = this.getNodeParameter('pushLfsObjects', index, false) as boolean;
               const skipLfsPush = this.getNodeParameter('skipLfsPush', index, false) as boolean;
               let cmd = '';
               if (pushLfsObjects) {
                       let lfsCmd = `git -C "${repoPath}" lfs push --all`;
                       if (remote) lfsCmd += ` ${remote}`;
                       if (branch) lfsCmd += ` ${branch}`;
                       cmd += `${lfsCmd} && `;
               }
               cmd += `git -C "${repoPath}" push`;
               if (remote) cmd += ` ${remote}`;
               if (branch) cmd += ` ${branch}`;
               if (forcePush) cmd += ' --force';
               if (skipLfsPush) cmd = `GIT_LFS_SKIP_PUSH=1 ${cmd}`;
               return { command: cmd };
        },
        async [Operation.LfsPush](index, repoPath) {
                const remote = this.getNodeParameter('remote', index) as string;
                const branch = this.getNodeParameter('branch', index) as string;
                let cmd = `git -C "${repoPath}" lfs push --all`;
                if (remote) cmd += ` ${remote}`;
                if (branch) cmd += ` ${branch}`;
                return { command: cmd };
        },
        async [Operation.Pull](index, repoPath) {
                let remote = this.getNodeParameter('remote', index) as string;
                const branch = this.getNodeParameter('branch', index) as string;
                const auth = this.getNodeParameter('authentication', index) as string;
                const skipLfsSmudge = this.getNodeParameter('skipLfsSmudge', index, false) as boolean;
                if (remote) {
                        try {
                                if (auth === 'gitExtendedApi' || auth === 'custom') {
                                        const creds =
                                               auth === 'gitExtendedApi'
                                                       ? await this.getCredentials('gitExtendedApi')
                                                       : {
                                                               username: this.getNodeParameter('customUsername', index) as string,
                                                               password: this.getNodeParameter('customPassword', index) as string,
                                                       };
                                       const url = new URL(remote);
                                       url.username = creds.username as string;
                                       url.password = creds.password as string;
                                       remote = url.toString();
                               }
                       } catch {}
                }
                let cmd = `git -C "${repoPath}" pull`;
                if (remote) cmd += ` ${remote}`;
                if (branch) cmd += ` ${branch}`;
                if (skipLfsSmudge) cmd = `GIT_LFS_SKIP_SMUDGE=1 ${cmd}`;
                return { command: cmd };
        },
	async [Operation.Branches](_index, repoPath) {
		return { command: `git -C "${repoPath}" branch` };
	},
	async [Operation.CreateBranch](index, repoPath) {
		const branchName = this.getNodeParameter('branchName', index) as string;
		return { command: `git -C "${repoPath}" branch ${branchName}` };
	},
	async [Operation.DeleteBranch](index, repoPath) {
		const branchName = this.getNodeParameter('branchName', index) as string;
		return { command: `git -C "${repoPath}" branch -d ${branchName}` };
	},
	async [Operation.RenameBranch](index, repoPath) {
		const currentName = this.getNodeParameter('currentName', index) as string;
		const newName = this.getNodeParameter('newName', index) as string;
		return { command: `git -C "${repoPath}" branch -m ${currentName} ${newName}` };
	},
	async [Operation.Commits](_index, repoPath) {
		return { command: `git -C "${repoPath}" log --oneline` };
	},
	async [Operation.Status](_index, repoPath) {
		return { command: `git -C "${repoPath}" status` };
	},
	async [Operation.Log](_index, repoPath) {
		return { command: `git -C "${repoPath}" log` };
	},
	async [Operation.Switch](index, repoPath) {
		const target = this.getNodeParameter('target', index) as string;
		const create = this.getNodeParameter('create', index, false) as boolean;
		return { command: `git -C "${repoPath}" switch${create ? ' -c' : ''} ${target}` };
	},
	async [Operation.Checkout](index, repoPath) {
		const target = this.getNodeParameter('target', index) as string;
		return { command: `git -C "${repoPath}" checkout ${target}` };
	},
	async [Operation.Merge](index, repoPath) {
		const target = this.getNodeParameter('target', index) as string;
		return { command: `git -C "${repoPath}" merge ${target}` };
	},
        async [Operation.Fetch](index, repoPath) {
                const remote = this.getNodeParameter('remote', index) as string;
                const branch = this.getNodeParameter('branch', index) as string;
                const skipLfsSmudge = this.getNodeParameter('skipLfsSmudge', index, false) as boolean;
                let cmd = `git -C "${repoPath}" fetch`;
                if (remote) cmd += ` ${remote}`;
                if (branch) cmd += ` ${branch}`;
                if (skipLfsSmudge) cmd = `GIT_LFS_SKIP_SMUDGE=1 ${cmd}`;
                return { command: cmd };
        },
	async [Operation.Rebase](index, repoPath) {
		const upstream = this.getNodeParameter('upstream', index) as string;
		return { command: `git -C "${repoPath}" rebase ${upstream}` };
	},
	async [Operation.CherryPick](index, repoPath) {
		const commit = this.getNodeParameter('commit', index) as string;
		if (!commit) {
			throw new NodeOperationError(this.getNode(), 'Commit ID is required');
		}
		return { command: `git -C "${repoPath}" cherry-pick ${commit}` };
	},
	async [Operation.Revert](index, repoPath) {
		const commit = this.getNodeParameter('commit', index) as string;
		if (!commit) {
			throw new NodeOperationError(this.getNode(), 'Commit ID is required');
		}
		return { command: `git -C "${repoPath}" revert ${commit} --no-edit` };
	},
	async [Operation.Reset](index, repoPath) {
		const commit = this.getNodeParameter('commit', index, '') as string;
		const commitArg = commit ? ` ${commit}` : '';
		return { command: `git -C "${repoPath}" reset --hard${commitArg}` };
	},
	async [Operation.Stash](_index, repoPath) {
		return { command: `git -C "${repoPath}" stash` };
	},
	async [Operation.Tag](index, repoPath) {
		const tagName = this.getNodeParameter('tagName', index) as string;
		const tagCommit = this.getNodeParameter('tagCommit', index) as string;
		let cmd = `git -C "${repoPath}" tag ${tagName}`;
		if (tagCommit) cmd += ` ${tagCommit}`;
		return { command: cmd };
	},
        async [Operation.ApplyPatch](index, repoPath) {
                const patchInput = this.getNodeParameter('patchInput', index) as string;
                const binary = this.getNodeParameter('binary', index) as boolean;
                let patchFile: string;
                let tempFile: string | undefined;
		if (patchInput === 'text') {
			const patchText = this.getNodeParameter('patchText', index) as string;
			tempFile = join(tmpdir(), `patch-${Date.now()}-${Math.random().toString(36).slice(2)}`);
			await fs.writeFile(tempFile, patchText);
			patchFile = tempFile;
		} else {
			patchFile = this.getNodeParameter('patchFile', index) as string;
		}
                const command = `git -C "${repoPath}" apply${binary ? ' --binary' : ''} "${patchFile}"`;
                return { command, tempFile };
        },
        async [Operation.ConfigUser](index, repoPath) {
                const name = this.getNodeParameter('userName', index) as string;
                const email = this.getNodeParameter('userEmail', index) as string;
                const commands = [] as string[];
                if (name) commands.push(`git -C "${repoPath}" config user.name "${name.replace(/"/g, '\\"')}"`);
                if (email) commands.push(`git -C "${repoPath}" config user.email "${email.replace(/"/g, '\\"')}"`);
                return { command: commands.join(' && ') };
        },
};

export class GitExtended implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Git Extended',
		name: 'gitExtended',
		icon: 'file:gitExtended.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Run Git commands',
		defaults: {
			name: 'Git Extended',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'gitExtendedApi',
				required: true,
				displayOptions: {
					show: {
						authentication: ['gitExtendedApi'],
					},
				},
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Add',
						value: 'add',
						action: 'Add files',
					},
					{
						name: 'Apply Patch',
						value: 'applyPatch',
						action: 'Apply patch',
					},
					{
						name: 'Branches',
						value: 'branches',
						action: 'List branches',
					},
					{
						name: 'Checkout',
						value: 'checkout',
						action: 'Checkout',
					},
					{
						name: 'Cherry Pick',
						value: 'cherryPick',
						action: 'Cherry pick commit',
					},
					{
						name: 'Clone',
						value: 'clone',
						action: 'Clone repository',
					},
					{
						name: 'Commit',
						value: 'commit',
						action: 'Create commit',
					},
                                        {
                                                name: 'Commits',
                                                value: 'commits',
                                                action: 'List commits',
                                        },
                                        {
                                                name: 'Configure User',
                                                value: 'configUser',
                                                action: 'Configure user identity',
                                        },
                                        {
                                                name: 'Create Branch',
                                                value: 'createBranch',
                                                action: 'Create branch',
                                        },
					{
						name: 'Delete Branch',
						value: 'deleteBranch',
						action: 'Delete branch',
					},
					{
						name: 'Fetch',
						value: 'fetch',
						action: 'Fetch from remote',
					},
                                        {
                                                name: 'Init',
                                                value: 'init',
                                                action: 'Initialize repository',
                                        },
                                        {
                                                name: 'LFS Push',
                                                value: 'lfsPush',
                                                action: 'Push git lfs objects',
                                        },
                                        {
                                                name: 'Log',
                                                value: 'log',
                                                action: 'Show log',
                                        },
					{
						name: 'Merge',
						value: 'merge',
						action: 'Merge branch',
					},
					{
						name: 'Pull',
						value: 'pull',
						action: 'Pull branch',
					},
                                        {
                                                name: 'Push',
                                                value: 'push',
                                                action: 'Push branch',
                                        },
                                        {
                                                name: 'Rebase',
                                                value: 'rebase',
                                                action: 'Rebase branch',
                                        },
					{
						name: 'Rename Branch',
						value: 'renameBranch',
						action: 'Rename branch',
					},
					{
						name: 'Reset',
						value: 'reset',
						action: 'Reset to commit',
					},
					{
						name: 'Revert',
						value: 'revert',
						action: 'Revert commit',
					},
					{
						name: 'Stash',
						value: 'stash',
						action: 'Stash changes',
					},
					{
						name: 'Status',
						value: 'status',
						action: 'Show status',
					},
                                        {
                                                name: 'Switch Branch',
                                                value: 'switch',
                                                action: 'Switch branch',
                                        },
                                        {
                                                name: 'Tag',
                                                value: 'tag',
                                                action: 'Create tag',
                                        },
                                ],
				default: 'status',
			},
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
                               options: [
                                       {
                                               name: 'Authenticate',
                                               value: 'gitExtendedApi',
                                       },
                                       {
                                               name: 'Custom',
                                               value: 'custom',
                                       },
                                       {
                                               name: 'None',
                                               value: 'none',
                                       },
                               ],
				displayOptions: {
					show: {
						operation: ['clone', 'push', 'pull'],
					},
				},
                                default: 'none',
                                description: 'The way to authenticate',
                        },
                        {
                                displayName: 'Username',
                                name: 'customUsername',
                                type: 'string',
                                default: '',
                                displayOptions: {
                                        show: {
                                                authentication: ['custom'],
                                                operation: ['clone', 'push', 'pull'],
                                        },
                                },
                                description: 'Username for custom authentication',
                        },
                        {
                                displayName: 'Password',
                                name: 'customPassword',
                                type: 'string',
                                typeOptions: { password: true },
                                default: '',
                                displayOptions: {
                                        show: {
                                                authentication: ['custom'],
                                                operation: ['clone', 'push', 'pull'],
                                        },
                                },
                                description: 'Password for custom authentication',
                        },
                        {
                                displayName: 'Repository Path',
				name: 'repoPath',
				type: 'string',
				default: '.',
				description:
					'Filesystem path to run the Git command from. For clone, the repository will be created inside this path.',
			},
			{
				displayName: 'Repository URL',
				name: 'repoUrl',
				type: 'string',
				default: '',
				required: true,
				description: 'Git repository to clone',
				displayOptions: {
					show: {
						operation: ['clone'],
					},
				},
			},
			{
				displayName: 'Target Path',
				name: 'targetPath',
				type: 'string',
				default: '.',
				required: true,
				description: 'Directory to clone into',
				displayOptions: {
					show: {
						operation: ['clone'],
					},
				},
			},
			{
				displayName: 'Files',
				name: 'files',
				type: 'string',
				default: '.',
				description: 'Files or patterns to add',
				displayOptions: {
					show: {
						operation: ['add'],
					},
				},
			},
			{
				displayName: 'Commit Message',
				name: 'commitMessage',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['commit'],
					},
				},
			},
			{
				displayName: 'Remote',
				name: 'remote',
				type: 'string',
				default: 'origin',
				description: 'Remote name',
				displayOptions: {
					show: {
                                                operation: ['push', 'pull', 'fetch', 'lfsPush'],
                                        },
                                },
                        },
                        {
                                displayName: 'Branch',
                                name: 'branch',
                                type: 'string',
                                default: '',
                                description: 'Branch name',
                                displayOptions: {
                                        show: {
                                                operation: ['push', 'pull', 'fetch', 'lfsPush'],
                                        },
                                },
                        },
                        {
                                displayName: 'Skip LFS Smudge',
                                name: 'skipLfsSmudge',
                                type: 'boolean',
                                default: false,
                                description: 'Whether to set GIT_LFS_SKIP_SMUDGE=1 to skip downloading Git LFS objects',
                                displayOptions: {
                                        show: {
                                                operation: ['clone', 'pull', 'fetch'],
                                        },
                                },
                        },
                        {
                                displayName: 'Force Push',
                                name: 'forcePush',
                                type: 'boolean',
                                default: false,
                                description: 'Whether to force push',
                                displayOptions: {
                                        show: {
                                                operation: ['push'],
                                        },
                                },
                        },
                        {
                                displayName: 'Push LFS Objects',
                                name: 'pushLfsObjects',
                                type: 'boolean',
                                default: false,
                               description:
                                       'Whether to run "git lfs push --all" before pushing to upload LFS objects',
                                displayOptions: {
                                        show: {
                                                operation: ['push'],
                                        },
                                },
                        },
                        {
                                displayName: 'Skip LFS Push',
                                name: 'skipLfsPush',
                                type: 'boolean',
                                default: false,
                                description: 'Whether to set GIT_LFS_SKIP_PUSH=1 to avoid uploading LFS objects',
                                displayOptions: {
                                        show: {
                                                operation: ['push'],
                                        },
                                },
                        },
                        {
                                displayName: 'Branch Name',
                                name: 'branchName',
                                type: 'string',
				default: '',
				description: 'Name of the branch',
				displayOptions: {
					show: {
						operation: ['createBranch', 'deleteBranch'],
					},
				},
			},
			{
				displayName: 'Current Name',
				name: 'currentName',
				type: 'string',
				default: '',
				required: true,
				description: 'Current branch name',
				displayOptions: {
					show: {
						operation: ['renameBranch'],
					},
				},
			},
			{
				displayName: 'New Name',
				name: 'newName',
				type: 'string',
				default: '',
				required: true,
				description: 'New branch name',
				displayOptions: {
					show: {
						operation: ['renameBranch'],
					},
				},
			},
			{
				displayName: 'Upstream Branch',
				name: 'upstream',
				type: 'string',
				default: '',
				required: true,
				description: 'Branch to rebase onto',
				displayOptions: {
					show: {
						operation: ['rebase'],
					},
				},
			},
			{
				displayName: 'Commit ID',
				name: 'commit',
				type: 'string',
				default: '',
				description: 'Commit hash',
				displayOptions: {
					show: {
						operation: ['cherryPick', 'revert', 'reset'],
					},
				},
			},
			{
				displayName: 'Tag Name',
				name: 'tagName',
				type: 'string',
				default: '',
				required: true,
				description: 'Name of the tag',
				displayOptions: {
					show: {
						operation: ['tag'],
					},
				},
			},
			{
				displayName: 'Commit ID',
				name: 'tagCommit',
				type: 'string',
				default: '',
				description: 'Commit to tag, defaults to HEAD',
				displayOptions: {
					show: {
						operation: ['tag'],
					},
				},
			},
			{
				displayName: 'Patch Input',
				name: 'patchInput',
				type: 'options',
				options: [
					{
						name: 'Text',
						value: 'text',
					},
					{
						name: 'File',
						value: 'file',
					},
				],
				default: 'text',
				displayOptions: {
					show: {
						operation: ['applyPatch'],
					},
				},
			},
			{
				displayName: 'Patch Text',
				name: 'patchText',
				type: 'string',
				typeOptions: {
					rows: 5,
				},
				default: '',
				displayOptions: {
					show: {
						operation: ['applyPatch'],
						patchInput: ['text'],
					},
				},
			},
			{
				displayName: 'Patch File Path',
				name: 'patchFile',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['applyPatch'],
						patchInput: ['file'],
					},
				},
			},
			{
				displayName: 'Binary',
				name: 'binary',
				type: 'boolean',
				default: false,
				description: 'Whether to apply the patch in binary mode',
				displayOptions: {
					show: {
						operation: ['applyPatch'],
					},
				},
			},
			{
				displayName: 'Target',
				name: 'target',
				type: 'string',
				default: '',
				required: true,
				description: 'Branch or commit to operate on',
				displayOptions: {
					show: {
						operation: ['switch', 'checkout', 'merge'],
					},
				},
			},
                        {
                                displayName: 'Create',
                                name: 'create',
                                type: 'boolean',
                                default: false,
                                description: 'Whether to create the branch if it does not exist',
                                displayOptions: {
                                        show: {
                                                operation: ['switch'],
                                        },
                                },
                        },
                        {
                                displayName: 'User Name',
                                name: 'userName',
                                type: 'string',
                                default: '',
                                required: true,
                                description: 'User name for commits',
                                displayOptions: {
                                        show: {
                                                operation: ['configUser'],
                                        },
                                },
                        },
                        {
                                displayName: 'User Email',
                                name: 'userEmail',
                                type: 'string',
                                default: '',
                                required: true,
                                description: 'User email for commits',
                                displayOptions: {
                                        show: {
                                                operation: ['configUser'],
                                        },
                                },
                        },
                        {
                                displayName: 'Skip Stdout',
                                name: 'skipStdout',
                                type: 'boolean',
                                default: false,
                                description: 'Whether to ignore command output to avoid maxBuffer errors',
                        },
                ],
        };

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as Operation;
				const repoPath = this.getNodeParameter('repoPath', i) as string;

				const builder = commandMap[operation];
				if (!builder) {
					throw new NodeOperationError(this.getNode(), `Unsupported operation ${operation}`, {
						itemIndex: i,
					});
				}

                                const { command, tempFile } = await builder.call(this, i, repoPath);

                                const skipStdout = this.getNodeParameter('skipStdout', i, false) as boolean;

                                let stdout = '';
                                let stderr = '';
                                try {
                                        if (skipStdout) {
                                                await execNoOutput(command);
                                        } else {
                                                ({ stdout, stderr } = await exec(command));
                                        }
                                } finally {
                                        if (tempFile) await fs.unlink(tempFile);
                                }
                                returnData.push({
                                        json: skipStdout
                                                ? {}
                                                : { stdout: stdout.trim(), stderr: stderr.trim() },
                                });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: i });
					continue;
				}
				if ((error as any).context) {
					(error as any).context.itemIndex = i;
					throw error;
				}
				throw new NodeOperationError(this.getNode(), error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
