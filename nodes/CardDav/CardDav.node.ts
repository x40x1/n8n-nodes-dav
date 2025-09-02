import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import { cardDavFields, cardDavOperations } from './CardDavDescription';

export class CardDav implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'CardDAV',
		name: 'cardDav',
		icon: { light: 'file:carddav.svg', dark: 'file:carddav.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Interact with CardDAV servers for address book operations',
		defaults: {
			name: 'CardDAV',
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
						name: 'Address Book',
						value: 'addressbook',
					},
				],
				default: 'addressbook',
			},
			...cardDavOperations,
			...cardDavFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		// Validate credentials.baseUrl early to avoid opaque "Invalid URL" errors
		const creds = (await this.getCredentials('davApi')) as { baseUrl?: string };
		const baseUrl = creds?.baseUrl?.toString().trim();
		if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
			throw new NodeOperationError(
				this.getNode(),
				'Invalid Base URL in credentials. Include protocol (http:// or https://), e.g. https://your-server/remote.php/dav',
			);
		}

		// Normalize base root for any manual URL composition (no trailing slash)
		const baseRoot = baseUrl.replace(/\/$/, '');

		// Helper to normalize and encode DAV paths (handles spaces and special chars)
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
		};		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const item = items[itemIndex];

				// Helper to produce richer, user-friendly errors for n8n UI
				const toFriendlyError = (e: any, u: string, resource: string) => {
					const base = `CardDAV ${operation} on ${resource}: "${u}"`;
					const msg = String(e?.message || e);

					if (/Invalid URL/i.test(msg)) {
						return `Invalid URL for ${base}. Ensure Base URL has protocol (https://) and path starts with "/". Spaces/special chars are auto-encoded.`;
					}
					if (e?.code === 'ENOTFOUND') return `Host not found for ${base}. Check the server hostname in credentials.`;
					if (e?.code === 'ECONNREFUSED') return `Connection refused for ${base}. Server unreachable or port blocked.`;
					if (e?.code === 'ETIMEDOUT') return `Connection timed out for ${base}. Server slow or network issues.`;

					const status = e?.statusCode ?? e?.response?.status ?? e?.cause?.response?.status;
					const statusText = e?.response?.statusText ?? e?.cause?.response?.statusText;
					if (status) return `HTTP ${status}${statusText ? ` ${statusText}` : ''} for ${base}.`;
					return `${msg} (${base})`;
				};

				const doRequest = async (opts: Parameters<typeof this.helpers.httpRequest>[0]) => {
					try {
						// Compose absolute URL when only a path is provided
						const urlStr = String((opts as any)?.url ?? '');
						(opts as any).__displayUrl = /^https?:\/\//i.test(urlStr) ? urlStr : normalizePath(urlStr);
						if (!/^https?:\/\//i.test(urlStr)) {
							(opts as any).url = `${baseRoot}${normalizePath(urlStr)}`;
							delete (opts as any).baseURL;
						}
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
					case 'getAddressBooks': {
						let addressBookHomeSet = this.getNodeParameter('addressBookHomeSet', itemIndex, '/addressbooks/user/') as string;
						addressBookHomeSet = normalizePath(addressBookHomeSet);

						const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:carddav">
	<D:prop>
		<D:resourcetype/>
		<D:displayname/>
		<C:addressbook-description/>
		<C:supported-address-data/>
	</D:prop>
</D:propfind>`;

						const response = await doRequest({
							method: 'PROPFIND' as any,
							url: addressBookHomeSet,
							body: xmlBody,
							headers: {
								Depth: '1',
								'Content-Type': 'application/xml',
							},
							returnFullResponse: true,
						});

						const parseAddressBooksResponse = (xmlData: string): any[] => {
							const addressBooks: any[] = [];
							const responseRegex = /<D:response[^>]*>(.*?)<\/D:response>/gs;
							let match;

							while ((match = responseRegex.exec(xmlData)) !== null) {
								const responseXml = match[1];
								const hrefMatch = responseXml.match(/<D:href[^>]*>(.*?)<\/D:href>/);
								const displayNameMatch = responseXml.match(/<D:displayname[^>]*>(.*?)<\/D:displayname>/);
								const descriptionMatch = responseXml.match(/<C:addressbook-description[^>]*>(.*?)<\/C:addressbook-description>/);

								if (hrefMatch) {
									addressBooks.push({
										href: decodeURIComponent(hrefMatch[1]),
										displayName: displayNameMatch ? displayNameMatch[1] : null,
										description: descriptionMatch ? descriptionMatch[1] : null,
									});
								}
							}

							return addressBooks;
						};

						item.json.addressBooks = parseAddressBooksResponse(response.data);
						item.json.statusCode = response.status;
						break;
					}
					case 'getContacts': {
						let addressBookPath = this.getNodeParameter('addressBookPath', itemIndex, '') as string;
						addressBookPath = normalizePath(addressBookPath);
						const filter = this.getNodeParameter('filter', itemIndex, 'all') as string;

						let filterXml = '';
						if (filter === 'name') {
							const searchTerm = this.getNodeParameter('searchTerm', itemIndex, '') as string;
							filterXml = `
	<C:filter>
		<C:prop-filter name="FN">
			<C:text-match>${searchTerm}</C:text-match>
		</C:prop-filter>
	</C:filter>`;
						} else if (filter === 'email') {
							const searchTerm = this.getNodeParameter('searchTerm', itemIndex, '') as string;
							filterXml = `
	<C:filter>
		<C:prop-filter name="EMAIL">
			<C:text-match>${searchTerm}</C:text-match>
		</C:prop-filter>
	</C:filter>`;
						} else {
							filterXml = `
	<C:filter>
		<C:prop-filter name="FN"/>
	</C:filter>`;
						}

						const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<C:addressbook-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:carddav">
	<D:prop>
		<D:getetag/>
		<C:address-data/>
	</D:prop>${filterXml}
</C:addressbook-query>`;

						const response = await doRequest({
							method: 'REPORT' as any,
							url: addressBookPath,
							body: xmlBody,
							headers: {
								'Content-Type': 'application/xml',
							},
							returnFullResponse: true,
						});

						const parseContactsResponse = (xmlData: string): any[] => {
							const contacts: any[] = [];
							const responseRegex = /<D:response[^>]*>(.*?)<\/D:response>/gs;
							let match;

							while ((match = responseRegex.exec(xmlData)) !== null) {
								const responseXml = match[1];
								const hrefMatch = responseXml.match(/<D:href[^>]*>(.*?)<\/D:href>/);
								const etagMatch = responseXml.match(/<D:getetag[^>]*>(.*?)<\/D:getetag>/);
								const addressDataMatch = responseXml.match(/<C:address-data[^>]*>(.*?)<\/C:address-data>/s);

								if (hrefMatch && addressDataMatch) {
									contacts.push({
										href: decodeURIComponent(hrefMatch[1]),
										etag: etagMatch ? etagMatch[1] : null,
										addressData: addressDataMatch[1],
									});
								}
							}

							return contacts;
						};

						item.json.contacts = parseContactsResponse(response.data);
						item.json.statusCode = response.status;
						break;
					}
					case 'createContact': {
						let addressBookPath = this.getNodeParameter('addressBookPath', itemIndex, '') as string;
						const contactId = this.getNodeParameter('contactId', itemIndex, '') as string;
						const contactData = this.getNodeParameter('contactData', itemIndex, '') as string;
						addressBookPath = normalizePath(addressBookPath);

						const response = await doRequest({
							method: 'PUT',
							url: normalizePath(`${addressBookPath}/${contactId}.vcf`),
							body: contactData,
							headers: {
								'Content-Type': 'text/vcard',
							},
							returnFullResponse: true,
						});

						item.json.success = response.status >= 200 && response.status < 300;
						item.json.statusCode = response.status;
						item.json.contactId = contactId;
						item.json.addressBookPath = addressBookPath;
						break;
					}
					case 'updateContact': {
						let addressBookPath = this.getNodeParameter('addressBookPath', itemIndex, '') as string;
						const contactId = this.getNodeParameter('contactId', itemIndex, '') as string;
						const contactData = this.getNodeParameter('contactData', itemIndex, '') as string;
						addressBookPath = normalizePath(addressBookPath);

						const response = await doRequest({
							method: 'PUT',
							url: normalizePath(`${addressBookPath}/${contactId}.vcf`),
							body: contactData,
							headers: {
								'Content-Type': 'text/vcard',
								'If-Match': '*',
							},
							returnFullResponse: true,
						});

						item.json.success = response.status >= 200 && response.status < 300;
						item.json.statusCode = response.status;
						item.json.contactId = contactId;
						item.json.addressBookPath = addressBookPath;
						break;
					}
					case 'deleteContact': {
						let addressBookPath = this.getNodeParameter('addressBookPath', itemIndex, '') as string;
						const contactId = this.getNodeParameter('contactId', itemIndex, '') as string;
						addressBookPath = normalizePath(addressBookPath);

						const response = await doRequest({
							method: 'DELETE',
							url: normalizePath(`${addressBookPath}/${contactId}.vcf`),
							returnFullResponse: true,
						});

						item.json.success = response.status >= 200 && response.status < 300;
						item.json.statusCode = response.status;
						item.json.contactId = contactId;
						item.json.addressBookPath = addressBookPath;
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
