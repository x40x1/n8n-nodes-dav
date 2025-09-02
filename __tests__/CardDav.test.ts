import { CardDav } from '../nodes/CardDav/CardDav.node';

// Mock n8n workflow
jest.mock('n8n-workflow', () => ({
  NodeConnectionType: { Main: 'main' },
  NodeOperationError: class NodeOperationError extends Error {
    constructor(node: any, message: string) {
      super(message);
      this.name = 'NodeOperationError';
    }
  },
}));

describe('CardDav Node - URL and Path Handling', () => {
  let cardDavNode: CardDav;
  let mockGetCredentials: jest.Mock;
  let mockGetNodeParameter: jest.Mock;
  let mockGetInputData: jest.Mock;
  let mockHelpers: any;

  beforeEach(() => {
    cardDavNode = new CardDav();

    mockGetCredentials = jest.fn();
    mockGetNodeParameter = jest.fn();
    mockGetInputData = jest.fn();
    mockHelpers = {
      httpRequest: jest.fn(),
    };

    (cardDavNode as any).getCredentials = mockGetCredentials;
    (cardDavNode as any).getNodeParameter = mockGetNodeParameter;
    (cardDavNode as any).getInputData = mockGetInputData;
    (cardDavNode as any).helpers = mockHelpers;
    (cardDavNode as any).getNode = jest.fn(() => ({ name: 'CardDAV' }));
    (cardDavNode as any).continueOnFail = jest.fn(() => false);
  });

  describe('Path Normalization', () => {
    test('should normalize address book paths with spaces', () => {
      const normalizePath = (p: string): string => {
        if (!p || p === '/') return '/';
        if (/^https?:\/\//i.test(p)) return p;
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

      expect(normalizePath('addressbooks/user/My Contacts')).toBe('/addressbooks/user/My%20Contacts');
      expect(normalizePath('/addressbooks/user/work')).toBe('/addressbooks/user/work');
    });
  });

  describe('Error Messages', () => {
    test('should provide detailed error for invalid URL in address book request', async () => {
      mockGetCredentials.mockResolvedValue({ baseUrl: 'https://carddav.example.com' });
      mockGetInputData.mockReturnValue([{ json: {} }]);
      mockGetNodeParameter
        .mockReturnValueOnce('getAddressBooks')   // operation
        .mockReturnValueOnce('addressbooks/user') // addressBookHomeSet
        .mockReturnValueOnce('addressbook');      // resource

      const invalidUrlError = new Error('Invalid URL');
      mockHelpers.httpRequest.mockRejectedValue(invalidUrlError);

      await expect((cardDavNode as any).execute()).rejects.toThrow(
        'Invalid URL for CardDAV getAddressBooks on addressbook: "/addressbooks/user"'
      );
    });
  });
});
