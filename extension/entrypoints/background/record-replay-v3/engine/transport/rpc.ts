/**
 * @fileoverview Port RPC Protocol Definition
 * @description Defines protocol types for communication via chrome.runtime.Port
 */

import type { JsonObject, JsonValue } from '../../domain/json';
import type { RunId } from '../../domain/ids';
import type { RunEvent } from '../../domain/events';

/** Port Name */
export const RR_V3_PORT_NAME = 'rr_v3' as const;

/**
 * RPC Method Names
 */
export type RpcMethod =
  // Query Methods
  | 'rr_v3.listRuns'
  | 'rr_v3.getRun'
  | 'rr_v3.getEvents'
  // Flow Management Methods
  | 'rr_v3.getFlow'
  | 'rr_v3.listFlows'
  | 'rr_v3.saveFlow'
  | 'rr_v3.deleteFlow'
  // Trigger Management Methods
  | 'rr_v3.createTrigger'
  | 'rr_v3.updateTrigger'
  | 'rr_v3.deleteTrigger'
  | 'rr_v3.getTrigger'
  | 'rr_v3.listTriggers'
  | 'rr_v3.enableTrigger'
  | 'rr_v3.disableTrigger'
  | 'rr_v3.fireTrigger'
  // Queue Management Methods
  | 'rr_v3.enqueueRun'
  | 'rr_v3.listQueue'
  | 'rr_v3.cancelQueueItem'
  // Control Methods
  | 'rr_v3.startRun'
  | 'rr_v3.cancelRun'
  | 'rr_v3.pauseRun'
  | 'rr_v3.resumeRun'
  // Debug Methods
  | 'rr_v3.debug'
  // Subscription Methods
  | 'rr_v3.subscribe'
  | 'rr_v3.unsubscribe';

/**
 * RPC Request Message
 */
export interface RpcRequest {
  type: 'rr_v3.request';
  /** Request ID (for matching response) */
  requestId: string;
  /** Method Name */
  method: RpcMethod;
  /** Parameters */
  params?: JsonObject;
}

/**
 * RPC Success Response
 */
export interface RpcResponseOk {
  type: 'rr_v3.response';
  /** Corresponding Request ID */
  requestId: string;
  ok: true;
  /** Result */
  result: JsonValue;
}

/**
 * RPC Error Response
 */
export interface RpcResponseErr {
  type: 'rr_v3.response';
  /** Corresponding Request ID */
  requestId: string;
  ok: false;
  /** Error Message */
  error: string;
}

/**
 * RPC Response
 */
export type RpcResponse = RpcResponseOk | RpcResponseErr;

/**
 * RPC Event Push
 */
export interface RpcEventMessage {
  type: 'rr_v3.event';
  /** Event Data */
  event: RunEvent;
}

/**
 * RPC Subscribe Ack
 */
export interface RpcSubscribeAck {
  type: 'rr_v3.subscribeAck';
  /** Subscribed Run ID (Optional, null means all) */
  runId: RunId | null;
}

/**
 * All RPC Message Types
 */
export type RpcMessage =
  | RpcRequest
  | RpcResponseOk
  | RpcResponseErr
  | RpcEventMessage
  | RpcSubscribeAck;

/**
 * Generate Unique Request ID
 */
export function generateRequestId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Check if message is RPC Request
 */
export function isRpcRequest(msg: unknown): msg is RpcRequest {
  return typeof msg === 'object' && msg !== null && (msg as RpcRequest).type === 'rr_v3.request';
}

/**
 * Check if message is RPC Response
 */
export function isRpcResponse(msg: unknown): msg is RpcResponse {
  return typeof msg === 'object' && msg !== null && (msg as RpcResponse).type === 'rr_v3.response';
}

/**
 * Check if message is RPC Event
 */
export function isRpcEvent(msg: unknown): msg is RpcEventMessage {
  return typeof msg === 'object' && msg !== null && (msg as RpcEventMessage).type === 'rr_v3.event';
}

/**
 * Create RPC Request
 */
export function createRpcRequest(method: RpcMethod, params?: JsonObject): RpcRequest {
  return {
    type: 'rr_v3.request',
    requestId: generateRequestId(),
    method,
    params,
  };
}

/**
 * Create Success Response
 */
export function createRpcResponseOk(requestId: string, result: JsonValue): RpcResponseOk {
  return {
    type: 'rr_v3.response',
    requestId,
    ok: true,
    result,
  };
}

/**
 * Create Error Response
 */
export function createRpcResponseErr(requestId: string, error: string): RpcResponseErr {
  return {
    type: 'rr_v3.response',
    requestId,
    ok: false,
    error,
  };
}

/**
 * Create Event Message
 */
export function createRpcEventMessage(event: RunEvent): RpcEventMessage {
  return {
    type: 'rr_v3.event',
    event,
  };
}
