import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import { calDavFields, calDavOperations } from './CalDavDescription';

export class CalDav implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'CalDAV',
		name: 'calDav',
		icon: { light: 'file:caldav.svg', dark: 'file:caldav.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Interact with CalDAV servers for calendar operations',
		defaults: {
			name: 'CalDAV',
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
						name: 'Calendar',
						value: 'calendar',
					},
				],
				default: 'calendar',
			},
			...calDavOperations,
			...calDavFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const item = items[itemIndex];

				switch (operation) {
					case 'getCalendars': {
						const calendarHomeSet = this.getNodeParameter('calendarHomeSet', itemIndex, '/calendars/user/') as string;

						const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
	<D:prop>
		<D:resourcetype/>
		<D:displayname/>
		<C:calendar-description/>
		<C:supported-calendar-component-set/>
	</D:prop>
	<C:filter>
		<C:comp-filter name="VCALENDAR"/>
	</C:filter>
</C:calendar-query>`;

						const response = await this.helpers.httpRequest({
							method: 'REPORT' as any,
							url: calendarHomeSet,
							body: xmlBody,
							headers: {
								Depth: '1',
								'Content-Type': 'application/xml',
							},
							returnFullResponse: true,
						});

						const parseCalendarsResponse = (xmlData: string): any[] => {
							const calendars: any[] = [];
							const responseRegex = /<D:response[^>]*>(.*?)<\/D:response>/gs;
							let match;

							while ((match = responseRegex.exec(xmlData)) !== null) {
								const responseXml = match[1];
								const hrefMatch = responseXml.match(/<D:href[^>]*>(.*?)<\/D:href>/);
								const displayNameMatch = responseXml.match(/<D:displayname[^>]*>(.*?)<\/D:displayname>/);
								const descriptionMatch = responseXml.match(/<C:calendar-description[^>]*>(.*?)<\/C:calendar-description>/);

								if (hrefMatch) {
									calendars.push({
										href: decodeURIComponent(hrefMatch[1]),
										displayName: displayNameMatch ? displayNameMatch[1] : null,
										description: descriptionMatch ? descriptionMatch[1] : null,
									});
								}
							}

							return calendars;
						};

						item.json.calendars = parseCalendarsResponse(response.data);
						item.json.statusCode = response.status;
						break;
					}
					case 'getEvents': {
						const calendarPath = this.getNodeParameter('calendarPath', itemIndex, '') as string;
						const timeRange = this.getNodeParameter('timeRange', itemIndex, 'all') as string;

						let filterXml = '';
						if (timeRange === 'range') {
							const startDate = this.getNodeParameter('startDate', itemIndex, '') as string;
							const endDate = this.getNodeParameter('endDate', itemIndex, '') as string;
							filterXml = `
	<C:filter>
		<C:comp-filter name="VCALENDAR">
			<C:comp-filter name="VEVENT">
				<C:time-range start="${new Date(startDate).toISOString()}" end="${new Date(endDate).toISOString()}"/>
			</C:comp-filter>
		</C:comp-filter>
	</C:filter>`;
						} else if (timeRange === 'date') {
							const date = this.getNodeParameter('date', itemIndex, '') as string;
							const startOfDay = new Date(date);
							startOfDay.setHours(0, 0, 0, 0);
							const endOfDay = new Date(date);
							endOfDay.setHours(23, 59, 59, 999);
							filterXml = `
	<C:filter>
		<C:comp-filter name="VCALENDAR">
			<C:comp-filter name="VEVENT">
				<C:time-range start="${startOfDay.toISOString()}" end="${endOfDay.toISOString()}"/>
			</C:comp-filter>
		</C:comp-filter>
	</C:filter>`;
						} else {
							filterXml = `
	<C:filter>
		<C:comp-filter name="VCALENDAR">
			<C:comp-filter name="VEVENT"/>
		</C:comp-filter>
	</C:filter>`;
						}

						const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
	<D:prop>
		<D:getetag/>
		<C:calendar-data/>
	</D:prop>${filterXml}
</C:calendar-query>`;

						const response = await this.helpers.httpRequest({
							method: 'REPORT' as any,
							url: calendarPath,
							body: xmlBody,
							headers: {
								'Content-Type': 'application/xml',
							},
							returnFullResponse: true,
						});

						const parseEventsResponse = (xmlData: string): any[] => {
							const events: any[] = [];
							const responseRegex = /<D:response[^>]*>(.*?)<\/D:response>/gs;
							let match;

							while ((match = responseRegex.exec(xmlData)) !== null) {
								const responseXml = match[1];
								const hrefMatch = responseXml.match(/<D:href[^>]*>(.*?)<\/D:href>/);
								const etagMatch = responseXml.match(/<D:getetag[^>]*>(.*?)<\/D:getetag>/);
								const calendarDataMatch = responseXml.match(/<C:calendar-data[^>]*>(.*?)<\/C:calendar-data>/s);

								if (hrefMatch && calendarDataMatch) {
									events.push({
										href: decodeURIComponent(hrefMatch[1]),
										etag: etagMatch ? etagMatch[1] : null,
										calendarData: calendarDataMatch[1],
									});
								}
							}

							return events;
						};

						item.json.events = parseEventsResponse(response.data);
						item.json.statusCode = response.status;
						break;
					}
					case 'createEvent': {
						const calendarPath = this.getNodeParameter('calendarPath', itemIndex, '') as string;
						const eventId = this.getNodeParameter('eventId', itemIndex, '') as string;
						const eventData = this.getNodeParameter('eventData', itemIndex, '') as string;

						const response = await this.helpers.httpRequest({
							method: 'PUT',
							url: `${calendarPath}${eventId}.ics`,
							body: eventData,
							headers: {
								'Content-Type': 'text/calendar',
							},
							returnFullResponse: true,
						});

						item.json.success = response.status >= 200 && response.status < 300;
						item.json.statusCode = response.status;
						item.json.eventId = eventId;
						item.json.calendarPath = calendarPath;
						break;
					}
					case 'updateEvent': {
						const calendarPath = this.getNodeParameter('calendarPath', itemIndex, '') as string;
						const eventId = this.getNodeParameter('eventId', itemIndex, '') as string;
						const eventData = this.getNodeParameter('eventData', itemIndex, '') as string;

						const response = await this.helpers.httpRequest({
							method: 'PUT',
							url: `${calendarPath}${eventId}.ics`,
							body: eventData,
							headers: {
								'Content-Type': 'text/calendar',
								'If-Match': '*',
							},
							returnFullResponse: true,
						});

						item.json.success = response.status >= 200 && response.status < 300;
						item.json.statusCode = response.status;
						item.json.eventId = eventId;
						item.json.calendarPath = calendarPath;
						break;
					}
					case 'deleteEvent': {
						const calendarPath = this.getNodeParameter('calendarPath', itemIndex, '') as string;
						const eventId = this.getNodeParameter('eventId', itemIndex, '') as string;

						const response = await this.helpers.httpRequest({
							method: 'DELETE',
							url: `${calendarPath}${eventId}.ics`,
							returnFullResponse: true,
						});

						item.json.success = response.status >= 200 && response.status < 300;
						item.json.statusCode = response.status;
						item.json.eventId = eventId;
						item.json.calendarPath = calendarPath;
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
