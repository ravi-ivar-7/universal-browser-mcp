/**
 * @fileoverview RunQueue Interface Definition
 * @description Defines the management interface for Run Queue
 */

import type { JsonObject, UnixMillis } from '../../domain/json';
import type { FlowId, NodeId, RunId } from '../../domain/ids';
import type { TriggerFireContext } from '../../domain/triggers';

/**
 * RunQueue Configuration
 */
export interface RunQueueConfig {
  /** Max Parallel Runs */
  maxParallelRuns: number;
  /** Lease TTL (ms) */
  leaseTtlMs: number;
  /** Heartbeat Interval (ms) */
  heartbeatIntervalMs: number;
}

/**
 * Default Queue Configuration
 */
export const DEFAULT_QUEUE_CONFIG: RunQueueConfig = {
  maxParallelRuns: 3,
  leaseTtlMs: 15_000,
  heartbeatIntervalMs: 5_000,
};

/**
 * Queue Item Status
 */
export type QueueItemStatus = 'queued' | 'running' | 'paused';

/**
 * Lease Information
 */
export interface Lease {
  /** Owner ID */
  ownerId: string;
  /** Expiration Time */
  expiresAt: UnixMillis;
}

/**
 * RunQueue Item
 */
export interface RunQueueItem {
  /** Run ID */
  id: RunId;
  /** Flow ID */
  flowId: FlowId;
  /** Status */
  status: QueueItemStatus;
  /** Created At */
  createdAt: UnixMillis;
  /** Updated At */
  updatedAt: UnixMillis;
  /** Priority (Higher number means higher priority) */
  priority: number;
  /** Current Attempts */
  attempt: number;
  /** Max Attempts */
  maxAttempts: number;
  /** Tab ID */
  tabId?: number;
  /** Running Args */
  args?: JsonObject;
  /** Trigger Context */
  trigger?: TriggerFireContext;
  /** Lease Info */
  lease?: Lease;
  /** Debug Config */
  debug?: { breakpoints?: NodeId[]; pauseOnStart?: boolean };
}

/**
 * Enqueue Request (Excluding auto-generated fields)
 * - priority defaults to 0
 * - maxAttempts defaults to 1
 */
export type EnqueueInput = Omit<
  RunQueueItem,
  'status' | 'createdAt' | 'updatedAt' | 'attempt' | 'lease' | 'priority' | 'maxAttempts'
> & {
  id: RunId;
  /** Priority (Higher number means higher priority, default 0) */
  priority?: number;
  /** Max Attempts (default 1) */
  maxAttempts?: number;
};

/**
 * RunQueue Interface
 * @description Manages Run queue and scheduling
 */
export interface RunQueue {
  /**
   * Enqueue
   * @param input Enqueue input
   * @returns Queue item
   */
  enqueue(input: EnqueueInput): Promise<RunQueueItem>;

  /**
   * Claim next executable Run
   * @param ownerId Owner ID
   * @param now Current time
   * @returns Queue item or null
   */
  claimNext(ownerId: string, now: UnixMillis): Promise<RunQueueItem | null>;

  /**
   * Renew Heartbeat
   * @param ownerId Owner ID
   * @param now Current time
   */
  heartbeat(ownerId: string, now: UnixMillis): Promise<void>;

  /**
   * Reclaim Expired Leases
   * @description Reclaim running/paused items with lease.expiresAt < now to queued
   * @param now Current time
   * @returns Reclaimed Run ID list
   */
  reclaimExpiredLeases(now: UnixMillis): Promise<RunId[]>;

  /**
   * Recover Orphan Leases (Called after SW Restart)
   * @description
   * - Reclaim orphan running items to queued (status -> queued, lease cleared)
   * - Adopt orphan paused items (keep status=paused, lease ownerId updated to new ownerId)
   * @param ownerId New ownerId (Current Service Worker Instance)
   * @param now Current time
   * @returns Affected runId list (including original ownerId for auditing)
   */
  recoverOrphanLeases(
    ownerId: string,
    now: UnixMillis,
  ): Promise<{
    requeuedRunning: Array<{ runId: RunId; prevOwnerId?: string }>;
    adoptedPaused: Array<{ runId: RunId; prevOwnerId?: string }>;
  }>;

  /**
   * Mark as running
   */
  markRunning(runId: RunId, ownerId: string, now: UnixMillis): Promise<void>;

  /**
   * Mark as paused
   */
  markPaused(runId: RunId, ownerId: string, now: UnixMillis): Promise<void>;

  /**
   * Mark as done (Remove from queue)
   */
  markDone(runId: RunId, now: UnixMillis): Promise<void>;

  /**
   * Cancel Run
   */
  cancel(runId: RunId, now: UnixMillis, reason?: string): Promise<void>;

  /**
   * Get queue item
   */
  get(runId: RunId): Promise<RunQueueItem | null>;

  /**
   * List queue items
   */
  list(status?: QueueItemStatus): Promise<RunQueueItem[]>;
}

/**
 * Create NotImplemented RunQueue
 * @description Phase 0 Placeholder Implementation
 */
export function createNotImplementedQueue(): RunQueue {
  const notImplemented = () => {
    throw new Error('RunQueue not implemented');
  };

  return {
    enqueue: async () => notImplemented(),
    claimNext: async () => notImplemented(),
    heartbeat: async () => notImplemented(),
    reclaimExpiredLeases: async () => notImplemented(),
    recoverOrphanLeases: async () => notImplemented(),
    markRunning: async () => notImplemented(),
    markPaused: async () => notImplemented(),
    markDone: async () => notImplemented(),
    cancel: async () => notImplemented(),
    get: async () => notImplemented(),
    list: async () => notImplemented(),
  };
}
