# Chrome MCP Server Usage Guide

This server acts as a bridge between AI agents and the Google Chrome browser using the **Model Context Protocol (MCP)**. It allows any AI to see, navigate, and interact with the browser as if it were a human user.

## 🚀 Integration Methods

### Option A: Automatic Discovery (Recommended for Cursor, Goose, etc.)
If you use a dedicated MCP client, add the server to your settings so it can automatically discover the tools.

**File**: `.mcp_config.json` (or app settings)
```json
{
  "mcpServers": {
    "chrome-browser": {
      "type": "streamableHttp",
      "url": "http://127.0.0.1:12306/mcp"
    }
  }
}
```

### Option B: Direct Integration (For custom scripts/agents)
Any AI or script can talk to the browser directly via HTTP without any configuration. Just hit the endpoint:
- **URL**: `http://127.0.0.1:12306/mcp`
- **Method**: `POST`
- **Protocol**: JSON-RPC over SSE (Server-Sent Events)

---

## 🛠 Usage Examples (MCP Protocol)

### 1. Initialization
Every session **must** start with an initialize call to get a `mcp-session-id`.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": { "name": "antigravity-client", "version": "1.0.0" }
  }
}
```

### 2. Navigate to a Website
Use `chrome_navigate` to open URLs.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "tools/call",
  "params": {
    "name": "chrome_navigate",
    "arguments": { 
      "url": "https://github.com",
      "newWindow": false 
    }
  }
}
```

### 3. Read Page Content (Accessibility Tree)
Instead of raw HTML, use `chrome_read_page`. It returns a optimized "Accessibility Tree" of **only visible** elements, which is much cheaper for LLM tokens.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "3",
  "method": "tools/call",
  "params": {
    "name": "chrome_read_page",
    "arguments": { "filter": "interactive" }
  }
}
```

### 4. Interactive Computer Tool
Perform complex mouse/keyboard actions or take screenshots.

**Request (Clicking an element):**
```json
{
  "jsonrpc": "2.0",
  "id": "4",
  "method": "tools/call",
  "params": {
    "name": "chrome_computer",
    "arguments": { 
      "action": "left_click",
      "ref": "ref_123" 
    }
  }
}
```

---

## 📋 Core Tools Reference

| Tool Name | Best For... |
|-----------|-------------|
| `get_windows_and_tabs` | Getting a list of all open tabs and their IDs. |
| `chrome_navigate` | Opening sites or going back/forward. |
| `chrome_read_page` | Finding buttons/inputs on the current screen. |
| `chrome_computer` | Generic mouse/keyboard actions + Screenshots. |
| `chrome_javascript` | Advanced automation or extracting data not in the DOM. |
| `chrome_console` | Debugging errors or reading site logs. |
| `chrome_network_request` | Making API calls from the browser (uses site cookies). |

---

## ⚠️ Troubleshooting
- **Server Not Found**: Ensure `npm run dev` is active in the `native-server` folder.
- **Tools Not Appearing**: Check the Chrome Extension (WXT/Universal Extension) and make sure "Native Host" status is green.
- **Port Conflict**: The default port is `12306`. If you change it, update your client URL.
- **JSON Parsing Error**: Ensure all values in `arguments` match the expected schema (strings for refs, numbers for tabIds).
