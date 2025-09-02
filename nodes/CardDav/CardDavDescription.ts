import { INodeProperties } from 'n8n-workflow';

// CardDAV Operations
export const cardDavOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['addressbook'],
			},
		},
		options: [
			{
				name: 'Get Address Books',
				value: 'getAddressBooks',
				description: 'Retrieve list of available address books',
				action: 'Get list of address books',
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
				name: 'Get Contacts',
				value: 'getContacts',
				description: 'Retrieve contacts from an address book',
				action: 'Get address book contacts',
				routing: {
					request: {
						method: 'REPORT' as any,
						url: '/{{addressBookPath}}',
					},
				},
			},
			{
				name: 'Create Contact',
				value: 'createContact',
				description: 'Create a new contact',
				action: 'Create contact',
				routing: {
					request: {
						method: 'PUT',
						url: '/{{addressBookPath}}/{{contactId}}.vcf',
					},
				},
			},
			{
				name: 'Update Contact',
				value: 'updateContact',
				description: 'Update an existing contact',
				action: 'Update contact',
				routing: {
					request: {
						method: 'PUT',
						url: '/{{addressBookPath}}/{{contactId}}.vcf',
					},
				},
			},
			{
				name: 'Delete Contact',
				value: 'deleteContact',
				description: 'Delete a contact',
				action: 'Delete contact',
				routing: {
					request: {
						method: 'DELETE',
						url: '/{{addressBookPath}}/{{contactId}}.vcf',
					},
				},
			},
		],
		default: 'getAddressBooks',
	},
];

// CardDAV Fields
const getAddressBooksOperationFields: INodeProperties[] = [
	{
		displayName: 'Address Book Home Set',
		name: 'addressBookHomeSet',
		type: 'string',
		default: '/addressbooks/user/',
		placeholder: '/addressbooks/user/',
		description: 'Path to the address book home set on the CardDAV server. Start with "/". Spaces and special characters are auto-encoded.',
		displayOptions: {
			show: {
				resource: ['addressbook'],
				operation: ['getAddressBooks'],
			},
		},
		required: true,
	},
];

const getContactsOperationFields: INodeProperties[] = [
	{
		displayName: 'Address Book Path',
		name: 'addressBookPath',
		type: 'string',
		default: '',
		placeholder: '/addressbooks/user/contacts/',
		description: 'Path to the specific address book. Start with "/". Spaces and special characters are auto-encoded.',
		displayOptions: {
			show: {
				resource: ['addressbook'],
				operation: ['getContacts'],
			},
		},
		required: true,
	},
	{
		displayName: 'Filter',
		name: 'filter',
		type: 'options',
		default: 'all',
		description: 'Filter for contacts to retrieve',
		displayOptions: {
			show: {
				resource: ['addressbook'],
				operation: ['getContacts'],
			},
		},
		options: [
			{
				name: 'All Contacts',
				value: 'all',
			},
			{
				name: 'By Name',
				value: 'name',
			},
			{
				name: 'By Email',
				value: 'email',
			},
		],
	},
	{
		displayName: 'Search Term',
		name: 'searchTerm',
		type: 'string',
		default: '',
		placeholder: 'John Doe',
		description: 'Search term for filtering contacts',
		displayOptions: {
			show: {
				resource: ['addressbook'],
				operation: ['getContacts'],
				filter: ['name', 'email'],
			},
		},
	},
];

const createContactOperationFields: INodeProperties[] = [
	{
		displayName: 'Address Book Path',
		name: 'addressBookPath',
		type: 'string',
		default: '',
		placeholder: '/addressbooks/user/contacts/',
		description: 'Path to the address book where the contact will be created. Start with "/". Spaces and special characters are auto-encoded.',
		displayOptions: {
			show: {
				resource: ['addressbook'],
				operation: ['createContact'],
			},
		},
		required: true,
	},
	{
		displayName: 'Contact ID',
		name: 'contactId',
		type: 'string',
		default: '',
		placeholder: 'contact-123',
		description: 'Unique identifier for the contact',
		displayOptions: {
			show: {
				resource: ['addressbook'],
				operation: ['createContact'],
			},
		},
		required: true,
	},
	{
		displayName: 'Contact Data (vCard)',
		name: 'contactData',
		type: 'string',
		default: '',
		description: 'VCard (.vcf) formatted contact data',
		displayOptions: {
			show: {
				resource: ['addressbook'],
				operation: ['createContact'],
			},
		},
		required: true,
	},
];

const updateContactOperationFields: INodeProperties[] = [
	{
		displayName: 'Address Book Path',
		name: 'addressBookPath',
		type: 'string',
		default: '',
		placeholder: '/addressbooks/user/contacts/',
		description: 'Path to the address book containing the contact. Start with "/". Spaces and special characters are auto-encoded.',
		displayOptions: {
			show: {
				resource: ['addressbook'],
				operation: ['updateContact'],
			},
		},
		required: true,
	},
	{
		displayName: 'Contact ID',
		name: 'contactId',
		type: 'string',
		default: '',
		placeholder: 'contact-123',
		description: 'Unique identifier of the contact to update',
		displayOptions: {
			show: {
				resource: ['addressbook'],
				operation: ['updateContact'],
			},
		},
		required: true,
	},
	{
		displayName: 'Contact Data (vCard)',
		name: 'contactData',
		type: 'string',
		default: '',
		description: 'Updated vCard (.vcf) formatted contact data',
		displayOptions: {
			show: {
				resource: ['addressbook'],
				operation: ['updateContact'],
			},
		},
		required: true,
	},
];

const deleteContactOperationFields: INodeProperties[] = [
	{
		displayName: 'Address Book Path',
		name: 'addressBookPath',
		type: 'string',
		default: '',
		placeholder: '/addressbooks/user/contacts/',
		description: 'Path to the address book containing the contact. Start with "/". Spaces and special characters are auto-encoded.',
		displayOptions: {
			show: {
				resource: ['addressbook'],
				operation: ['deleteContact'],
			},
		},
		required: true,
	},
	{
		displayName: 'Contact ID',
		name: 'contactId',
		type: 'string',
		default: '',
		placeholder: 'contact-123',
		description: 'Unique identifier of the contact to delete',
		displayOptions: {
			show: {
				resource: ['addressbook'],
				operation: ['deleteContact'],
			},
		},
		required: true,
	},
];

export const cardDavFields: INodeProperties[] = [
	/* -------------------------------------------------------------------------- */
	/*                          addressbook:getAddressBooks                       */
	/* -------------------------------------------------------------------------- */
	...getAddressBooksOperationFields,

	/* -------------------------------------------------------------------------- */
	/*                           addressbook:getContacts                          */
	/* -------------------------------------------------------------------------- */
	...getContactsOperationFields,

	/* -------------------------------------------------------------------------- */
	/*                          addressbook:createContact                         */
	/* -------------------------------------------------------------------------- */
	...createContactOperationFields,

	/* -------------------------------------------------------------------------- */
	/*                          addressbook:updateContact                         */
	/* -------------------------------------------------------------------------- */
	...updateContactOperationFields,

	/* -------------------------------------------------------------------------- */
	/*                          addressbook:deleteContact                         */
	/* -------------------------------------------------------------------------- */
	...deleteContactOperationFields,
];
