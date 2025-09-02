import { INodeProperties } from 'n8n-workflow';

// CalDAV Operations
export const calDavOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['calendar'],
			},
		},
		options: [
			{
				name: 'Get Calendars',
				value: 'getCalendars',
				description: 'Retrieve list of available calendars',
				action: 'Get list of calendars',
				routing: {
					request: {
						method: 'PROPFIND' as any,
						url: '/',
						headers: {
							Depth: '1',
						},
					},
				},
			},
			{
				name: 'Get Events',
				value: 'getEvents',
				description: 'Retrieve calendar events',
				action: 'Get calendar events',
				routing: {
					request: {
						method: 'REPORT' as any,
						url: '/{{calendarPath}}',
					},
				},
			},
			{
				name: 'Create Event',
				value: 'createEvent',
				description: 'Create a new calendar event',
				action: 'Create calendar event',
				routing: {
					request: {
						method: 'PUT',
						url: '/{{calendarPath}}/{{eventId}}.ics',
					},
				},
			},
			{
				name: 'Update Event',
				value: 'updateEvent',
				description: 'Update an existing calendar event',
				action: 'Update calendar event',
				routing: {
					request: {
						method: 'PUT',
						url: '/{{calendarPath}}/{{eventId}}.ics',
					},
				},
			},
			{
				name: 'Delete Event',
				value: 'deleteEvent',
				description: 'Delete a calendar event',
				action: 'Delete calendar event',
				routing: {
					request: {
						method: 'DELETE',
						url: '/{{calendarPath}}/{{eventId}}.ics',
					},
				},
			},
		],
		default: 'getCalendars',
	},
];

// CalDAV Fields
const getCalendarsOperationFields: INodeProperties[] = [
	{
		displayName: 'Calendar Home Set',
		name: 'calendarHomeSet',
		type: 'string',
		default: '/calendars/user/',
		placeholder: '/calendars/user/',
		description: 'Path to the calendar home set on the CalDAV server. Start with "/". Spaces and special characters are auto-encoded.',
		displayOptions: {
			show: {
				resource: ['calendar'],
				operation: ['getCalendars'],
			},
		},
		required: true,
	},
];

const getEventsOperationFields: INodeProperties[] = [
	{
		displayName: 'Calendar Path',
		name: 'calendarPath',
		type: 'string',
		default: '',
		placeholder: '/calendars/user/calendar/',
		description: 'Path to the specific calendar. Start with "/". Spaces and special characters are auto-encoded.',
		displayOptions: {
			show: {
				resource: ['calendar'],
				operation: ['getEvents'],
			},
		},
		required: true,
	},
	{
		displayName: 'Time Range',
		name: 'timeRange',
		type: 'options',
		default: 'all',
		description: 'Time range for events to retrieve',
		displayOptions: {
			show: {
				resource: ['calendar'],
				operation: ['getEvents'],
			},
		},
		options: [
			{
				name: 'All Events',
				value: 'all',
			},
			{
				name: 'Date Range',
				value: 'range',
			},
			{
				name: 'Specific Date',
				value: 'date',
			},
		],
	},
	{
		displayName: 'Start Date',
		name: 'startDate',
		type: 'dateTime',
		default: '',
		description: 'Start date for event retrieval (ISO format)',
		displayOptions: {
			show: {
				resource: ['calendar'],
				operation: ['getEvents'],
				timeRange: ['range'],
			},
		},
	},
	{
		displayName: 'End Date',
		name: 'endDate',
		type: 'dateTime',
		default: '',
		description: 'End date for event retrieval (ISO format)',
		displayOptions: {
			show: {
				resource: ['calendar'],
				operation: ['getEvents'],
				timeRange: ['range'],
			},
		},
	},
	{
		displayName: 'Date',
		name: 'date',
		type: 'dateTime',
		default: '',
		description: 'Specific date for event retrieval (ISO format)',
		displayOptions: {
			show: {
				resource: ['calendar'],
				operation: ['getEvents'],
				timeRange: ['date'],
			},
		},
	},
];

const createEventOperationFields: INodeProperties[] = [
	{
		displayName: 'Calendar Path',
		name: 'calendarPath',
		type: 'string',
		default: '',
		placeholder: '/calendars/user/calendar/',
		description: 'Path to the calendar where the event will be created. Start with "/". Spaces and special characters are auto-encoded.',
		displayOptions: {
			show: {
				resource: ['calendar'],
				operation: ['createEvent'],
			},
		},
		required: true,
	},
	{
		displayName: 'Event ID',
		name: 'eventId',
		type: 'string',
		default: '',
		placeholder: 'event-123',
		description: 'Unique identifier for the event',
		displayOptions: {
			show: {
				resource: ['calendar'],
				operation: ['createEvent'],
			},
		},
		required: true,
	},
	{
		displayName: 'Event Data (iCalendar)',
		name: 'eventData',
		type: 'string',
		default: '',
		description: 'ICalendar (.ics) formatted event data',
		displayOptions: {
			show: {
				resource: ['calendar'],
				operation: ['createEvent'],
			},
		},
		required: true,
	},
];

const updateEventOperationFields: INodeProperties[] = [
	{
		displayName: 'Calendar Path',
		name: 'calendarPath',
		type: 'string',
		default: '',
		placeholder: '/calendars/user/calendar/',
		description: 'Path to the calendar containing the event. Start with "/". Spaces and special characters are auto-encoded.',
		displayOptions: {
			show: {
				resource: ['calendar'],
				operation: ['updateEvent'],
			},
		},
		required: true,
	},
	{
		displayName: 'Event ID',
		name: 'eventId',
		type: 'string',
		default: '',
		placeholder: 'event-123',
		description: 'Unique identifier of the event to update',
		displayOptions: {
			show: {
				resource: ['calendar'],
				operation: ['updateEvent'],
			},
		},
		required: true,
	},
	{
		displayName: 'Event Data (iCalendar)',
		name: 'eventData',
		type: 'string',
		default: '',
		description: 'Updated iCalendar (.ics) formatted event data',
		displayOptions: {
			show: {
				resource: ['calendar'],
				operation: ['updateEvent'],
			},
		},
		required: true,
	},
];

const deleteEventOperationFields: INodeProperties[] = [
	{
		displayName: 'Calendar Path',
		name: 'calendarPath',
		type: 'string',
		default: '',
		placeholder: '/calendars/user/calendar/',
		description: 'Path to the calendar containing the event. Start with "/". Spaces and special characters are auto-encoded.',
		displayOptions: {
			show: {
				resource: ['calendar'],
				operation: ['deleteEvent'],
			},
		},
		required: true,
	},
	{
		displayName: 'Event ID',
		name: 'eventId',
		type: 'string',
		default: '',
		placeholder: 'event-123',
		description: 'Unique identifier of the event to delete',
		displayOptions: {
			show: {
				resource: ['calendar'],
				operation: ['deleteEvent'],
			},
		},
		required: true,
	},
];

export const calDavFields: INodeProperties[] = [
	/* -------------------------------------------------------------------------- */
	/*                            calendar:getCalendars                           */
	/* -------------------------------------------------------------------------- */
	...getCalendarsOperationFields,

	/* -------------------------------------------------------------------------- */
	/*                              calendar:getEvents                            */
	/* -------------------------------------------------------------------------- */
	...getEventsOperationFields,

	/* -------------------------------------------------------------------------- */
	/*                             calendar:createEvent                           */
	/* -------------------------------------------------------------------------- */
	...createEventOperationFields,

	/* -------------------------------------------------------------------------- */
	/*                             calendar:updateEvent                           */
	/* -------------------------------------------------------------------------- */
	...updateEventOperationFields,

	/* -------------------------------------------------------------------------- */
	/*                             calendar:deleteEvent                           */
	/* -------------------------------------------------------------------------- */
	...deleteEventOperationFields,
];
