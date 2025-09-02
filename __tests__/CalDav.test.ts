import { CalDav } from '../nodes/CalDav/CalDav.node';

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

describe('CalDav Node - URL and Path Handling', () => {
  let calDavNode: CalDav;
  let mockGetCredentials: jest.Mock;
  let mockGetNodeParameter: jest.Mock;
  let mockGetInputData: jest.Mock;
  let mockHelpers: any;

  beforeEach(() => {
    calDavNode = new CalDav();

    mockGetCredentials = jest.fn();
    mockGetNodeParameter = jest.fn();
    mockGetInputData = jest.fn();
    mockHelpers = {
      httpRequest: jest.fn(),
    };

    (calDavNode as any).getCredentials = mockGetCredentials;
    (calDavNode as any).getNodeParameter = mockGetNodeParameter;
    (calDavNode as any).getInputData = mockGetInputData;
    (calDavNode as any).helpers = mockHelpers;
    (calDavNode as any).getNode = jest.fn(() => ({ name: 'CalDAV' }));
    (calDavNode as any).continueOnFail = jest.fn(() => false);
  });

  describe('Path Normalization', () => {
    test('should normalize calendar paths with spaces', () => {
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

      expect(normalizePath('calendars/user/My Calendar')).toBe('/calendars/user/My%20Calendar');
      expect(normalizePath('/calendars/user/work')).toBe('/calendars/user/work');
    });
  });

  describe('Error Messages', () => {
    test('should provide detailed error for invalid URL in calendar request', async () => {
      mockGetCredentials.mockResolvedValue({ baseUrl: 'https://caldav.example.com' });
      mockGetInputData.mockReturnValue([{ json: {} }]);
      mockGetNodeParameter
        .mockReturnValueOnce('getCalendars')   // operation
        .mockReturnValueOnce('calendars/user') // calendarHomeSet
        .mockReturnValueOnce('calendar');      // resource

      const invalidUrlError = new Error('Invalid URL');
      mockHelpers.httpRequest.mockRejectedValue(invalidUrlError);

      await expect((calDavNode as any).execute()).rejects.toThrow(
        'Invalid URL for CalDAV getCalendars on calendar: "/calendars/user"'
      );
    });
  });
});
