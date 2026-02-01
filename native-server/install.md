# Chrome MCP Bridge Installation Guide

This document details the installation and registration process for Chrome MCP Bridge.

## Installation Process Overview

The installation and registration process for Chrome MCP Bridge is as follows:

```
npm install -g mcp-chrome-bridge
└─ postinstall.js
   ├─ Copy executable files to npm_prefix/bin   ← Always writeable (User or root permissions)
   ├─ Try user level registration               ← No sudo required, succeeds in most cases
   └─ If fails ➜ Prompt user to run mcp-chrome-bridge register --system
      └─ Requires manual run with admin privileges
```

The flowchart above shows the complete process from global installation to final registration.

## Detailed Installation Steps

### 1. Global Installation

```bash
npm install -g mcp-chrome-bridge
```

After installation, the system will automatically try to register the Native Messaging host in the user directory. This does not require administrator privileges and is the recommended installation method.

### 2. User Level Registration

User level registration will create manifest files in the following locations:

```
Manifest File Location
├─ User Level (No admin permissions required)
│  ├─ Windows: %APPDATA%\Google\Chrome\NativeMessagingHosts\
│  ├─ macOS:   ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
│  └─ Linux:   ~/.config/google-chrome/NativeMessagingHosts/
│
└─ System Level (Admin permissions required)
   ├─ Windows: %ProgramFiles%\Google\Chrome\NativeMessagingHosts\
   ├─ macOS:   /Library/Google/Chrome/NativeMessagingHosts/
   └─ Linux:   /etc/opt/chrome/native-messaging-hosts/
```

If automatic registration fails, or if you want to register manually, you can run:

```bash
mcp-chrome-bridge register
```

**Recommended: Run diagnostic tool to check for issues:**

```bash
mcp-chrome-bridge doctor
```

### 3. System Level Registration

If user level registration fails (e.g., due to permission issues), you can try system level registration. System level registration requires administrator privileges, but we provide two convenient ways to complete this process.

System level registration has two methods:

#### Method 1: Use `--system` argument (Recommended)

```bash
# macOS/Linux
sudo mcp-chrome-bridge register --system

# Windows (Run Command Prompt as Administrator)
mcp-chrome-bridge register --system
```

System level installation requires administrator privileges to write to system directories and the registry.

#### Method 2: Run directly with admin privileges

**Windows**:
Run Command Prompt or PowerShell as Administrator, then execute:

```
mcp-chrome-bridge register
```

**macOS/Linux**:
Use sudo command:

```
sudo mcp-chrome-bridge register
```

## Registration Process Details

### Registration Flowchart

```
Registration Process
├─ User Level Registration (mcp-chrome-bridge register)
│  ├─ Get user level manifest path
│  ├─ Create user directory
│  ├─ Generate manifest content
│  ├─ Write manifest file
│  └─ Windows: Create user-level registry keys
│
└─ System Level Registration (mcp-chrome-bridge register --system)
   ├─ Check for admin permissions
   │  ├─ Authorized → Create system directory and write manifest directly
   │  └─ Unauthorized → Prompt user to run with admin privileges
   └─ Windows: Create system-level registry keys
```

### Manifest File Structure

```
manifest.json
├─ name: "com.chromemcp.nativehost"
├─ description: "Node.js Host for Browser Bridge Extension"
├─ path: "/path/to/run_host.sh"       ← Startup script path
├─ type: "stdio"                      ← Communication type
└─ allowed_origins: [                 ← Allowed extensions
   "chrome-extension://ExtensionID/"
]
```

### User Level Registration Process

1. Determine user level manifest file path
2. Create necessary directories
3. Generate manifest content, including:
   - Host name
   - Description
   - Node.js executable path
   - Communication type (stdio)
   - Allowed extension IDs
   - Startup arguments
4. Write manifest file
5. On Windows, corresponding registry keys will also be created

### System Level Registration Process

1. Detect if admin permissions are available
2. If admin permissions are available:
   - Create system level directory directly
   - Write manifest file
   - Set appropriate permissions
   - Create system level registry keys on Windows
3. If admin permissions are not available:
   - Prompt user to re-run with admin privileges
   - macOS/Linux: `sudo mcp-chrome-bridge register --system`
   - Windows: Run Command Prompt as Administrator

## Verify Installation

### Verification Flowchart

```
Verify Installation
├─ Check manifest file
│  ├─ File exists → Check content correctness
│  └─ File does not exist → Reinstall
│
├─ Check Chrome Extension
│  ├─ Extension installed → Check extension permissions
│  └─ Extension not installed → Install extension
│
└─ Test Connection
   ├─ Connection successful → Installation complete
   └─ Connection failed → Check error logs → Refer to troubleshooting
```

### Verification Steps

After installation, you can verify it through the following ways:

1. Check if the manifest file exists in the corresponding directory
   - User level: Check manifest file in user directory
   - System level: Check manifest file in system directory
   - Confirm manifest file content is correct

2. Install corresponding extension in Chrome
   - Ensure extension is correctly installed
   - Ensure extension has `nativeMessaging` permission

3. Try connecting to local service via extension
   - Use extension's test feature to try connecting
   - Check Chrome extension logs for error messages

## Troubleshooting

### Troubleshooting Flowchart

```
Troubleshooting
├─ Permission Issues
│  ├─ Check user permissions
│  │  ├─ Sufficient permissions → Check directory permissions
│  │  └─ Insufficient permissions → Try system-level installation
│  │
│  ├─ Execution permission issues (macOS/Linux)
│  │  ├─ "Permission denied" error
│  │  ├─ "Native host has exited" error
│  │  └─ Run mcp-chrome-bridge fix-permissions
│  │
│  └─ Try mcp-chrome-bridge register --system
│
├─ Path Issues
│  ├─ Check Node.js installation (node -v)
│  └─ Check global NPM path (npm root -g)
│
├─ Registry Issues (Windows)
│  ├─ Check registry access permissions
│  └─ Try creating registry keys manually
│
└─ Other Issues
   ├─ Check console error information
   └─ Submit an Issue to the project repository
```

### Common Troubleshooting Steps

If you encounter issues during installation, please try the following steps:

1. Ensure Node.js is correctly installed
   - Run `node -v` and `npm -v` to check versions
   - Ensure Node.js version >= 20.x

2. Check for sufficient permissions to create files and directories
   - User-level installation requires write access to the user directory
   - System-level installation requires Administrator/root permissions

3. **Fix Execution Permission Issues**
   **macOS/Linux Platform**:
   **Problem Description**:
   - `npm install` usually preserves file permissions, but `pnpm` might not
   - You might encounter "Permission denied" or "Native host has exited" errors
   - Chrome extension fails to start the native host process

   **Solutions**:
   a) **Use the built-in fix command (Recommended)**:
      ```bash
      mcp-chrome-bridge fix-permissions
      ```
   b) **Run the diagnostic tool for auto-fix**:
      ```bash
      mcp-chrome-bridge doctor --fix
      ```
   c) **Manually set permissions**:
      ```bash
      # Find installation path
      npm root -g
      # Or for pnpm
      pnpm root -g
      
      # Set execution permission (replace with actual path)
      chmod +x <path>/mcp-chrome-bridge/dist/scripts/run_host.sh
      ```

   **Windows Platform**:
   **Problem Description**:
   - `.bat` files on Windows usually don't need execution permission, but other issues might occur
   - Files might be marked as read-only
   - Might encounter "Access denied" or file not executable errors

   **Solutions**:
   a) **Use the built-in fix command (Recommended)**:
      ```powershell
      mcp-chrome-bridge fix-permissions
      ```
   b) **Run the diagnostic tool for auto-fix**:
      ```powershell
      mcp-chrome-bridge doctor --fix
      ```
   c) **Manually check file attributes**:
      ```powershell
      # Find installation path
      npm root -g
      # Check file attributes (Right click -> Properties in File Explorer)
      # Ensure run_host.bat is not read-only
      ```
   d) **Reinstall and enforce permissions**:
      ```bash
      # Uninstall
      npm uninstall -g mcp-chrome-bridge
      # Or pnpm uninstall -g mcp-chrome-bridge
      
      # Reinstall
      npm install -g mcp-chrome-bridge
      # Or pnpm install -g mcp-chrome-bridge
      
      # If issues persist, run permission fix
      mcp-chrome-bridge fix-permissions
      ```

4. On Windows, ensure registry access is not restricted
   - Check access to `HKCU\Software\Google\Chrome\NativeMessagingHosts\`
   - For system level, check `HKLM\Software\Google\Chrome\NativeMessagingHosts\`

5. Try system-level installation
   - Use `mcp-chrome-bridge register --system` command
   - Or run directly with administrator privileges

6. Check console error output
   - Detailed error messages usually indicate the problem source
   - Add `--verbose` argument for more logs

If the issue persists, please submit an issue to the project repository with the following information:
- OS Version
- Node.js Version
- Installation Command
- Error Message
- Solutions Attempted
