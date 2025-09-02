import { INodeProperties } from 'n8n-workflow';

// WebDAV Operations
export const webDavOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['file'],
			},
		},
		options: [
			{
				name: 'Download File',
				value: 'get',
				description: 'Download a file from the WebDAV server',
				action: 'Download file',
				routing: {
					request: {
						method: 'GET',
						url: '/{{path}}',
					},
				},
			},
			{
				name: 'Upload File',
				value: 'put',
				description: 'Upload a file to the WebDAV server',
				action: 'Upload file',
				routing: {
					request: {
						method: 'PUT',
						url: '/{{path}}',
					},
				},
			},
			{
				name: 'Get Properties',
				value: 'propfind',
				description: 'Get properties of a WebDAV resource',
				action: 'Get properties',
				routing: {
					request: {
						method: 'PROPFIND' as any,
						url: '/{{path}}',
						headers: {
							Depth: '1',
						},
					},
				},
			},
			{
				name: 'Create Directory',
				value: 'mkcol',
				description: 'Create a directory on the WebDAV server',
				action: 'Create directory',
				routing: {
					request: {
						method: 'MKCOL' as any,
						url: '/{{path}}',
					},
				},
			},
			{
				name: 'Delete Resource',
				value: 'delete',
				description: 'Delete a file or directory from the WebDAV server',
				action: 'Delete resource',
				routing: {
					request: {
						method: 'DELETE',
						url: '/{{path}}',
					},
				},
			},
			{
				name: 'Move Resource',
				value: 'move',
				description: 'Move a file or directory on the WebDAV server',
				action: 'Move resource',
				routing: {
					request: {
						method: 'MOVE' as any,
						url: '/{{path}}',
						headers: {
							Destination: '={{ $parameter.destination }}',
						},
					},
				},
			},
			{
				name: 'Copy Resource',
				value: 'copy',
				description: 'Copy a file or directory on the WebDAV server',
				action: 'Copy resource',
				routing: {
					request: {
						method: 'COPY' as any,
						url: '/{{path}}',
						headers: {
							Destination: '={{ $parameter.destination }}',
						},
					},
				},
			},
		],
		default: 'get',
	},
];

// WebDAV Fields
const getOperationFields: INodeProperties[] = [
	{
		displayName: 'Path',
		name: 'path',
		type: 'string',
		default: '',
		placeholder: '/path/to/file.txt',
		description: 'Path to the file on the WebDAV server. Supports expressions like {{$JSON.filename}}.',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['get'],
			},
		},
		required: true,
	},
];

const putOperationFields: INodeProperties[] = [
	{
		displayName: 'Path',
		name: 'path',
		type: 'string',
		default: '',
		placeholder: '/path/to/file.txt',
		description: 'Path where to upload the file on the WebDAV server. Supports expressions like {{$JSON.filename}}.',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['put'],
			},
		},
		required: true,
	},
	{
		displayName: 'File Content',
		name: 'fileContent',
		type: 'string',
		default: '',
		description: 'Content to upload to the WebDAV server. Can be binary data or text.',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['put'],
			},
		},
		required: true,
	},
	{
		displayName: 'Content Type',
		name: 'contentType',
		type: 'string',
		default: 'application/octet-stream',
		placeholder: 'text/plain',
		description: 'MIME type of the file content',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['put'],
			},
		},
	},
];

const propfindOperationFields: INodeProperties[] = [
	{
		displayName: 'Path',
		name: 'path',
		type: 'string',
		default: '/',
		placeholder: '/path/to/resource',
		description: 'Path to the resource to get properties for. Use "/" for root.',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['propfind'],
			},
		},
		required: true,
	},
	{
		displayName: 'Depth',
		name: 'depth',
		type: 'options',
		default: '1',
		description: 'Depth of the PROPFIND request',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['propfind'],
			},
		},
		options: [
			{
				name: '0 (Resource Only)',
				value: '0',
			},
			{
				name: '1 (Resource + Children)',
				value: '1',
			},
			{
				name: 'Infinity (All Descendants)',
				value: 'infinity',
			},
		],
	},
];

const mkcolOperationFields: INodeProperties[] = [
	{
		displayName: 'Path',
		name: 'path',
		type: 'string',
		default: '',
		placeholder: '/path/to/new/directory',
		description: 'Path of the directory to create on the WebDAV server',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['mkcol'],
			},
		},
		required: true,
	},
];

const deleteOperationFields: INodeProperties[] = [
	{
		displayName: 'Path',
		name: 'path',
		type: 'string',
		default: '',
		placeholder: '/path/to/resource',
		description: 'Path to the file or directory to delete',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['delete'],
			},
		},
		required: true,
	},
];

const moveOperationFields: INodeProperties[] = [
	{
		displayName: 'Source Path',
		name: 'path',
		type: 'string',
		default: '',
		placeholder: '/path/to/source',
		description: 'Path to the resource to move',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['move'],
			},
		},
		required: true,
	},
	{
		displayName: 'Destination Path',
		name: 'destination',
		type: 'string',
		default: '',
		placeholder: '/path/to/destination',
		description: 'New path for the resource',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['move'],
			},
		},
		required: true,
	},
	{
		displayName: 'Overwrite',
		name: 'overwrite',
		type: 'boolean',
		default: false,
		description: 'Whether to overwrite the destination if it exists',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['move'],
			},
		},
	},
];

const copyOperationFields: INodeProperties[] = [
	{
		displayName: 'Source Path',
		name: 'path',
		type: 'string',
		default: '',
		placeholder: '/path/to/source',
		description: 'Path to the resource to copy',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['copy'],
			},
		},
		required: true,
	},
	{
		displayName: 'Destination Path',
		name: 'destination',
		type: 'string',
		default: '',
		placeholder: '/path/to/destination',
		description: 'Path where to copy the resource',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['copy'],
			},
		},
		required: true,
	},
	{
		displayName: 'Overwrite',
		name: 'overwrite',
		type: 'boolean',
		default: false,
		description: 'Whether to overwrite the destination if it exists',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['copy'],
			},
		},
	},
];

export const webDavFields: INodeProperties[] = [
	/* -------------------------------------------------------------------------- */
	/*                                file:get                                    */
	/* -------------------------------------------------------------------------- */
	...getOperationFields,

	/* -------------------------------------------------------------------------- */
	/*                                file:put                                    */
	/* -------------------------------------------------------------------------- */
	...putOperationFields,

	/* -------------------------------------------------------------------------- */
	/*                              file:propfind                                 */
	/* -------------------------------------------------------------------------- */
	...propfindOperationFields,

	/* -------------------------------------------------------------------------- */
	/*                               file:mkcol                                   */
	/* -------------------------------------------------------------------------- */
	...mkcolOperationFields,

	/* -------------------------------------------------------------------------- */
	/*                               file:delete                                  */
	/* -------------------------------------------------------------------------- */
	...deleteOperationFields,

	/* -------------------------------------------------------------------------- */
	/*                                file:move                                   */
	/* -------------------------------------------------------------------------- */
	...moveOperationFields,

	/* -------------------------------------------------------------------------- */
	/*                                file:copy                                   */
	/* -------------------------------------------------------------------------- */
	...copyOperationFields,
];
