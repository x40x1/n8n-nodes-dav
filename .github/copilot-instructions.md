# n8n-nodes-dav - AI Development Guide

## 1. Project Goal
Develop robust n8n nodes for WebDAV, CalDAV, and CardDAV. Focus on standards compliance, AI agent usability (`usableAsTool: true`), and seamless n8n integration.

## 2. Core Principles
- **Data Flow**: Accept JSON, handle batches, support n8n expressions (e.g., `{{$json.path}}`), and produce structured JSON.
- **Error Handling**: Implement `continueOnFail()` and `NodeOperationError` for resilient workflows.
- **Compatibility**: Ensure nodes work with major DAV servers (Nextcloud, SabreDAV).
- **AI-Friendliness**: Use clear, descriptive names and actions for operations.

## 3. File Structure
- **Nodes**: `nodes/{NodeName}/{NodeName}.node.ts`
- **UI/Properties**: `nodes/{NodeName}/{Operation}Description.ts`
- **Credentials**: `credentials/{CredentialName}.credentials.ts`
- **Icons**: `nodes/{NodeName}/{nodename}.svg` (24x24px)

## 4. Implementation Guide
- **Node Class**: Extend `INodeType` and implement the `execute()` method for core logic.
- **Credentials**: Implement `ICredentialType`. The `test` function must be a `PROPFIND` request with `Depth: 0`.
- **Operations**: Define operations (e.g., GET, PUT, REPORT) with dynamic fields based on the selected resource and operation.
- **DAV Methods**: Use `GET`/`PUT`/`PROPFIND` for WebDAV and `REPORT` for CalDAV/CardDAV.
- **Error Handling**: Wrap `execute` logic in a `try...catch` block and handle `continueOnFail()`.

## 5. Development Workflow
1.  Create node files in the correct directories.
2.  Run `npm run build` to compile and `npm run dev` for development.
3.  Test against real DAV servers (e.g., Nextcloud) using the n8n desktop app.
4.  Verify expression support and error flows are working correctly.
