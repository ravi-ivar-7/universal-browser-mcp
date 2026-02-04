/**
 * @fileoverview Record-Replay V3 Public API Entry Point
 * @description Exports all public types and interfaces
 */

// ==================== Domain ====================
export * from './domain';

// ==================== Engine ====================
export * from './engine';

// ==================== Storage ====================
export * from './storage';

// ==================== Factory Functions ====================

import type { StoragePort } from './engine/storage/storage-port';
import { createFlowsStore } from './storage/flows';
import { createRunsStore } from './storage/runs';
import { createEventsStore } from './storage/events';
import { createQueueStore } from './storage/queue';
import { createPersistentVarsStore } from './storage/persistent-vars';
import { createTriggersStore } from './storage/triggers';

/**
 * Create complete StoragePort implementation
 */
export function createStoragePort(): StoragePort {
  return {
    flows: createFlowsStore(),
    runs: createRunsStore(),
    events: createEventsStore(),
    queue: createQueueStore(),
    persistentVars: createPersistentVarsStore(),
    triggers: createTriggersStore(),
  };
}

// ==================== Version ====================

/** V3 API Version */
export const RR_V3_VERSION = '3.0.0' as const;

/** Is V3 API */
export const IS_RR_V3 = true as const;
