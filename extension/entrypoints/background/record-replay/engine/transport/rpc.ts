/**
 * @fileoverview Port RPC Protocol Definition
 * @description Defines protocol types for communication via chrome.runtime.Port
 */

import type { JsonObject, JsonValue } from '../../domain/json';
import type { RunId } from '../../domain/ids';
import type { RunEvent } from '../../domain/events';

/** Port Name */
export const RR_PORT_NAME = 'rr' as const;

/**
 * RPC Method Names
 */
export type RpcMethod =
  // Query Methods
  | 'rr.listRuns'
  | 'rr.getRun'
  | 'rr.getEvents'
  // Flow Management Methods
  | 'rr.getFlow'
  | 'rr.listFlows'
  | 'rr.saveFlow'
  | 'rr.deleteFlow'
  // Trigger Management Methods
  | 'rr.createTrigger'
  | 'rr.updateTrigger'
  | 'rr.deleteTrigger'
  | 'rr.getTrigger'
  | 'rr.listTriggers'
  | 'rr.enableTrigger'
  | 'rr.disableTrigger'
  | 'rr.fireTrigger'
  // Queue Management Methods
  | 'rr.enqueueRun'
  | 'rr.listQueue'
  | 'rr.cancelQueueItem'
  // Control Methods
  | 'rr.startRun'
  | 'rr.cancelRun'
  | 'rr.pauseRun'
  | 'rr.resumeRun'
  // Debug Methods
  | 'rr.debug'
  // Subscription Methods
  | 'rr.subscribe'
  | 'rr.unsubscribe';

/**
 * RPC Request Message
 */
export interface RpcRequest {
  type: 'rr.request';
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
  type: 'rr.response';
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
  type: 'rr.response';
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
  type: 'rr.event';
  /** Event Data */
  event: RunEvent;
}

/**
 * RPC Subscribe Ack
 */
export interface RpcSubscribeAck {
  type: 'rr.subscribeAck';
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
  return typeof msg === 'object' && msg !== null && (msg as RpcRequest).type === 'rr.request';
}

/**
 * Check if message is RPC Response
 */
export function isRpcResponse(msg: unknown): msg is RpcResponse {
  return typeof msg === 'object' && msg !== null && (msg as RpcResponse).type === 'rr.response';
}

/**
 * Check if message is RPC Event
 */
export function isRpcEvent(msg: unknown): msg is RpcEventMessage {
  return typeof msg === 'object' && msg !== null && (msg as RpcEventMessage).type === 'rr.event';
}

/**
 * Create RPC Request
 */
export function createRpcRequest(method: RpcMethod, params?: JsonObject): RpcRequest {
  return {
    type: 'rr.request',
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
    type: 'rr.response',
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
    type: 'rr.response',
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
    type: 'rr.event',
    event,
  };
}
