"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const distDir = path_1.default.join(__dirname, '..', '..', 'dist');
// Clean up previous build
console.log('Cleaning up previous build...');
try {
    fs_1.default.rmSync(distDir, { recursive: true, force: true });
}
catch (err) {
    // Ignore error if directory doesn't exist
    console.log(err);
}
// Create dist directory
fs_1.default.mkdirSync(distDir, { recursive: true });
fs_1.default.mkdirSync(path_1.default.join(distDir, 'logs'), { recursive: true }); // Create logs directory
console.log('dist and dist/logs directories created/confirmed');
// Compile TypeScript
console.log('Compiling TypeScript...');
(0, child_process_1.execSync)('tsc', { stdio: 'inherit' });
// Copy configuration files
console.log('Copying configuration files...');
const configSourcePath = path_1.default.join(__dirname, '..', 'mcp', 'stdio-config.json');
const configDestPath = path_1.default.join(distDir, 'mcp', 'stdio-config.json');
try {
    // Ensure destination directory exists
    fs_1.default.mkdirSync(path_1.default.dirname(configDestPath), { recursive: true });
    if (fs_1.default.existsSync(configSourcePath)) {
        fs_1.default.copyFileSync(configSourcePath, configDestPath);
        console.log(`Copied stdio-config.json to ${configDestPath}`);
    }
    else {
        console.error(`Error: Configuration file not found: ${configSourcePath}`);
    }
}
catch (error) {
    console.error('Error copying configuration file:', error);
}
// Copy package.json and update content
console.log('Preparing package.json...');
const packageJson = require('../../package.json');
// Create installation instructions
const readmeContent = `# ${packageJson.name}

This program is the Native Messaging host for the Chrome extension.

## Installation Instructions

1. Ensure Node.js is installed
2. Install this program globally:
   \`\`\`
   npm install -g ${packageJson.name}
   \`\`\`
3. Register Native Messaging Host:
   \`\`\`
   # User level installation (Recommended)
   ${packageJson.name} register

   # If user level installation fails, try system level
   ${packageJson.name} register --system
   # Or using admin privileges
   sudo ${packageJson.name} register
   \`\`\`

## Usage

This application is automatically started by the Chrome extension and does not need to be run manually.
`;
fs_1.default.writeFileSync(path_1.default.join(distDir, 'README.md'), readmeContent);
console.log('Copying wrapper scripts...');
const scriptsSourceDir = path_1.default.join(__dirname, '.');
const macOsWrapperSourcePath = path_1.default.join(scriptsSourceDir, 'run_host.sh');
const windowsWrapperSourcePath = path_1.default.join(scriptsSourceDir, 'run_host.bat');
const macOsWrapperDestPath = path_1.default.join(distDir, 'run_host.sh');
const windowsWrapperDestPath = path_1.default.join(distDir, 'run_host.bat');
try {
    if (fs_1.default.existsSync(macOsWrapperSourcePath)) {
        fs_1.default.copyFileSync(macOsWrapperSourcePath, macOsWrapperDestPath);
        console.log(`Copied ${macOsWrapperSourcePath} to ${macOsWrapperDestPath}`);
    }
    else {
        console.error(`Error: macOS wrapper script source not found: ${macOsWrapperSourcePath}`);
    }
    if (fs_1.default.existsSync(windowsWrapperSourcePath)) {
        fs_1.default.copyFileSync(windowsWrapperSourcePath, windowsWrapperDestPath);
        console.log(`Copied ${windowsWrapperSourcePath} to ${windowsWrapperDestPath}`);
    }
    else {
        console.error(`Error: Windows wrapper script source not found: ${windowsWrapperSourcePath}`);
    }
}
catch (error) {
    console.error('Error copying wrapper scripts:', error);
}
// Add executable permissions to key JavaScript files and macOS wrapper script
console.log('Adding executable permissions...');
const filesToMakeExecutable = ['index.js', 'cli.js', 'run_host.sh']; // Assuming cli.js is in dist root
filesToMakeExecutable.forEach((file) => {
    const filePath = path_1.default.join(distDir, file); // filePath is now target path
    try {
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.chmodSync(filePath, '755');
            console.log(`Added executable permission (755) to ${file}`);
        }
        else {
            console.warn(`Warning: ${filePath} does not exist, cannot add executable permission`);
        }
    }
    catch (error) {
        console.error(`Error adding executable permission to ${file}:`, error);
    }
});
// Write node_path.txt immediately after build to ensure Chrome uses the correct Node.js version.
// This is critical for development mode where dist is deleted on each rebuild.
// The file points to the same Node.js that compiled the native modules (better-sqlite3 etc.)
console.log('Writing node_path.txt...');
const nodePathFile = path_1.default.join(distDir, 'node_path.txt');
fs_1.default.writeFileSync(nodePathFile, process.execPath, 'utf8');
console.log(`Node.js path written: ${process.execPath}`);
console.log('✅ Build completed');
//# sourceMappingURL=build.js.map