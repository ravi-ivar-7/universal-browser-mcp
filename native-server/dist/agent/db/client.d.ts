import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
export type DrizzleDB = BetterSQLite3Database<typeof schema>;
/**
 * Get the database file path.
 * Environment: CHROME_MCP_AGENT_DB_FILE overrides the default path.
 */
export declare function getDatabasePath(): string;
/**
 * Get the Drizzle database instance.
 * Lazily initializes the connection and schema on first call.
 */
export declare function getDb(): DrizzleDB;
/**
 * Close the database connection.
 * Should be called on graceful shutdown.
 */
export declare function closeDb(): void;
/**
 * Check if database is initialized.
 */
export declare function isDbInitialized(): boolean;
/**
 * Execute raw SQL (for advanced use cases).
 */
export declare function execRawSql(sqlStr: string): void;
