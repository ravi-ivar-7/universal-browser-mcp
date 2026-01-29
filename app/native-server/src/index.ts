#!/usr/bin/env node
import { join } from 'node:path';
import fs from 'node:fs';

// Manually load .env to avoid dotenv package printing to stdout
function manualLoadEnv(path: string) {
  try {
    if (fs.existsSync(path)) {
      const content = fs.readFileSync(path, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [key, ...values] = trimmed.split('=');
        if (key && values.length > 0) {
          const val = values.join('=').trim();
          // Simple unquote if needed (dotenv handles complex cases, but this is a fallback for simple keys)
          const cleanVal = val.replace(/^["'](.*)["']$/, '$1');
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = cleanVal;
          }
        }
      }
    }
  } catch (e) {
    // Ignore errors silently
  }
}

// Load envs
manualLoadEnv(join(__dirname, '..', '.env'));
manualLoadEnv(join(__dirname, '.env'));


import serverInstance from './server';
import nativeMessagingHostInstance from './native-messaging-host';

try {
  serverInstance.setNativeHost(nativeMessagingHostInstance); // Server needs setNativeHost method
  nativeMessagingHostInstance.setServer(serverInstance); // NativeHost needs setServer method
  nativeMessagingHostInstance.start();
} catch (error) {
  process.exit(1);
}

process.on('error', (error) => {
  process.exit(1);
});

// Handle process signals and uncaught exceptions
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

process.on('exit', (code) => {
});

process.on('uncaughtException', (error) => {
  console.error('[NativeServer] UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[NativeServer] UNHANDLED REJECTION:', reason);
});
