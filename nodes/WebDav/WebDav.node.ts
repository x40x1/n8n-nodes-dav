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
		const returnItems: INodeExecutionData[] = [];

		// Validate credentials.baseUrl early to avoid opaque "Invalid URL" errors
		const creds = (await this.getCredentials('davApi')) as { baseUrl?: string };
		const baseUrl = creds?.baseUrl?.toString().trim();
		if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
			throw new NodeOperationError(
				this.getNode(),
				'Invalid Base URL in credentials. Include protocol (http:// or https://), e.g. https://your-server/remote.php/dav',
			);
		}

		// Normalize base root for manual URL composition (no trailing slash)
		const baseRoot = baseUrl.replace(/\/$/, '');

		// Helper to normalize and safely encode a DAV path (handles spaces and special chars)
		const normalizePath = (p: string): string => {
			if (!p || p === '/') return '/';
			// Disallow absolute external URLs to avoid SSRF/credential leakage
			if (/^https?:\/\//i.test(p)) {
				throw new NodeOperationError(this.getNode(), 'Absolute URLs are not allowed in path fields. Use a server-relative path starting with "/".');
			}
			const raw = p.startsWith('/') ? p.slice(1) : p;
			const encoded = raw
				.split('/')
				.map((seg) => {
					if (!seg) return '';
					try {
						return encodeURIComponent(decodeURIComponent(seg));
					} catch {
						return encodeURIComponent(seg);
					}
				})
				.join('/');
			return `/${encoded}`;
		};

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				// const item = items[itemIndex];

				// Helper to produce richer, user-friendly errors for n8n UI
				const toFriendlyError = (e: any, u: string, resource: string) => {
					const base = `WebDAV ${operation} on ${resource}: "${u}"`;
					const msg = String(e?.message || e);

					// Node URL construction failures
					if (/Invalid URL/i.test(msg)) {
						return `Invalid URL for ${base}. Ensure Base URL has protocol (https://) and path starts with "/". Spaces/special chars are auto-encoded.`;
					}

					// Common network errors
					if (e?.code === 'ENOTFOUND') return `Host not found for ${base}. Check the server hostname in credentials.`;
					if (e?.code === 'ECONNREFUSED') return `Connection refused for ${base}. Server unreachable or port blocked.`;
					if (e?.code === 'ETIMEDOUT') return `Connection timed out for ${base}. Server slow or network issues.`;

					// HTTP error responses (n8n wraps errors; try a few shapes)
					const status = e?.statusCode ?? e?.response?.status ?? e?.cause?.response?.status;
					const statusText = e?.response?.statusText ?? e?.cause?.response?.statusText;
					if (status) {
						return `HTTP ${status}${statusText ? ` ${statusText}` : ''} for ${base}.`;
					}

					// Fallback to original message
					return `${msg} (${base})`;
				};

				const doRequest = async (opts: Parameters<typeof this.helpers.httpRequest>[0]) => {
					try {
						// Compose absolute URL when only a path is provided
						const urlStr = String((opts as any)?.url ?? '');
						// Preserve a display URL for friendly error messages
						(opts as any).__displayUrl = /^https?:\/\//i.test(urlStr) ? urlStr : normalizePath(urlStr);
						if (!/^https?:\/\//i.test(urlStr)) {
							(opts as any).url = `${baseRoot}${normalizePath(urlStr)}`;
							delete (opts as any).baseURL;
						}
						// Use authenticated request if available
						const hAny = this.helpers as any;
						if (typeof hAny.httpRequestWithAuthentication === 'function') {
							return await hAny.httpRequestWithAuthentication.call(this, 'davApi', opts as any);
						}
						if (typeof hAny.requestWithAuthentication === 'function') {
							return await hAny.requestWithAuthentication.call(this, 'davApi', opts as any);
						}
						return await this.helpers.httpRequest(opts as any);
					} catch (e: any) {
						const u = (opts as any).__displayUrl ?? (opts as any)?.url;
						const resource = this.getNodeParameter('resource', itemIndex) as string;
						const friendly = toFriendlyError(e, u, resource);
						throw new NodeOperationError(this.getNode(), friendly, { itemIndex });
					}
				};

				switch (operation) {
                                        case 'get': {
                                                const path = this.getNodeParameter('path', itemIndex, '') as string;

                                                const response = await doRequest({
                                                        method: 'GET',
                                                        url: normalizePath(path),
                                                        // ensure raw bytes for binary output
                                                        returnFullResponse: true,
                                                } as Parameters<typeof this.helpers.httpRequest>[0]);

                                                const rawData =
                                                        (response.data ?? response.body) as
                                                                | Buffer
                                                                | ArrayBuffer
                                                                | string
                                                                | undefined;
                                                if (rawData === undefined) {
                                                        throw new NodeOperationError(
                                                                this.getNode(),
                                                                `No data returned from WebDAV for path "${path}"`,
                                                                { itemIndex },
                                                        );
                                                }

                                                const dataBuffer = Buffer.isBuffer(rawData)
                                                        ? (rawData as Buffer)
                                                        : Buffer.from(rawData as any);
                                                const contentType = response.headers['content-type'] as string | undefined;
                                                if (
                                                        contentType &&
                                                        contentType.toLowerCase().includes('application/json')
                                                ) {
                                                        throw new NodeOperationError(
                                                                this.getNode(),
                                                                `Expected binary response but received JSON from WebDAV for path "${path}"`,
                                                                { itemIndex },
                                                        );
                                                }
                                                const contentLength = response.headers['content-length'] as string | undefined;
                                                const lastModified = response.headers['last-modified'] as string | undefined;
                                                const etag = response.headers['etag'] as string | undefined;
                                                const segs = normalizePath(path).split('/').filter(Boolean);
                                                const fileName = segs[segs.length - 1] || 'file';
                                                const binary = await this.helpers.prepareBinaryData(
                                                        dataBuffer,
                                                        fileName,
                                                        contentType,
                                                );

                                                returnItems.push({
                                                        json: {
                                                                path,
                                                                contentType: contentType ?? 'application/octet-stream',
                                                                contentLength: contentLength
                                                                        ? Number(contentLength)
                                                                        : dataBuffer.length,
                                                                lastModified: lastModified ?? null,
                                                                etag: etag ?? null,
                                                                statusCode: response.status,
                                                        },
                                                        binary: { data: binary },
                                                });
                                                break;
                                        }
					case 'put': {
						const path = this.getNodeParameter('path', itemIndex, '') as string;
						const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex, 'data') as string;
						const inputItem = items[itemIndex];
						if (!inputItem.binary || !inputItem.binary[binaryPropertyName]) {
							throw new NodeOperationError(this.getNode(), `Input item is missing binary property "${binaryPropertyName}"`, { itemIndex });
						}
						const binData = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
						const contentType = inputItem.binary[binaryPropertyName].mimeType || 'application/octet-stream';

						const response = await doRequest({
							method: 'PUT',
							url: normalizePath(path),
							body: binData as unknown as Buffer,
							headers: {
								'Content-Type': contentType,
							},
							returnFullResponse: true,
						});

						returnItems.push({
							json: { success: response.status >= 200 && response.status < 300, statusCode: response.status, path, contentType },
						});
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

						const response = await doRequest({
							method: 'PROPFIND' as any,
							url: path === '/' ? '/' : normalizePath(path),
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
						returnItems.push({ json: { properties: parsePropfindResponse(response.data), statusCode: response.status } });
						break;
					}
					case 'mkcol': {
						const path = this.getNodeParameter('path', itemIndex, '') as string;

						const response = await doRequest({
							method: 'MKCOL' as any,
							url: normalizePath(path),
							returnFullResponse: true,
						});

						returnItems.push({ json: { success: response.status === 201, statusCode: response.status, path } });
						break;
					}
					case 'delete': {
						const path = this.getNodeParameter('path', itemIndex, '') as string;

						const response = await doRequest({
							method: 'DELETE',
							url: normalizePath(path),
							returnFullResponse: true,
						});

						returnItems.push({ json: { success: response.status >= 200 && response.status < 300, statusCode: response.status, path } });
						break;
					}
					case 'move': {
						const path = this.getNodeParameter('path', itemIndex, '') as string;
						const destination = this.getNodeParameter('destination', itemIndex, '') as string;
						const overwrite = this.getNodeParameter('overwrite', itemIndex, false) as boolean;

						// Allow absolute destination only if same-origin as base URL
						let destinationHeader: string;
						if (/^https?:\/\//i.test(destination)) {
							const destUrl = new URL(destination);
							const base = new URL(baseRoot);
							if (destUrl.origin !== base.origin) {
								throw new NodeOperationError(this.getNode(), 'Destination must be on the same server as the Base URL');
							}
							destinationHeader = destUrl.toString();
						} else {
							destinationHeader = `${baseRoot}${normalizePath(destination)}`;
						}

						const response = await doRequest({
							method: 'MOVE' as any,
							url: normalizePath(path),
							headers: {
								Destination: destinationHeader,
								Overwrite: overwrite ? 'T' : 'F',
							},
							returnFullResponse: true,
						});

						returnItems.push({ json: { success: response.status >= 200 && response.status < 300, statusCode: response.status, sourcePath: path, destinationPath: destination } });
						break;
					}
					case 'copy': {
						const path = this.getNodeParameter('path', itemIndex, '') as string;
						const destination = this.getNodeParameter('destination', itemIndex, '') as string;
						const overwrite = this.getNodeParameter('overwrite', itemIndex, false) as boolean;

						let destinationHeader: string;
						if (/^https?:\/\//i.test(destination)) {
							const destUrl = new URL(destination);
							const base = new URL(baseRoot);
							if (destUrl.origin !== base.origin) {
								throw new NodeOperationError(this.getNode(), 'Destination must be on the same server as the Base URL');
							}
							destinationHeader = destUrl.toString();
						} else {
							destinationHeader = `${baseRoot}${normalizePath(destination)}`;
						}

						const response = await doRequest({
							method: 'COPY' as any,
							url: normalizePath(path),
							headers: {
								Destination: destinationHeader,
								Overwrite: overwrite ? 'T' : 'F',
							},
							returnFullResponse: true,
						});

						returnItems.push({ json: { success: response.status >= 200 && response.status < 300, statusCode: response.status, sourcePath: path, destinationPath: destination } });
						break;
					}
					default:
						throw new NodeOperationError(this.getNode(), `Operation ${operation} not supported`);
				}

			} catch (error) {
				if (this.continueOnFail()) {
					returnItems.push({ json: { error: (error as Error).message }, pairedItem: itemIndex });
				} else {
					if ((error as any).context) {
						(error as any).context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error as any, { itemIndex });
				}
			}
		}

		return [returnItems];
	}
}
