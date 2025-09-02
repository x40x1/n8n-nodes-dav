# n8n-nodes-dav - AI Development Guide

## Project Overview
This project builds custom n8n nodes for WebDAV, CalDAV, and CardDAV protocols. Focus on creating robust integrations that handle HTTP-based DAV operations with proper authentication and error handling.

## Core Architecture

### Node Structure Pattern
Each DAV node follows this structure in `nodes/{NodeName}/`:
- `{NodeName}.node.ts` - Main node implementation with INodeType
- `{NodeName}.node.json` - Node metadata (optional, auto-generated)
- `{nodename}.svg` - Node icon (24x24px)
- `{Operation}Description.ts` - Operation definitions and field configurations

### Key Components
- **Resource**: Top-level categorization (e.g., "Calendar", "Address Book", "File")
- **Operation**: Specific DAV method (GET, PUT, PROPFIND, REPORT, etc.)
- **Fields**: Dynamic form fields based on resource/operation selection
- **Credentials**: Authentication handling (Basic Auth, Digest, OAuth)

## Workflow Integration Principles

### Seamless Data Flow
DAV nodes must integrate seamlessly with existing n8n workflows by:
- **Accepting standard input formats**: Process JSON data from previous nodes
- **Providing structured output**: Return data in predictable formats for downstream nodes
- **Handling batch operations**: Process multiple items efficiently
- **Supporting expressions**: Allow dynamic values using n8n's expression syntax

### Input/Output Compatibility
```typescript
// Example: Accept file paths from previous nodes
const filePath = this.getNodeParameter('path', itemIndex, '') as string;
// Support expressions: {{ $json.inputPath }} or {{ $node["Previous Node"].json.path }}
```

### Error Handling in Workflows
```typescript
// Always implement continueOnFail for workflow resilience
if (this.continueOnFail()) {
	items.push({
		json: this.getInputData(itemIndex)[0].json,
		error,
		pairedItem: itemIndex
	});
}
```

### Data Transformation Patterns
```typescript
// Transform DAV responses into workflow-friendly formats
const davResponse = await this.helpers.httpRequest({
	// DAV request configuration
});

// Transform for downstream consumption
item.json.fileContent = davResponse.data;
item.json.metadata = {
	size: davResponse.headers['content-length'],
	type: davResponse.headers['content-type'],
	lastModified: davResponse.headers['last-modified']
};
```

### Common Integration Scenarios

#### File Processing Workflows
```typescript
// WebDAV + File Processing nodes
const fileContent = item.json.fileContent;
const processedContent = fileContent.toString().toUpperCase();
item.json.processedFile = processedContent;
```

#### Calendar Data Integration
```typescript
// CalDAV + Calendar nodes
const icalData = item.json.calendarData;
// Parse iCalendar format for n8n calendar nodes
item.json.events = parseICalendar(icalData);
```

#### Contact Synchronization
```typescript
// CardDAV + CRM/Contact nodes
const vcardData = item.json.contactData;
// Transform vCard to structured contact format
item.json.contact = {
	name: extractVCardField(vcardData, 'FN'),
	email: extractVCardField(vcardData, 'EMAIL'),
	phone: extractVCardField(vcardData, 'TEL')
};
```

## Node Implementation Patterns

### Basic Node Structure
```typescript
import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';

export class WebDavNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'WebDAV',
		name: 'webDav',
		group: ['transform'],
		version: 1,
		description: 'Interact with WebDAV servers',
		defaults: {
			name: 'WebDAV',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'webDavApi',
				required: true,
			},
		],
		properties: [
			// Resource and operation properties
		],
	};

	// Ensure nodes work well with AI agents by providing clear, predictable outputs
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				// Get parameters
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const path = this.getNodeParameter('path', itemIndex, '') as string;

				// Process based on operation
				switch (operation) {
					case 'get':
						// Handle GET operation
						break;
					case 'put':
						// Handle PUT operation
						break;
					default:
						throw new NodeOperationError(this.getNode(), `Operation ${operation} not supported`);
				}

				// Modify item data
				items[itemIndex].json.result = result;
			} catch (error) {
				if (this.continueOnFail()) {
					items.push({
						json: this.getInputData(itemIndex)[0].json,
						error,
						pairedItem: itemIndex
					});
				} else {
					if (error.context) {
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, { itemIndex });
				}
			}
		}

		return [items];
	}
}
```

### Credential Implementation
```typescript
import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class WebDavApi implements ICredentialType {
	name = 'webDavApi';
	displayName = 'WebDAV API';
	documentationUrl = 'https://docs.n8n.io/integrations/creating-nodes/';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			placeholder: 'https://dav.example.com',
			description: 'The base URL of your WebDAV server',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			auth: {
				username: '={{ $credentials.username }}',
				password: '={{ $credentials.password }}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{ $credentials.baseUrl }}',
			url: '/',
			method: 'PROPFIND',
			headers: {
				Depth: '0',
			},
		},
	};
}
```

## DAV Protocol Patterns

### WebDAV Operations Structure
```typescript
// From HttpVerbDescription.ts pattern - operations with routing
const webdavOperations: INodeProperties[] = [
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
				name: 'GET',
				value: 'get',
				description: 'Download file from WebDAV server',
				action: 'Download file',
				routing: {
					request: {
						method: 'GET',
						url: '/{{path}}',
					},
				},
			},
			{
				name: 'PUT',
				value: 'put',
				description: 'Upload file to WebDAV server',
				action: 'Upload file',
				routing: {
					request: {
						method: 'PUT',
						url: '/{{path}}',
					},
				},
			},
			{
				name: 'PROPFIND',
				value: 'propfind',
				description: 'Get properties of WebDAV resource',
				action: 'Get properties',
				routing: {
					request: {
						method: 'PROPFIND',
						url: '/{{path}}',
						headers: {
							Depth: '1',
						},
					},
				},
			},
		],
		default: 'get',
	},
];
```

### Dynamic Fields Pattern
```typescript
// From HttpVerbDescription.ts - conditional fields based on operation
const getOperationFields: INodeProperties[] = [
	{
		displayName: 'Path',
		name: 'path',
		type: 'string',
		default: '',
		placeholder: '/path/to/file.txt',
		description: 'Path to the file on the WebDAV server',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['get', 'put'],
			},
		},
		required: true,
	},
	{
		displayName: 'File Content',
		name: 'fileContent',
		type: 'string',
		default: '',
		description: 'Content to upload to the WebDAV server',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['put'],
			},
		},
		required: true,
	},
];
```

### CalDAV/CardDAV Specifics
- **CalDAV**: Use REPORT method for calendar queries, handle iCalendar (.ics) format
- **CardDAV**: Use REPORT method for address book queries, handle vCard (.vcf) format
- **Common Headers**: Set `Depth: 1` for PROPFIND, `Content-Type: text/xml` for DAV requests

### Authentication Patterns
```typescript
// Basic Auth for DAV servers (from ExampleCredentialsApi pattern)
authenticate: IAuthenticateGeneric = {
	type: 'generic',
	properties: {
		auth: {
			username: '={{ $credentials.username }}',
			password: '={{ $credentials.password }}',
		},
	},
};
```

## Development Workflow

### 1. Node Creation
1. Create `nodes/{NodeName}/` directory
2. Implement main node class extending INodeType
3. Define operations in separate `{Operation}Description.ts` file
4. Add SVG icon (24x24px recommended)
5. Update `package.json` n8n.nodes array

### 2. Build Process
```bash
npm run build          # TypeScript compilation + icon copying
npm run lint           # ESLint checking
npm run lintfix        # Auto-fix linting issues
npm run dev            # Watch mode for development
```

### 3. Testing
- Use n8n desktop for local testing
- Test with real DAV servers (Nextcloud, OwnCloud, etc.)
- Verify authentication flows and error handling
- Test XML parsing for PROPFIND/PROPPATCH responses
- **Integration Testing**: Test with common n8n nodes (HTTP Request, File nodes, Calendar nodes)
- **Expression Testing**: Verify dynamic value support with {{$json.field}} syntax
- **Error Flow Testing**: Test continueOnFail behavior with downstream nodes

## Common Patterns

### Dynamic Fields Based on Operation
```typescript
displayOptions: {
	show: {
		resource: ['calendar'],
		operation: ['create']
	}
}
```

### Data Processing in Execute Method
```typescript
// From ExampleNode.ts - processing items with error handling
async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();

	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		try {
			// Get parameters for this item
			const myString = this.getNodeParameter('myString', itemIndex, '') as string;
			const item = items[itemIndex];

			// Process the data
			item.json.myString = myString;
			item.json.processedAt = new Date().toISOString();

		} catch (error) {
			// Handle errors gracefully
			if (this.continueOnFail()) {
				items.push({
					json: this.getInputData(itemIndex)[0].json,
					error,
					pairedItem: itemIndex
				});
			} else {
				if (error.context) {
					error.context.itemIndex = itemIndex;
					throw error;
				}
				throw new NodeOperationError(this.getNode(), error, { itemIndex });
			}
		}
	}

	return [items];
}
```

### XML Body Construction for DAV Requests
```typescript
// For PROPFIND requests
const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
	<D:prop>
		<D:getcontenttype/>
		<D:getlastmodified/>
		<D:getcontentlength/>
	</D:prop>
</D:propfind>`;
```

### Error Handling for DAV Responses
```typescript
// Handle DAV-specific status codes
if (response.status === 207) {
	// Multi-status response - parse XML for individual resource statuses
	const parser = new DOMParser();
	const xmlDoc = parser.parseFromString(response.data, 'text/xml');
	// Process multi-status response
} else if (response.status === 404) {
	throw new NodeOperationError(this.getNode(), 'Resource not found');
} else if (response.status === 401) {
	throw new NodeOperationError(this.getNode(), 'Authentication failed');
} else if (response.status === 403) {
	throw new NodeOperationError(this.getNode(), 'Access forbidden');
}
```

### AI-Friendly Node Design
```typescript
// Make operations clear and descriptive for AI agents
options: [
	{
		name: 'Download File',
		value: 'get',
		description: 'Download a file from the WebDAV server',
		action: 'Download file from {{path}}',
	},
	{
		name: 'Upload File',
		value: 'put',
		description: 'Upload a file to the WebDAV server',
		action: 'Upload file to {{path}}',
	},
]
```

### Expression Support
```typescript
// Support dynamic values from previous workflow steps
properties: [
	{
		displayName: 'File Path',
		name: 'path',
		type: 'string',
		default: '',
		placeholder: '/documents/{{$json.filename}}',
		description: 'Path supports expressions like {{$json.filename}} or {{$node["HTTP Request"].json.path}}',
	},
]
```

## File Organization
- `credentials/` - Authentication definitions
- `nodes/` - Node implementations
- `dist/` - Compiled output (auto-generated)
- `.github/` - CI/CD and documentation

## Key Files to Reference
- `nodes/ExampleNode/ExampleNode.node.ts` - Basic node implementation with error handling
- `nodes/HttpBin/` - HTTP-based node structure with routing
- `credentials/ExampleCredentialsApi.credentials.ts` - Basic authentication pattern
- `credentials/HttpBinApi.credentials.ts` - Bearer token authentication pattern
- `package.json` - Node registration and dependencies
- `tsconfig.json` - TypeScript configuration

## DAV Server Compatibility
- **Nextcloud**: Full WebDAV/CalDAV/CardDAV support
- **OwnCloud**: Similar to Nextcloud
- **Apache/mod_dav**: Standard WebDAV implementation
- **SabreDAV**: PHP-based DAV server library

## Workflow Integration Best Practices

### Data Format Consistency
- **Standard JSON Structure**: Return data in predictable JSON formats that other nodes expect
- **Metadata Preservation**: Include relevant metadata (sizes, timestamps, content types) for downstream processing
- **Error Propagation**: Use consistent error formats that work with n8n's error handling nodes

### Expression Compatibility
- **Dynamic Paths**: Support expressions like `{{$json.filename}}` for file paths
- **Previous Node References**: Enable `{{$node["HTTP Request"].json.path}}` patterns
- **Conditional Logic**: Allow expressions in all user-configurable fields

### Node Connectivity
- **Multiple Outputs**: Consider separate success/error outputs for complex workflows
- **Batch Processing**: Handle arrays of items efficiently for bulk operations
- **State Management**: Preserve workflow state across multiple DAV operations

### AI Agent Integration
- **Clear Descriptions**: Provide descriptive operation names and actions for AI tools
- **Predictable Outputs**: Ensure consistent data structures for AI processing
- **Tool Compatibility**: Mark nodes as `usableAsTool: true` for AI agent workflows

Focus on standards-compliant implementations that work across different DAV server implementations while maintaining seamless integration with existing n8n workflow patterns.</content>
<parameter name="filePath">c:\Users\alexa\n8n-nodes-dav\.github\copilot-instructions.md
