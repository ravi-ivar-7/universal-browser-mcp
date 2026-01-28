"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabasePath = getDatabasePath;
exports.getDb = getDb;
exports.closeDb = closeDb;
exports.isDbInitialized = isDbInitialized;
exports.execRawSql = execRawSql;
/**
 * Database client singleton for Agent storage.
 *
 * Design principles:
 * - Lazy initialization - only connect when first accessed
 * - Singleton pattern - single connection throughout the app lifecycle
 * - Auto-create tables on first run (no migration tool needed)
 * - Configurable path via environment variable
 */
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const better_sqlite3_2 = require("drizzle-orm/better-sqlite3");
const schema = __importStar(require("./schema"));
const storage_1 = require("../storage");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = require("node:fs");
// ============================================================
// Singleton State
// ============================================================
let dbInstance = null;
let sqliteInstance = null;
// ============================================================
// Database Path Resolution
// ============================================================
/**
 * Get the database file path.
 * Environment: CHROME_MCP_AGENT_DB_FILE overrides the default path.
 */
function getDatabasePath() {
    const envPath = process.env.CHROME_MCP_AGENT_DB_FILE;
    if (envPath && envPath.trim()) {
        return node_path_1.default.resolve(envPath.trim());
    }
    return node_path_1.default.join((0, storage_1.getAgentDataDir)(), 'agent.db');
}
// ============================================================
// Schema Initialization SQL
// ============================================================
const CREATE_TABLES_SQL = `
-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  root_path TEXT NOT NULL,
  preferred_cli TEXT,
  selected_model TEXT,
  active_claude_session_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_active_at TEXT
);

CREATE INDEX IF NOT EXISTS projects_last_active_idx ON projects(last_active_at);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  engine_name TEXT NOT NULL,
  engine_session_id TEXT,
  name TEXT,
  model TEXT,
  permission_mode TEXT NOT NULL DEFAULT 'bypassPermissions',
  allow_dangerously_skip_permissions TEXT,
  system_prompt_config TEXT,
  options_config TEXT,
  management_info TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_project_id_idx ON sessions(project_id);
CREATE INDEX IF NOT EXISTS sessions_engine_name_idx ON sessions(engine_name);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  conversation_id TEXT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL,
  metadata TEXT,
  cli_source TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS messages_project_id_idx ON messages(project_id);
CREATE INDEX IF NOT EXISTS messages_session_id_idx ON messages(session_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);
CREATE INDEX IF NOT EXISTS messages_request_id_idx ON messages(request_id);

-- Enable foreign key enforcement
PRAGMA foreign_keys = ON;
`;
/**
 * Migration SQL to add new columns to existing databases.
 * Each migration is idempotent - safe to run multiple times.
 */
const MIGRATION_SQL = `
-- Add active_claude_session_id column if it doesn't exist (for existing databases)
-- SQLite doesn't support IF NOT EXISTS for columns, so we use a workaround
`;
// ============================================================
// Database Initialization
// ============================================================
/**
 * Check if a column exists in a table.
 */
function columnExists(sqlite, tableName, columnName) {
    const result = sqlite.prepare(`PRAGMA table_info(${tableName})`).all();
    return result.some((col) => col.name === columnName);
}
/**
 * Run migrations for existing databases.
 * Adds new columns that may be missing in older database versions.
 */
function runMigrations(sqlite) {
    // Migration 1: Add active_claude_session_id column to projects table
    if (!columnExists(sqlite, 'projects', 'active_claude_session_id')) {
        sqlite.exec('ALTER TABLE projects ADD COLUMN active_claude_session_id TEXT');
    }
    // Migration 2: Add use_ccr column to projects table
    if (!columnExists(sqlite, 'projects', 'use_ccr')) {
        sqlite.exec('ALTER TABLE projects ADD COLUMN use_ccr TEXT');
    }
    // Migration 3: Add enable_chrome_mcp column to projects table (default enabled)
    if (!columnExists(sqlite, 'projects', 'enable_chrome_mcp')) {
        sqlite.exec("ALTER TABLE projects ADD COLUMN enable_chrome_mcp TEXT NOT NULL DEFAULT '1'");
    }
}
/**
 * Initialize the database schema.
 * Safe to call multiple times - uses IF NOT EXISTS.
 * Also runs migrations for existing databases.
 */
function initializeSchema(sqlite) {
    sqlite.exec(CREATE_TABLES_SQL);
    runMigrations(sqlite);
}
/**
 * Ensure the data directory exists.
 */
function ensureDataDir() {
    const dataDir = (0, storage_1.getAgentDataDir)();
    if (!(0, node_fs_1.existsSync)(dataDir)) {
        (0, node_fs_1.mkdirSync)(dataDir, { recursive: true });
    }
}
// ============================================================
// Public API
// ============================================================
/**
 * Get the Drizzle database instance.
 * Lazily initializes the connection and schema on first call.
 */
function getDb() {
    if (dbInstance) {
        return dbInstance;
    }
    ensureDataDir();
    const dbPath = getDatabasePath();
    // Create SQLite connection
    sqliteInstance = new better_sqlite3_1.default(dbPath);
    // Enable WAL mode for better concurrent read performance
    sqliteInstance.pragma('journal_mode = WAL');
    // Initialize schema
    initializeSchema(sqliteInstance);
    // Create Drizzle instance
    dbInstance = (0, better_sqlite3_2.drizzle)(sqliteInstance, { schema });
    return dbInstance;
}
/**
 * Close the database connection.
 * Should be called on graceful shutdown.
 */
function closeDb() {
    if (sqliteInstance) {
        sqliteInstance.close();
        sqliteInstance = null;
        dbInstance = null;
    }
}
/**
 * Check if database is initialized.
 */
function isDbInitialized() {
    return dbInstance !== null;
}
/**
 * Execute raw SQL (for advanced use cases).
 */
function execRawSql(sqlStr) {
    if (!sqliteInstance) {
        getDb(); // Initialize if not already
    }
    sqliteInstance.exec(sqlStr);
}
//# sourceMappingURL=client.js.map