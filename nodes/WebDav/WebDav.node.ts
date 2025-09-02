import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import { webDavFields, webDavOperations } from './WebDavDescription';

export class WebDav implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'WebDAV',
		name: 'webDav',
		icon: { light: 'file:webdav.svg', dark: 'file:webdav.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Interact with WebDAV servers for file operations',
		defaults: {
			name: 'WebDAV',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'davApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '={{ $credentials.baseUrl }}',
			url: '',
			headers: {
				Accept: 'application/xml, text/xml, */*',
				'Content-Type': 'application/xml',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'File',
						value: 'file',
					},
				],
				default: 'file',
			},
			...webDavOperations,
			...webDavFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const item = items[itemIndex];

				switch (operation) {
					case 'get': {
						const path = this.getNodeParameter('path', itemIndex, '') as string;

						const response = await this.helpers.httpRequest({
							method: 'GET',
							url: `/${path}`,
							returnFullResponse: true,
						});

						item.json.fileContent = response.data;
						item.json.contentType = response.headers['content-type'];
						item.json.contentLength = response.headers['content-length'];
						item.json.lastModified = response.headers['last-modified'];
						item.json.etag = response.headers['etag'];
						break;
					}
					case 'put': {
						const path = this.getNodeParameter('path', itemIndex, '') as string;
						const fileContent = this.getNodeParameter('fileContent', itemIndex, '') as string;
						const contentType = this.getNodeParameter('contentType', itemIndex, 'application/octet-stream') as string;

						const response = await this.helpers.httpRequest({
							method: 'PUT',
							url: `/${path}`,
							body: fileContent,
							headers: {
								'Content-Type': contentType,
							},
							returnFullResponse: true,
						});

						item.json.success = true;
						item.json.statusCode = response.status;
						item.json.path = path;
						item.json.contentType = contentType;
						break;
					}
					case 'propfind': {
						const path = this.getNodeParameter('path', itemIndex, '/') as string;
						const depth = this.getNodeParameter('depth', itemIndex, '1') as string;

						const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
	<D:prop>
		<D:getcontenttype/>
		<D:getlastmodified/>
		<D:getcontentlength/>
		<D:resourcetype/>
	</D:prop>
</D:propfind>`;

						const response = await this.helpers.httpRequest({
							method: 'PROPFIND' as any,
							url: path === '/' ? '/' : `/${path}`,
							body: xmlBody,
							headers: {
								Depth: depth,
								'Content-Type': 'application/xml',
							},
							returnFullResponse: true,
						});

						// Parse PROPFIND response
						const parsePropfindResponse = (xmlData: string): any[] => {
							const resources: any[] = [];
							const responseRegex = /<D:response[^>]*>(.*?)<\/D:response>/gs;
							let match;

							while ((match = responseRegex.exec(xmlData)) !== null) {
								const responseXml = match[1];
								const hrefMatch = responseXml.match(/<D:href[^>]*>(.*?)<\/D:href>/);
								const contentTypeMatch = responseXml.match(/<D:getcontenttype[^>]*>(.*?)<\/D:getcontenttype>/);
								const lastModifiedMatch = responseXml.match(/<D:getlastmodified[^>]*>(.*?)<\/D:getlastmodified>/);
								const contentLengthMatch = responseXml.match(/<D:getcontentlength[^>]*>(.*?)<\/D:getcontentlength>/);
								const resourceTypeMatch = responseXml.match(/<D:resourcetype[^>]*>(.*?)<\/D:resourcetype>/);

								if (hrefMatch) {
									resources.push({
										href: decodeURIComponent(hrefMatch[1]),
										contentType: contentTypeMatch ? contentTypeMatch[1] : null,
										lastModified: lastModifiedMatch ? lastModifiedMatch[1] : null,
										contentLength: contentLengthMatch ? parseInt(contentLengthMatch[1]) : null,
										isCollection: resourceTypeMatch ? resourceTypeMatch[1].includes('collection') : false,
									});
								}
							}

							return resources;
						};

						item.json.properties = parsePropfindResponse(response.data);
						item.json.statusCode = response.status;
						break;
					}
					case 'mkcol': {
						const path = this.getNodeParameter('path', itemIndex, '') as string;

						const response = await this.helpers.httpRequest({
							method: 'MKCOL' as any,
							url: `/${path}`,
							returnFullResponse: true,
						});

						item.json.success = response.status === 201;
						item.json.statusCode = response.status;
						item.json.path = path;
						break;
					}
					case 'delete': {
						const path = this.getNodeParameter('path', itemIndex, '') as string;

						const response = await this.helpers.httpRequest({
							method: 'DELETE',
							url: `/${path}`,
							returnFullResponse: true,
						});

						item.json.success = response.status >= 200 && response.status < 300;
						item.json.statusCode = response.status;
						item.json.path = path;
						break;
					}
					case 'move': {
						const path = this.getNodeParameter('path', itemIndex, '') as string;
						const destination = this.getNodeParameter('destination', itemIndex, '') as string;
						const overwrite = this.getNodeParameter('overwrite', itemIndex, false) as boolean;

						const response = await this.helpers.httpRequest({
							method: 'MOVE' as any,
							url: `/${path}`,
							headers: {
								Destination: `/${destination}`,
								Overwrite: overwrite ? 'T' : 'F',
							},
							returnFullResponse: true,
						});

						item.json.success = response.status >= 200 && response.status < 300;
						item.json.statusCode = response.status;
						item.json.sourcePath = path;
						item.json.destinationPath = destination;
						break;
					}
					case 'copy': {
						const path = this.getNodeParameter('path', itemIndex, '') as string;
						const destination = this.getNodeParameter('destination', itemIndex, '') as string;
						const overwrite = this.getNodeParameter('overwrite', itemIndex, false) as boolean;

						const response = await this.helpers.httpRequest({
							method: 'COPY' as any,
							url: `/${path}`,
							headers: {
								Destination: `/${destination}`,
								Overwrite: overwrite ? 'T' : 'F',
							},
							returnFullResponse: true,
						});

						item.json.success = response.status >= 200 && response.status < 300;
						item.json.statusCode = response.status;
						item.json.sourcePath = path;
						item.json.destinationPath = destination;
						break;
					}
					default:
						throw new NodeOperationError(this.getNode(), `Operation ${operation} not supported`);
				}

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
