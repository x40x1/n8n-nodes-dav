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

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const item = items[itemIndex];

				switch (operation) {
					case 'getAddressBooks': {
						const addressBookHomeSet = this.getNodeParameter('addressBookHomeSet', itemIndex, '/addressbooks/user/') as string;

						const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<C:addressbook-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:carddav">
	<D:prop>
		<D:resourcetype/>
		<D:displayname/>
		<C:addressbook-description/>
		<C:supported-address-data/>
	</D:prop>
	<C:filter>
		<C:prop-filter name="FN"/>
	</C:filter>
</C:addressbook-query>`;

						const response = await this.helpers.httpRequest({
							method: 'REPORT' as any,
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
						const addressBookPath = this.getNodeParameter('addressBookPath', itemIndex, '') as string;
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

						const response = await this.helpers.httpRequest({
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
						const addressBookPath = this.getNodeParameter('addressBookPath', itemIndex, '') as string;
						const contactId = this.getNodeParameter('contactId', itemIndex, '') as string;
						const contactData = this.getNodeParameter('contactData', itemIndex, '') as string;

						const response = await this.helpers.httpRequest({
							method: 'PUT',
							url: `${addressBookPath}${contactId}.vcf`,
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
						const addressBookPath = this.getNodeParameter('addressBookPath', itemIndex, '') as string;
						const contactId = this.getNodeParameter('contactId', itemIndex, '') as string;
						const contactData = this.getNodeParameter('contactData', itemIndex, '') as string;

						const response = await this.helpers.httpRequest({
							method: 'PUT',
							url: `${addressBookPath}${contactId}.vcf`,
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
						const addressBookPath = this.getNodeParameter('addressBookPath', itemIndex, '') as string;
						const contactId = this.getNodeParameter('contactId', itemIndex, '') as string;

						const response = await this.helpers.httpRequest({
							method: 'DELETE',
							url: `${addressBookPath}${contactId}.vcf`,
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
