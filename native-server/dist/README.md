# mcp-chrome-bridge

This program is the Native Messaging host for the Chrome extension.

## Installation Instructions

1. Ensure Node.js is installed
2. Install this program globally:
   ```
   npm install -g mcp-chrome-bridge
   ```
3. Register Native Messaging Host:
   ```
   # User level installation (Recommended)
   mcp-chrome-bridge register

   # If user level installation fails, try system level
   mcp-chrome-bridge register --system
   # Or using admin privileges
   sudo mcp-chrome-bridge register
   ```

## Usage

This application is automatically started by the Chrome extension and does not need to be run manually.
