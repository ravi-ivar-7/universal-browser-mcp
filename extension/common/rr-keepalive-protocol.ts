/**
 * @fileoverview RR Keepalive Protocol Constants
 * @description Shared protocol constants for Background-Offscreen keepalive communication
 */

/** Keepalive Port Name */
/** Keepalive Port Name */
export const RR_KEEPALIVE_PORT_NAME = 'rr_keepalive' as const;

/** Keepalive Message Type */
export type KeepaliveMessageType =
  | 'keepalive.ping'
  | 'keepalive.pong'
  | 'keepalive.start'
  | 'keepalive.stop';

/** Keepalive Message */
export interface KeepaliveMessage {
  type: KeepaliveMessageType;
  timestamp: number;
}

/** Default Heartbeat Interval (ms) - Offscreen sends ping at this interval */
export const DEFAULT_KEEPALIVE_PING_INTERVAL_MS = 20_000;

/** Max Heartbeat Interval (ms) - Chrome MV3 SW terminates after approx 30s idle */
export const MAX_KEEPALIVE_PING_INTERVAL_MS = 25_000;
