/**
 * @fileoverview Policy type definitions
 * @description Defines timeout, retry, error handling, and artifact policies used in Record-Replay
 */

import type { EdgeLabel, NodeId } from './ids';
import type { RRErrorCode } from './errors';
import type { UnixMillis } from './json';

/**
 * Timeout policy
 * @description Defines operation timeout duration and scope
 */
export interface TimeoutPolicy {
  /** Timeout duration (milliseconds) */
  ms: UnixMillis;
  /** Timeout scope: attempt=each attempt, node=entire node execution */
  scope?: 'attempt' | 'node';
}

/**
 * Retry policy
 * @description Defines retry behavior after failure
 */
export interface RetryPolicy {
  /** Maximum retry count */
  retries: number;
  /** Retry interval (milliseconds) */
  intervalMs: UnixMillis;
  /** Backoff strategy: none=fixed interval, exp=exponential backoff, linear=linear growth */
  backoff?: 'none' | 'exp' | 'linear';
  /** Maximum retry interval (milliseconds) */
  maxIntervalMs?: UnixMillis;
  /** Jitter strategy: none=no jitter, full=full random */
  jitter?: 'none' | 'full';
  /** Only retry on these error codes */
  retryOn?: ReadonlyArray<RRErrorCode>;
}

/**
 * Error handling policy
 * @description Defines how to handle node execution failures
 */
export type OnErrorPolicy =
  | { kind: 'stop' }
  | { kind: 'continue'; as?: 'warning' | 'error' }
  | {
    kind: 'goto';
    target: { kind: 'edgeLabel'; label: EdgeLabel } | { kind: 'node'; nodeId: NodeId };
  }
  | { kind: 'retry'; override?: Partial<RetryPolicy> };

/**
 * Artifact policy
 * @description Defines screenshot and log collection behavior
 */
export interface ArtifactPolicy {
  /** Screenshot policy: never=never, onFailure=on failure, always=always */
  screenshot?: 'never' | 'onFailure' | 'always';
  /** Screenshot save path template */
  saveScreenshotAs?: string;
  /** Whether to include console logs */
  includeConsole?: boolean;
  /** Whether to include network requests */
  includeNetwork?: boolean;
}

/**
 * Wait policy
 * @description Defines wait behavior before node execution
 */
export interface WaitPolicy {
  /** Wait time before execution (milliseconds) */
  delayBeforeMs?: UnixMillis;
  /** Whether to wait for network idle */
  waitForNetworkIdle?: boolean;
  /** Whether to wait for stable DOM */
  waitForStableDom?: boolean;
}

/**
 * Node-level policy
 * @description Execution policy configuration for a single node
 */
export interface NodePolicy {
  /** Timeout policy */
  timeout?: TimeoutPolicy;
  /** Retry policy */
  retry?: RetryPolicy;
  /** Wait policy */
  wait?: WaitPolicy;
  /** Error handling policy */
  onError?: OnErrorPolicy;
  /** Artifact policy */
  artifacts?: ArtifactPolicy;
}

/**
 * Flow-level policy
 * @description Execution policy configuration for entire Flow
 */
export interface FlowPolicy {
  /** Default node policy */
  defaultNodePolicy?: NodePolicy;
  /** Handling policy for unsupported nodes */
  unsupportedNodePolicy?: OnErrorPolicy;
  /** Run total timeout duration (milliseconds) */
  runTimeoutMs?: UnixMillis;
}

/**
 * Merge node policies
 * @description Merges Flow-level default policy with node-level policy
 */
export function mergeNodePolicy(
  flowDefault: NodePolicy | undefined,
  nodePolicy: NodePolicy | undefined,
): NodePolicy {
  if (!flowDefault) return nodePolicy ?? {};
  if (!nodePolicy) return flowDefault;

  return {
    timeout: nodePolicy.timeout ?? flowDefault.timeout,
    retry: nodePolicy.retry ?? flowDefault.retry,
    wait: nodePolicy.wait ?? flowDefault.wait,
    onError: nodePolicy.onError ?? flowDefault.onError,
    artifacts: nodePolicy.artifacts
      ? { ...flowDefault.artifacts, ...nodePolicy.artifacts }
      : flowDefault.artifacts,
  };
}
