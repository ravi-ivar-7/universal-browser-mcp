# Universal Browser MCP

Universal Browser MCP allows you to use your web browser as a Model Context Protocol (MCP) server. By connecting an MCP client to your browser, the client can read web pages, execute scripts, and automate browser tasks directly.

## Project Structure

The repository is divided into three primary parts:

1. **extension**: A browser extension built with WXT (supporting Chrome and Firefox). It runs in the browser, processes incoming MCP requests, and interacts with web pages.
2. **native-server**: A Node.js native messaging host that bridges the communication between your MCP client and the browser extension. It translates MCP protocol messages over stdio into Native Messaging calls that the browser extension can understand.
3. **shared**: Common types and utilities shared between the extension and the native server.

## How it Works

1. An MCP client starts the `native-server` via standard input/output (stdio).
2. The `native-server` establishes a connection with the browser extension using Chrome's Native Messaging protocol.
3. When the MCP client sends a tool execution request (e.g., retrieving page content), the server forwards it to the extension.
4. The extension executes the necessary browser APIs and returns the result back through the server to the client.

## Getting Started

### Prerequisites

- Node.js (version 20 or higher)
- npm or pnpm
- Google Chrome or a Chromium-based browser

### Installation

1. Install dependencies:
   Navigate to the `extension` and `native-server` directories separately and run `npm install`.

2. Build and load the extension:
   - Navigate to the `extension` directory.
   - Run `npm run build` to create a production build. The output will be in the `.output` directory.
   - Load the unpacked extension from the `.output` directory into your browser via the Extensions management page.

3. Register the Native Messaging Host:
   - Navigate to the `native-server` directory.
   - Build the server using `npm run build`.
   - Register the host with your browser. You can automatically detect and register installed browsers by running `node dist/cli.js register --detect`.

### Usage

Configure your MCP client to use the newly built native server. Provide the path to the native server's stdio entry point.

For example, in your MCP client configuration file:

```json
{
  "mcpServers": {
    "universal-browser": {
      "command": "node",
      "args": [
        "/absolute/path/to/universal-browser-mcp/native-server/dist/mcp/mcp-server-stdio.js"
      ]
    }
  }
}
```

## Development

- The `extension` folder utilizes the WXT framework and Vite for fast browser extension development.
- The `native-server` relies on Fastify and TypeScript.
- For detailed development scripts, testing instructions, and architecture diagrams, refer to the individual `README.md` and `ARCHITECTURE.md` files in each sub-directory.
