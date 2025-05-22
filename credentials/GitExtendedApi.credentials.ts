import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class GitExtendedApi implements ICredentialType {
	name = 'gitExtendedApi';
	displayName = 'Git Extended Credentials';
	documentationUrl = 'gitExtended';
	properties: INodeProperties[] = [
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			description: 'The username to authenticate with',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'The password to use in combination with the username',
		},
	];
}
