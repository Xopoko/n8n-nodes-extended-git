import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

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
        const operation = this.getNodeParameter('operation', i) as string;
        const repoPath = this.getNodeParameter('repoPath', i) as string;
        let command = '';

        if (operation === 'clone') {
          const repoUrl = this.getNodeParameter('repoUrl', i) as string;
          const targetPath = this.getNodeParameter('targetPath', i) as string;
          command = `git -C "${repoPath}" clone ${repoUrl} "${targetPath}"`;
        } else {

          if (operation === 'init') {
            command = `git -C "${repoPath}" init`;
          } else if (operation === 'add') {
            const files = this.getNodeParameter('files', i) as string;
            command = `git -C "${repoPath}" add ${files}`;
          } else if (operation === 'commit') {
            const message = this.getNodeParameter('commitMessage', i) as string;
            command = `git -C "${repoPath}" commit -m "${message.replace(/"/g, '\\"')}"`;
          } else if (operation === 'push') {
            const remote = this.getNodeParameter('remote', i) as string;
            const branch = this.getNodeParameter('branch', i) as string;
            command = `git -C "${repoPath}" push`;
            if (remote) command += ` ${remote}`;
            if (branch) command += ` ${branch}`;
          } else if (operation === 'pull') {
            const remote = this.getNodeParameter('remote', i) as string;
            const branch = this.getNodeParameter('branch', i) as string;
            command = `git -C "${repoPath}" pull`;
            if (remote) command += ` ${remote}`;
            if (branch) command += ` ${branch}`;
          } else if (operation === 'status') {
            command = `git -C "${repoPath}" status`;
          } else if (operation === 'log') {
            command = `git -C "${repoPath}" log`;
          } else if (operation === 'switch') {
            const target = this.getNodeParameter('target', i) as string;
            command = `git -C "${repoPath}" switch ${target}`;
          } else if (operation === 'checkout') {
            const target = this.getNodeParameter('target', i) as string;
            command = `git -C "${repoPath}" checkout ${target}`;
          } else if (operation === 'merge') {
            const target = this.getNodeParameter('target', i) as string;
            command = `git -C "${repoPath}" merge ${target}`;
          } else {
            throw new NodeOperationError(this.getNode(), `Unsupported operation ${operation}`, { itemIndex: i });
          }
        }

        const { stdout, stderr } = await exec(command);
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
