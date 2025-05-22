import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import { exec as execCallback } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { URL } from 'url';
import { promisify } from 'util';

const exec = promisify(execCallback);

enum Operation {
	Add = 'add',
	ApplyPatch = 'applyPatch',
	Branches = 'branches',
	Checkout = 'checkout',
	Clone = 'clone',
	Commit = 'commit',
	Commits = 'commits',
	Init = 'init',
	Log = 'log',
	Merge = 'merge',
	Pull = 'pull',
	Push = 'push',
	Status = 'status',
	Switch = 'switch',
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
		const auth = this.getNodeParameter('authentication', 0) as string;
		if (auth === 'gitExtendedApi') {
			const creds = await this.getCredentials('gitExtendedApi');
			try {
				const url = new URL(repoUrl);
				url.username = creds.username as string;
				url.password = creds.password as string;
				repoUrl = url.toString();
			} catch {}
		}
		const targetPath = this.getNodeParameter('targetPath', index) as string;
		return { command: `git -C "${repoPath}" clone ${repoUrl} "${targetPath}"` };
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
		return {
			command: `git -C "${repoPath}" commit -m "${message.replace(/"/g, '\\"')}"`,
		};
	},
	async [Operation.Push](index, repoPath) {
		const remote = this.getNodeParameter('remote', index) as string;
		const branch = this.getNodeParameter('branch', index) as string;
		let cmd = `git -C "${repoPath}" push`;
		if (remote) cmd += ` ${remote}`;
		if (branch) cmd += ` ${branch}`;
		return { command: cmd };
	},
	async [Operation.Pull](index, repoPath) {
		const remote = this.getNodeParameter('remote', index) as string;
		const branch = this.getNodeParameter('branch', index) as string;
		let cmd = `git -C "${repoPath}" pull`;
		if (remote) cmd += ` ${remote}`;
		if (branch) cmd += ` ${branch}`;
		return { command: cmd };
	},
	async [Operation.Branches](_index, repoPath) {
		return { command: `git -C "${repoPath}" branch` };
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
		return { command: `git -C "${repoPath}" switch ${target}` };
	},
	async [Operation.Checkout](index, repoPath) {
		const target = this.getNodeParameter('target', index) as string;
		return { command: `git -C "${repoPath}" checkout ${target}` };
	},
	async [Operation.Merge](index, repoPath) {
		const target = this.getNodeParameter('target', index) as string;
		return { command: `git -C "${repoPath}" merge ${target}` };
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
						name: 'Init',
						value: 'init',
						action: 'Initialize repository',
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
						name: 'Status',
						value: 'status',
						action: 'Show status',
					},
					{
						name: 'Switch Branch',
						value: 'switch',
						action: 'Switch branch',
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
						operation: ['push', 'pull'],
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
						operation: ['push', 'pull'],
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

				let stdout: string;
				let stderr: string;
				try {
					({ stdout, stderr } = await exec(command));
				} finally {
					if (tempFile) await fs.unlink(tempFile);
				}
				returnData.push({ json: { stdout: stdout.trim(), stderr: stderr.trim() } });
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
