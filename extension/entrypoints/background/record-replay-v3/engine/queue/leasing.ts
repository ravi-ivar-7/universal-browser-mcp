/**
 * @fileoverview Lease Management
 * @description Manages Run lease renewal and expiration reclamation
 */

import type { UnixMillis } from '../../domain/json';
import type { RunId } from '../../domain/ids';
import type { RunQueue, RunQueueConfig, Lease } from './queue';

/**
 * Lease Manager
 * @description Manages lease renewal and expiration detection
 */
export interface LeaseManager {
  /**
   * Start Heartbeat
   * @param ownerId Owner ID
   */
  startHeartbeat(ownerId: string): void;

  /**
   * Stop Heartbeat
   * @param ownerId Owner ID
   */
  stopHeartbeat(ownerId: string): void;

  /**
   * Check and Reclaim Expired Leases
   * @param now Current time
   * @returns Reclaimed Run ID list
   */
  reclaimExpiredLeases(now: UnixMillis): Promise<RunId[]>;

  /**
   * Check if lease is expired
   */
  isLeaseExpired(lease: Lease, now: UnixMillis): boolean;

  /**
   * Create New Lease
   */
  createLease(ownerId: string, now: UnixMillis): Lease;

  /**
   * Stop all heartbeats
   */
  dispose(): void;
}

/**
 * Create Lease Manager
 */
export function createLeaseManager(queue: RunQueue, config: RunQueueConfig): LeaseManager {
  const heartbeatTimers = new Map<string, ReturnType<typeof setInterval>>();

  return {
    startHeartbeat(ownerId: string): void {
      // Stop if timer exists
      this.stopHeartbeat(ownerId);

      // Create new heartbeat timer
      const timer = setInterval(async () => {
        try {
          await queue.heartbeat(ownerId, Date.now());
        } catch (error) {
          console.error(`[LeaseManager] Heartbeat failed for ${ownerId}:`, error);
        }
      }, config.heartbeatIntervalMs);

      heartbeatTimers.set(ownerId, timer);
    },

    stopHeartbeat(ownerId: string): void {
      const timer = heartbeatTimers.get(ownerId);
      if (timer) {
        clearInterval(timer);
        heartbeatTimers.delete(ownerId);
      }
    },

    async reclaimExpiredLeases(now: UnixMillis): Promise<RunId[]> {
      // Delegate to the queue implementation which uses the lease_expiresAt index
      // for efficient scanning and updates storage atomically.
      return queue.reclaimExpiredLeases(now);
    },

    isLeaseExpired(lease: Lease, now: UnixMillis): boolean {
      return lease.expiresAt < now;
    },

    createLease(ownerId: string, now: UnixMillis): Lease {
      return {
        ownerId,
        expiresAt: now + config.leaseTtlMs,
      };
    },

    dispose(): void {
      for (const timer of heartbeatTimers.values()) {
        clearInterval(timer);
      }
      heartbeatTimers.clear();
    },
  };
}

/**
 * Generate Unique Owner ID
 * @description Used to identify current Service Worker instance
 */
export function generateOwnerId(): string {
  return `sw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
