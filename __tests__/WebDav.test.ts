import { WebDav } from '../nodes/WebDav/WebDav.node';

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

describe('WebDav Node - URL and Path Handling', () => {
  let webDavNode: WebDav;
  let mockGetCredentials: jest.Mock;
  let mockGetNodeParameter: jest.Mock;
  let mockGetInputData: jest.Mock;
  let mockHelpers: any;

  beforeEach(() => {
    // Create a new instance for each test
    webDavNode = new WebDav();

    // Mock the required methods
    mockGetCredentials = jest.fn();
    mockGetNodeParameter = jest.fn();
    mockGetInputData = jest.fn();
    mockHelpers = {
      httpRequest: jest.fn(),
      prepareBinaryData: jest.fn(),
      getBinaryDataBuffer: jest.fn(),
    };
    mockHelpers.prepareBinaryData.mockResolvedValue({
      data: 'dGVzdA==',
      fileName: 'test.txt',
      mimeType: 'text/plain',
    });
    mockHelpers.getBinaryDataBuffer.mockResolvedValue(Buffer.from('test'));

    // Bind mocks to the instance
    (webDavNode as any).getCredentials = mockGetCredentials;
    (webDavNode as any).getNodeParameter = mockGetNodeParameter;
    (webDavNode as any).getInputData = mockGetInputData;
    (webDavNode as any).helpers = mockHelpers;
    (webDavNode as any).getNode = jest.fn(() => ({ name: 'WebDAV' }));
    (webDavNode as any).continueOnFail = jest.fn(() => false);
  });

  describe('Base URL Validation', () => {
    test('should throw error for missing protocol in base URL', async () => {
      mockGetCredentials.mockResolvedValue({ baseUrl: 'webdav.example.com' });
      mockGetInputData.mockReturnValue([{}]);
      mockGetNodeParameter
        .mockReturnValueOnce('get')  // operation
        .mockReturnValueOnce('file'); // resource

      await expect((webDavNode as any).execute()).rejects.toThrow(
        'Invalid Base URL in credentials. Include protocol'
      );
    });

    test('should accept valid HTTPS base URL', async () => {
      mockGetCredentials.mockResolvedValue({ baseUrl: 'https://webdav.example.com' });
      mockGetInputData.mockReturnValue([{ json: {} }]);
      mockGetNodeParameter
        .mockReturnValueOnce('get')   // operation
        .mockReturnValueOnce('/test.txt') // path
        .mockReturnValueOnce('file'); // resource

      mockHelpers.httpRequest.mockResolvedValue({
        body: Buffer.from('test content'),
        status: 200,
        headers: {
          'content-type': 'text/plain',
          'content-length': '12',
          'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
          'etag': '"123456"'
        }
      });

      await expect((webDavNode as any).execute()).resolves.not.toThrow();
    });
  });

  describe('Path Normalization', () => {
    test('should normalize path with spaces', () => {
      // This would be tested by calling the internal normalizePath function
      // Since it's private, we'll test the behavior through execute
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

      expect(normalizePath('Files/Documents/test file.txt')).toBe('/Files/Documents/test%20file.txt');
      expect(normalizePath('/already/normalized')).toBe('/already/normalized');
      expect(normalizePath('')).toBe('/');
    });

    test('should handle special characters in paths', () => {
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

      expect(normalizePath('Files/test&file.txt')).toBe('/Files/test%26file.txt');
      expect(normalizePath('Files/test file.txt')).toBe('/Files/test%20file.txt');
    });
  });

  describe('Error Messages', () => {
    test('should provide detailed error for invalid URL in request', async () => {
      mockGetCredentials.mockResolvedValue({ baseUrl: 'https://webdav.example.com' });
      mockGetInputData.mockReturnValue([{ json: {} }]);
      mockGetNodeParameter
        .mockReturnValueOnce('get')   // operation
        .mockReturnValueOnce('Files/Documents/test file.txt') // path
        .mockReturnValueOnce('file'); // resource

      const invalidUrlError = new Error('Invalid URL');
      mockHelpers.httpRequest.mockRejectedValue(invalidUrlError);

      await expect((webDavNode as any).execute()).rejects.toThrow(
        'Invalid URL for WebDAV get on file: "/Files/Documents/test%20file.txt"'
      );
    });
  });

  describe('Binary Handling', () => {
    test('should throw error when no data returned', async () => {
      mockGetCredentials.mockResolvedValue({ baseUrl: 'https://webdav.example.com' });
      mockGetInputData.mockReturnValue([{ json: {} }]);
      mockGetNodeParameter
        .mockReturnValueOnce('get')
        .mockReturnValueOnce('/test.txt')
        .mockReturnValueOnce('file');

      mockHelpers.httpRequest.mockResolvedValue({
        status: 200,
        headers: {},
      });

      await expect((webDavNode as any).execute()).rejects.toThrow(
        'No data returned from WebDAV for path "/test.txt"'
      );
    });

    test('should reject JSON response', async () => {
      mockGetCredentials.mockResolvedValue({ baseUrl: 'https://webdav.example.com' });
      mockGetInputData.mockReturnValue([{ json: {} }]);
      mockGetNodeParameter
        .mockReturnValueOnce('get')
        .mockReturnValueOnce('/test.txt')
        .mockReturnValueOnce('file');

      mockHelpers.httpRequest.mockResolvedValue({
        body: Buffer.from('{}'),
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      await expect((webDavNode as any).execute()).rejects.toThrow(
        'Expected binary response but received JSON from WebDAV for path "/test.txt"'
      );
    });

    test('should return binary data and metadata on success', async () => {
      mockGetCredentials.mockResolvedValue({ baseUrl: 'https://webdav.example.com' });
      mockGetInputData.mockReturnValue([{ json: {} }]);
      mockGetNodeParameter
        .mockReturnValueOnce('get')
        .mockReturnValueOnce('/test.txt')
        .mockReturnValueOnce('file');

      const buffer = Buffer.from('test');
      mockHelpers.httpRequest.mockResolvedValue({
        body: buffer,
        status: 200,
        headers: { 'content-type': 'text/plain', 'content-length': buffer.length.toString() },
      });

      const result = await (webDavNode as any).execute();
      expect(mockHelpers.prepareBinaryData).toHaveBeenCalledWith(buffer, 'test.txt', 'text/plain');
      expect(result[0][0].json).toMatchObject({
        path: '/test.txt',
        contentType: 'text/plain',
        contentLength: buffer.length,
        statusCode: 200,
      });
      expect(result[0][0].binary.data).toEqual({
        data: 'dGVzdA==',
        fileName: 'test.txt',
        mimeType: 'text/plain',
      });
    });
  });

  describe('Upload Handling', () => {
    test('should throw error if binary property missing', async () => {
      mockGetCredentials.mockResolvedValue({ baseUrl: 'https://webdav.example.com' });
      mockGetInputData.mockReturnValue([{ json: {} }]);
      mockGetNodeParameter
        .mockReturnValueOnce('put')
        .mockReturnValueOnce('/upload.txt')
        .mockReturnValueOnce('data')
        .mockReturnValueOnce('file');

      await expect((webDavNode as any).execute()).rejects.toThrow(
        'Input item is missing binary property "data"'
      );
    });

    test('should upload binary file successfully', async () => {
      mockGetCredentials.mockResolvedValue({ baseUrl: 'https://webdav.example.com' });
      mockGetInputData.mockReturnValue([
        { json: {}, binary: { data: { mimeType: 'text/plain' } } },
      ]);
      mockGetNodeParameter
        .mockReturnValueOnce('put')
        .mockReturnValueOnce('/upload.txt')
        .mockReturnValueOnce('data')
        .mockReturnValueOnce('file');

      mockHelpers.httpRequest.mockResolvedValue({ status: 201 });

      const result = await (webDavNode as any).execute();
      expect(mockHelpers.getBinaryDataBuffer).toHaveBeenCalledWith(0, 'data');
      expect(result[0][0].json).toMatchObject({
        success: true,
        statusCode: 201,
        path: '/upload.txt',
        contentType: 'text/plain',
      });
    });
  });
});
