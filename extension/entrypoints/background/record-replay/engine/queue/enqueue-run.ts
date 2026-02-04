/**
 * @fileoverview Shared Enqueue Service
 * @description
 * Provides unified Run enqueue logic, shared by RPC Server and TriggerManager.
 *
 * Design Rationale:
 * - Decouple enqueue logic from RpcServer into a standalone service
 * - Avoid behavior drift between RPC and TriggerManager
 * - Unify parameter validation, Run creation, Queue enqueue, and Event publishing flow
 */

import type { JsonObject, UnixMillis } from '../../domain/json';
import type { FlowId, NodeId, RunId } from '../../domain/ids';
import type { TriggerFireContext } from '../../domain/triggers';
import { RUN_SCHEMA_VERSION, type RunRecord } from '../../domain/events';
import type { StoragePort } from '../storage/storage-port';
import type { EventsBus } from '../transport/events-bus';
import type { RunScheduler } from './scheduler';

// ==================== Types ====================

/**
 * Enqueue Service Dependencies
 */
export interface EnqueueRunDeps {
  /** Storage Layer (only flows/runs/queue needed) */
  storage: Pick<StoragePort, 'flows' | 'runs' | 'queue'>;
  /** Events Bus */
  events: Pick<EventsBus, 'append'>;
  /** Scheduler (optional) */
  scheduler?: Pick<RunScheduler, 'kick'>;
  /** RunId Generator (for testing injection) */
  generateRunId?: () => RunId;
  /** Time Source (for testing injection) */
  now?: () => UnixMillis;
}

/**
 * Enqueue Request Parameters
 */
export interface EnqueueRunInput {
  /** Flow ID (Required) */
  flowId: FlowId;
  /** Start Node ID (Optional, defaults to Flow's entryNodeId) */
  startNodeId?: NodeId;
  /** Priority (Default 0) */
  priority?: number;
  /** Max Attempts (Default 1) */
  maxAttempts?: number;
  /** Arguments passed to Flow */
  args?: JsonObject;
  /** Trigger Context (Set by TriggerManager) */
  trigger?: TriggerFireContext;
  /** Debug Options */
  debug?: {
    breakpoints?: NodeId[];
    pauseOnStart?: boolean;
  };
}

/**
 * Enqueue Result
 */
export interface EnqueueRunResult {
  /** New Run ID */
  runId: RunId;
  /** Position in Queue (1-based) */
  position: number;
}

// ==================== Utilities ====================

/**
 * Default RunId Generator
 */
function defaultGenerateRunId(): RunId {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Validate Integer Parameter
 */
function validateInt(
  value: unknown,
  defaultValue: number,
  fieldName: string,
  opts?: { min?: number; max?: number },
): number {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number`);
  }
  const intValue = Math.floor(value);
  if (opts?.min !== undefined && intValue < opts.min) {
    throw new Error(`${fieldName} must be >= ${opts.min}`);
  }
  if (opts?.max !== undefined && intValue > opts.max) {
    throw new Error(`${fieldName} must be <= ${opts.max}`);
  }
  return intValue;
}

/**
 * Compute Run Position in Queue
 * @description Scheduling order: priority DESC + createdAt ASC
 * @returns 1-based position, or -1 if run not found in queued items
 *
 * Note: Due to race conditions (scheduler may claim the run before this is called),
 * position may be -1. Callers should handle this gracefully.
 */
async function computeQueuePosition(
  storage: Pick<StoragePort, 'queue'>,
  runId: RunId,
): Promise<number> {
  const queueItems = await storage.queue.list('queued');
  queueItems.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.createdAt - b.createdAt;
  });
  const index = queueItems.findIndex((item) => item.id === runId);
  // Return -1 if not found (run may have been claimed already)
  return index === -1 ? -1 : index + 1;
}

// ==================== Main Function ====================

/**
 * Enqueue a Run for execution
 * @description
 * Execution Steps:
 * 1. Parameter Validation
 * 2. Verify Flow existence
 * 3. Create RunRecordV3 (status=queued)
 * 4. Enqueue to RunQueue
 * 5. Publish run.queued event
 * 6. Trigger scheduling (best-effort)
 * 7. Compute queue position
 */
export async function enqueueRun(
  deps: EnqueueRunDeps,
  input: EnqueueRunInput,
): Promise<EnqueueRunResult> {
  const { flowId } = input;
  if (!flowId) {
    throw new Error('flowId is required');
  }

  const now = deps.now ?? (() => Date.now());
  const generateRunId = deps.generateRunId ?? defaultGenerateRunId;

  // Parameter Validation
  const priority = validateInt(input.priority, 0, 'priority');
  const maxAttempts = validateInt(input.maxAttempts, 1, 'maxAttempts', { min: 1 });

  // Verify Flow existence
  const flow = await deps.storage.flows.get(flowId);
  if (!flow) {
    throw new Error(`Flow "${flowId}" not found`);
  }

  // Verify startNodeId exists in Flow
  if (input.startNodeId) {
    const nodeExists = flow.nodes.some((n) => n.id === input.startNodeId);
    if (!nodeExists) {
      throw new Error(`startNodeId "${input.startNodeId}" not found in flow "${flowId}"`);
    }
  }

  const ts = now();
  const runId = generateRunId();

  // 1. Create RunRecord
  const runRecord: RunRecord = {
    schemaVersion: RUN_SCHEMA_VERSION,
    id: runId,
    flowId,
    status: 'queued',
    createdAt: ts,
    updatedAt: ts,
    attempt: 0,
    maxAttempts,
    args: input.args,
    trigger: input.trigger,
    debug: input.debug,
    startNodeId: input.startNodeId,
    nextSeq: 0,
  };
  await deps.storage.runs.save(runRecord);

  // 2. Enqueue
  await deps.storage.queue.enqueue({
    id: runId,
    flowId,
    priority,
    maxAttempts,
    args: input.args,
    trigger: input.trigger,
    debug: input.debug,
  });

  // 3. Publish run.queued event
  await deps.events.append({
    runId,
    type: 'run.queued',
    flowId,
  });

  // 4. Compute queue position (Before kick to reduce race condition causing position=-1)
  const position = await computeQueuePosition(deps.storage, runId);

  // 5. Trigger scheduling (best-effort, non-blocking)
  if (deps.scheduler) {
    void deps.scheduler.kick();
  }

  return { runId, position };
}
