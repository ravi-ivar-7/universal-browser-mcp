/**
 * @fileoverview RunRunner Interface and Implementation
 * @description Defines and implements the sequential executor for a single Run
 */

import type { NodeId, RunId } from '../../domain/ids';
import { EDGE_LABELS } from '../../domain/ids';

import type { Flow, Node } from '../../domain/flow';
import { findNodeById } from '../../domain/flow';
import type {
  PauseReason,
  RunEvent,
  RunEventInput,
  RunRecord,
  Unsubscribe,
} from '../../domain/events';
import { RUN_SCHEMA_VERSION } from '../../domain/events';
import type { JsonObject, JsonValue } from '../../domain/json';
import { RR_ERROR_CODES, createRRError, type RRError } from '../../domain/errors';
import type { NodePolicy, RetryPolicy, WaitPolicy } from '../../domain/policy';
import { mergeNodePolicy } from '../../domain/policy';

import type { EventsBus } from '../transport/events-bus';
import type { StoragePort } from '../storage/storage-port';
import type { PluginRegistry } from '../plugins/registry';
import { getPluginRegistry } from '../plugins/registry';
import type { NodeExecutionContext, NodeExecutionResult, VarsPatchOp } from '../plugins/types';

import type { ArtifactService } from './artifacts';
import { createNotImplementedArtifactService } from './artifacts';
import { getBreakpointRegistry, type BreakpointManager } from './breakpoints';
import { findEdgeByLabel, findNextNode, validateFlowDAG } from './traversal';
import type { RunResult } from './kernel';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { handleCallTool } from '@/entrypoints/background/tools';
import { logOverlay } from '../../../log-overlay-util';

const MAX_STEP_COUNT = 1000;

// ==================== Types ====================

/**
 * RunRunner Runtime State
 */
export interface RunnerRuntimeState {
  /** Run ID */
  runId: RunId;
  /** Flow ID */
  flowId: string;
  /** Current Node ID */
  currentNodeId: NodeId | null;
  /** Current Attempt Count */
  attempt: number;
  /** Variables Table */
  vars: Record<string, JsonValue>;
  /** Paused Flag */
  paused: boolean;
  /** Canceled Flag */
  canceled: boolean;
  /** Execution Status */
  status: 'running' | 'paused' | 'canceled' | 'succeeded' | 'failed';
}

/**
 * RunRunner Configuration
 */
export interface RunnerConfig {
  /** Flow Snapshot */
  flow: Flow;
  /** Tab ID */
  tabId: number;
  /** Initial Args */
  args?: JsonObject;
  /** Start Node ID */
  startNodeId?: NodeId;
  /** Debug Configuration */
  debug?: { breakpoints?: NodeId[]; pauseOnStart?: boolean };
  /** Whether to capture network traffic */
  captureNetwork?: boolean;
}

/**
 * RunRunner Interface
 */
export interface RunRunner {
  /** Run ID */
  readonly runId: RunId;
  /** Current State */
  readonly state: RunnerRuntimeState;
  /** Subscribe to events */
  onEvent(listener: (event: RunEvent) => void): Unsubscribe;
  /** Start execution */
  start(): Promise<RunResult>;
  /** Pause execution */
  pause(): void;
  /** Resume execution */
  resume(): void;
  /** Cancel execution */
  cancel(reason?: string): void;
  /** Get variable value */
  getVar(name: string): JsonValue | undefined;
  /** Set variable value */
  setVar(name: string, value: JsonValue): void;
}

/**
 * RunRunner Factory Interface
 */
export interface RunRunnerFactory {
  create(runId: RunId, config: RunnerConfig): RunRunner;
}

/**
 * RunRunner Factory Dependencies
 */
export interface RunRunnerFactoryDeps {
  storage: StoragePort;
  events: EventsBus;
  plugins?: PluginRegistry;
  artifactService?: ArtifactService;
  now?: () => number;
}

// ==================== Helpers ====================

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err)
    return String((err as { message: unknown }).message);
  return String(err);
}

async function withTimeout<T>(
  p: Promise<T>,
  ms: number | undefined,
  onTimeout: () => RRError,
): Promise<T> {
  if (ms === undefined || !Number.isFinite(ms) || ms <= 0) {
    return p;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(onTimeout()), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

function computeRetryDelayMs(policy: RetryPolicy, attempt: number): number {
  const base = Math.max(0, policy.intervalMs);
  let delay = base;
  const backoff = policy.backoff ?? 'none';

  if (backoff === 'linear') {
    delay = base * attempt;
  } else if (backoff === 'exp') {
    delay = base * Math.pow(2, Math.max(0, attempt - 1));
  }

  if (policy.maxIntervalMs !== undefined) {
    delay = Math.min(delay, Math.max(0, policy.maxIntervalMs));
  }

  if (policy.jitter === 'full') {
    delay = Math.floor(Math.random() * (delay + 1));
  }

  return Math.max(0, Math.floor(delay));
}

function applyVarsPatch(vars: Record<string, JsonValue>, patch: VarsPatchOp[]): void {
  for (const op of patch) {
    if (op.op === 'set') {
      vars[op.name] = op.value ?? null;
    } else {
      delete vars[op.name];
    }
  }
}

function toRRError(err: unknown, fallback: { code: string; message: string }): RRError {
  if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
    return err as RRError;
  }
  return createRRError(
    fallback.code as RRError['code'],
    `${fallback.message}: ${errorMessage(err)}`,
  );
}

/**
 * Serial queue for write operations
 * Ensures event ordering and reduces write races
 */
class SerialQueue {
  private tail: Promise<void> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tail.then(fn, fn);
    this.tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}

// ==================== Factory ====================

/**
 * Create NotImplemented RunRunnerFactory
 */
export function createNotImplementedRunnerFactory(): RunRunnerFactory {
  return {
    create: () => {
      throw new Error('RunRunnerFactory not implemented');
    },
  };
}

/**
 * Create RunRunner Factory
 */
export function createRunRunnerFactory(deps: RunRunnerFactoryDeps): RunRunnerFactory {
  const plugins = deps.plugins ?? getPluginRegistry();
  const artifactService = deps.artifactService ?? createNotImplementedArtifactService();
  const now = deps.now ?? Date.now;

  return {
    create: (runId, config) =>
      new StorageBackedRunRunner(runId, config, {
        storage: deps.storage,
        events: deps.events,
        plugins,
        artifactService,
        now,
      }),
  };
}

// ==================== Implementation ====================

interface RunnerEnv {
  storage: StoragePort;
  events: EventsBus;
  plugins: PluginRegistry;
  artifactService: ArtifactService;
  now: () => number;
}

type OnErrorDecision =
  | { kind: 'stop' }
  | { kind: 'continue' }
  | {
    kind: 'goto';
    target: { kind: 'edgeLabel'; label: string } | { kind: 'node'; nodeId: NodeId };
  }
  | { kind: 'retry'; retryPolicy: RetryPolicy | null };

type NodeRunResult =
  | { nextNodeId: NodeId | null }
  | { terminal: 'failed'; error: RRError }
  | { terminal: 'canceled' };

/**
 * Storage-backed RunRunner implementation
 */
class StorageBackedRunRunner implements RunRunner {
  readonly runId: RunId;
  readonly state: RunnerRuntimeState;

  private readonly config: RunnerConfig;
  private readonly env: RunnerEnv;
  private readonly queue = new SerialQueue();
  private readonly breakpoints: BreakpointManager;
  private stepCount = 0;

  private startPromise: Promise<RunResult> | null = null;
  private outputs: JsonObject = {};
  private cancelReason: string | undefined;
  private pauseWaiter: Deferred<void> | null = null;

  constructor(runId: RunId, config: RunnerConfig, env: RunnerEnv) {
    this.runId = runId;
    this.config = config;
    this.env = env;

    this.state = {
      runId,
      flowId: config.flow.id,
      currentNodeId: null,
      attempt: 0,
      vars: this.buildInitialVars(),
      paused: false,
      canceled: false,
      status: 'running',
    };

    this.breakpoints = getBreakpointRegistry().getOrCreate(runId, config.debug?.breakpoints);
  }

  onEvent(listener: (event: RunEvent) => void): Unsubscribe {
    return this.env.events.subscribe(listener, { runId: this.runId });
  }

  start(): Promise<RunResult> {
    if (!this.startPromise) {
      this.startPromise = this.run();
    }
    return this.startPromise;
  }

  pause(): void {
    this.requestPause({ kind: 'command' });
  }

  resume(): void {
    if (!this.state.paused) return;
    this.state.paused = false;
    this.state.status = 'running';
    this.pauseWaiter?.resolve(undefined);
    this.pauseWaiter = null;

    void this.queue
      .run(async () => {
        await this.env.storage.runs.patch(this.runId, { status: 'running' });
        await this.env.events.append({ runId: this.runId, type: 'run.resumed' } as RunEventInput);
      })
      .catch((e) => {
        console.error('[RunRunner] resume persistence failed:', e);
      });
  }

  cancel(reason?: string): void {
    if (this.state.canceled) return;
    this.state.canceled = true;
    this.state.status = 'canceled';
    this.cancelReason = reason;

    if (this.state.paused) {
      this.state.paused = false;
      this.pauseWaiter?.resolve(undefined);
      this.pauseWaiter = null;
    }
  }

  getVar(name: string): JsonValue | undefined {
    return this.state.vars[name];
  }

  setVar(name: string, value: JsonValue): void {
    this.state.vars[name] = value;

    // Best-effort: emit vars.patch event
    void this.queue
      .run(() =>
        this.env.events.append({
          runId: this.runId,
          type: 'vars.patch',
          patch: [{ op: 'set', name, value }],
        } as RunEventInput),
      )
      .catch(() => { });
  }

  // ==================== Private Methods ====================

  private buildInitialVars(): Record<string, JsonValue> {
    const vars: Record<string, JsonValue> = { ...(this.config.args ?? {}) };
    for (const def of this.config.flow.variables ?? []) {
      if (vars[def.name] === undefined && def.default !== undefined) {
        vars[def.name] = def.default;
      }
    }
    return vars;
  }

  private requestPause(reason: PauseReason): void {
    if (this.state.canceled) return;
    if (this.state.paused) return;

    this.state.paused = true;
    this.state.status = 'paused';
    if (!this.pauseWaiter) {
      this.pauseWaiter = createDeferred<void>();
    }

    const nodeId = this.state.currentNodeId ?? undefined;
    void this.queue
      .run(async () => {
        await this.env.storage.runs.patch(this.runId, {
          status: 'paused',
          ...(nodeId ? { currentNodeId: nodeId } : {}),
        });
        await this.env.events.append({
          runId: this.runId,
          type: 'run.paused',
          reason,
          ...(nodeId ? { nodeId } : {}),
        } as RunEventInput);
      })
      .catch((e) => {
        console.error('[RunRunner] pause persistence failed:', e);
      });
  }

  private async waitIfPaused(): Promise<void> {
    while (this.state.paused && !this.state.canceled) {
      if (!this.pauseWaiter) {
        this.pauseWaiter = createDeferred<void>();
      }
      await this.pauseWaiter.promise;
    }
  }

  private async ensureRunRecord(startNodeId: NodeId, startedAt: number): Promise<void> {
    await this.queue.run(async () => {
      const existing = await this.env.storage.runs.get(this.runId);
      if (!existing) {
        const record: RunRecord = {
          schemaVersion: RUN_SCHEMA_VERSION,
          id: this.runId,
          flowId: this.config.flow.id,
          status: 'running',
          createdAt: startedAt,
          updatedAt: startedAt,
          startedAt,
          tabId: this.config.tabId,
          startNodeId: this.config.startNodeId,
          currentNodeId: startNodeId,
          attempt: 0,
          maxAttempts: 1,
          args: this.config.args,
          debug: this.config.debug,
          nextSeq: 1,
        };
        await this.env.storage.runs.save(record);
        return;
      }

      if (!Number.isSafeInteger(existing.nextSeq) || existing.nextSeq < 0) {
        throw createRRError(
          RR_ERROR_CODES.INVARIANT_VIOLATION,
          `Invalid nextSeq for run "${this.runId}": ${String(existing.nextSeq)}`,
        );
      }

      const patch: Partial<RunRecord> = {
        status: 'running',
        tabId: this.config.tabId,
        currentNodeId: startNodeId,
      };
      if (existing.startedAt === undefined) patch.startedAt = startedAt;
      if (this.config.startNodeId !== undefined) patch.startNodeId = this.config.startNodeId;
      if (this.config.args !== undefined) patch.args = this.config.args;
      if (this.config.debug !== undefined) patch.debug = this.config.debug;
      await this.env.storage.runs.patch(this.runId, patch);
    });
  }

  private async run(): Promise<RunResult> {
    const startedAt = this.env.now();
    const flow = this.config.flow;
    const { tabId } = this.config;

    // 0. Interactive Variable Collection
    const missingVars = (flow.variables || []).filter(v => v.required && (this.state.vars[v.name] === undefined || this.state.vars[v.name] === ''));
    if (missingVars.length > 0) {
      if (tabId) {
        void logOverlay.info(tabId, `Missing ${missingVars.length} required variables. Prompting user...`).catch(() => { });
        for (const v of missingVars) {
          try {
            const [{ result }] = await chrome.scripting.executeScript({
              target: { tabId },
              func: (msg) => prompt(msg),
              args: [`Please enter value for "${v.name}" (${v.description || 'Required'})`]
            });
            if (result) {
              this.state.vars[v.name] = result;
              void logOverlay.info(tabId, `Captured ${v.name}`).catch(() => { });
            }
          } catch (e) {
            console.error('Failed to prompt for variable', e);
          }
        }
      }

      // Re-check
      const stillMissing = (flow.variables || []).filter(v => v.required && (this.state.vars[v.name] === undefined || this.state.vars[v.name] === ''));
      if (stillMissing.length > 0) {
        const error = createRRError(
          RR_ERROR_CODES.VALIDATION_ERROR,
          `Missing required variables: ${stillMissing.map(v => v.name).join(', ')}`
        );
        return this.finishFailed(startedAt, error, undefined);
      }
    }

    // 1. Implicit Entry Point Heuristics
    let startNodeId = this.config.startNodeId || flow.entryNodeId;
    if (!startNodeId || !findNodeById(flow, startNodeId)) {
      // Fallback: Try to find root nodes (indegree 0) or simply the first node
      const hasIncoming = new Set(flow.edges.map(e => e.to));
      const roots = flow.nodes.filter(n => !hasIncoming.has(n.id));
      const candidate = roots[0] || flow.nodes[0];

      if (candidate) {
        startNodeId = candidate.id;
        // Log warning about implicit entry
        void this.queue.run(() =>
          this.env.events.append({
            runId: this.runId,
            type: 'run.started', // Will be logged properly below, just overlay for now
            flowId: flow.id,
            tabId: this.config.tabId,
            // We misuse this event slightly to log strict warning, or just use overlay
          } as RunEventInput)
        );
        if (this.config.tabId) {
          void logOverlay.warning(this.config.tabId, `No entry node found. Implicitly starting at ${candidate.kind} (${candidate.id})`).catch(() => { });
        }
      } else {
        return this.finishFailed(startedAt, createRRError(RR_ERROR_CODES.DAG_INVALID, 'Flow has no nodes'), undefined);
      }
    }

    // 1.5 Binding Enforcement
    if (flow.meta?.bindings && flow.meta.bindings.length > 0 && tabId) {
      try {
        const tab = await chrome.tabs.get(tabId);
        const currentUrl = tab.url || '';
        const matched = flow.meta.bindings.some(b => {
          if (b.kind === 'domain') return new URL(currentUrl).hostname.includes(b.value);
          if (b.kind === 'url') return currentUrl.startsWith(b.value);
          if (b.kind === 'path') return new URL(currentUrl).pathname.startsWith(b.value);
          return false;
        });

        if (!matched) {
          const error = createRRError(
            RR_ERROR_CODES.VALIDATION_ERROR,
            `Current URL "${currentUrl}" does not match flow bindings.`
          );
          // Log explicit error to overlay
          void logOverlay.error(tabId, `Binding Mismatch: Flow expects ${flow.meta.bindings.map(b => b.value).join(' or ')}`).catch(() => { });
          return this.finishFailed(startedAt, error, undefined);
        }
      } catch (e) {
        console.warn('Binding check failed', e);
        // Non-fatal if we can't check, but usually valid
      }
    }

    // 2. Network Capture
    if (this.config.captureNetwork) {
      try {
        await handleCallTool({
          name: TOOL_NAMES.BROWSER.NETWORK_DEBUGGER_START,
          args: { includeStatic: false, maxCaptureTime: 3 * 60_000, inactivityTimeout: 0 },
        });
        if (tabId) void logOverlay.info(tabId, 'Network capture started').catch(() => { });
      } catch (e) {
        console.error('Failed to start network capture', e);
        if (tabId) void logOverlay.warning(tabId, 'Network capture failed to start').catch(() => { });
      }
    }

    // Ensure Run record exists FIRST (before DAG validation)
    // so that finishFailed can safely patch the record
    await this.ensureRunRecord(startNodeId, startedAt);

    // Validate DAG
    const validation = validateFlowDAG(flow);
    if (!validation.ok) {
      const error =
        validation.errors[0] ?? createRRError(RR_ERROR_CODES.DAG_INVALID, 'Invalid DAG');
      return this.finishFailed(startedAt, error, undefined);
    }

    if (this.state.canceled) {
      return this.finishCanceled(startedAt);
    }

    // Emit run.started
    await this.queue.run(() =>
      this.env.events.append({
        runId: this.runId,
        type: 'run.started',
        flowId: flow.id,
        tabId: this.config.tabId,
      } as RunEventInput),
    );

    // Initialize log overlay on the tab
    if (this.config.tabId) {
      void logOverlay.init(this.config.tabId).catch(() => { });
    }

    // Handle pauseOnStart
    if (this.config.debug?.pauseOnStart) {
      this.requestPause({ kind: 'policy', nodeId: startNodeId, reason: 'pauseOnStart' });
    }

    // Main execution loop
    let currentNodeId: NodeId | null = startNodeId;
    while (currentNodeId) {
      // Loop Guard
      this.stepCount++;
      if (this.stepCount > MAX_STEP_COUNT) {
        const error = createRRError(RR_ERROR_CODES.DAG_EXECUTION_FAILED, `Exceeded maximum step count (${MAX_STEP_COUNT}). Possible infinite loop.`);
        return this.finishFailed(startedAt, error, currentNodeId);
      }

      this.state.currentNodeId = currentNodeId;

      // Only update currentNodeId, not status (to preserve paused state)
      const nodeIdToUpdate = currentNodeId; // Capture for closure
      await this.queue.run(() =>
        this.env.storage.runs.patch(this.runId, { currentNodeId: nodeIdToUpdate }),
      );

      if (this.state.canceled) break;
      await this.waitIfPaused();
      if (this.state.canceled) break;

      const node = findNodeById(flow, currentNodeId);
      if (!node) {
        const error = createRRError(
          RR_ERROR_CODES.DAG_INVALID,
          `Node "${currentNodeId}" not found in flow`,
        );
        return this.finishFailed(startedAt, error, currentNodeId);
      }

      // Skip disabled nodes
      if (node.disabled) {
        await this.queue.run(() =>
          this.env.events.append({
            runId: this.runId,
            type: 'node.skipped',
            nodeId: node.id,
            reason: 'disabled',
          } as RunEventInput),
        );
        currentNodeId = findNextNode(flow, node.id);
        continue;
      }

      // Check breakpoints
      if (this.breakpoints.shouldPauseAt(node.id)) {
        const reason: PauseReason =
          this.breakpoints.getStepMode() === 'stepOver'
            ? { kind: 'step', nodeId: node.id }
            : { kind: 'breakpoint', nodeId: node.id };

        // Clear step mode after hitting (to avoid infinite pause loop)
        if (this.breakpoints.getStepMode() === 'stepOver') {
          this.breakpoints.setStepMode('none');
        }

        this.requestPause(reason);
        await this.waitIfPaused();
        // After resume, proceed to execute the node (don't continue loop)
      }

      // Emit node.queued
      await this.queue.run(() =>
        this.env.events.append({
          runId: this.runId,
          type: 'node.queued',
          nodeId: node.id,
        } as RunEventInput),
      );

      // Execute node
      const nodeStartAt = this.env.now();
      const next = await this.runNode(flow, node, nodeStartAt);
      if ('terminal' in next) {
        if (next.terminal === 'canceled') break;
        if (next.terminal === 'failed') {
          return this.finishFailed(startedAt, next.error, node.id);
        }
        break;
      }

      currentNodeId = next.nextNodeId;
    }

    if (this.state.canceled) {
      return this.finishCanceled(startedAt);
    }

    return this.finishSucceeded(startedAt);
  }

  private async runNode(flow: Flow, node: Node, nodeStartAt: number): Promise<NodeRunResult> {
    let attempt = 1;

    for (; ;) {
      if (this.state.canceled) return { terminal: 'canceled' };
      await this.waitIfPaused();
      if (this.state.canceled) return { terminal: 'canceled' };

      this.state.attempt = attempt;

      // Emit node.started
      await this.queue.run(() =>
        this.env.events.append({
          runId: this.runId,
          type: 'node.started',
          nodeId: node.id,
          attempt,
        } as RunEventInput),
      );

      // Log to overlay
      if (this.config.tabId) {
        void logOverlay.step(this.config.tabId, node.kind, node.id, 'start').catch(() => { });
      }

      // Apply Wait Policy
      const prePolicy = this.resolveNodePolicy(flow, node);
      await this.applyWaitPolicy(prePolicy.wait);

      const exec = await this.executeNodeAttempt(flow, node);
      if (exec.status === 'succeeded') {
        const tookMs = this.env.now() - nodeStartAt;

        // Apply vars patch
        if (exec.varsPatch && exec.varsPatch.length > 0) {
          applyVarsPatch(this.state.vars, exec.varsPatch);
          await this.queue.run(() =>
            this.env.events.append({
              runId: this.runId,
              type: 'vars.patch',
              patch: exec.varsPatch,
            } as RunEventInput),
          );
        }

        // Merge outputs
        if (exec.outputs) {
          this.outputs = { ...this.outputs, ...exec.outputs };
        }

        // Emit node.succeeded
        await this.queue.run(() =>
          this.env.events.append({
            runId: this.runId,
            type: 'node.succeeded',
            nodeId: node.id,
            tookMs,
            ...(exec.next ? { next: exec.next } : {}),
          } as RunEventInput),
        );

        // Log success to overlay
        if (this.config.tabId) {
          void logOverlay.step(this.config.tabId, node.kind, node.id, 'success').catch(() => { });
        }

        if (exec.next?.kind === 'end') {
          return { nextNodeId: null };
        }

        const label = exec.next?.kind === 'edgeLabel' ? exec.next.label : undefined;
        return { nextNodeId: findNextNode(flow, node.id, label) };
      }

      // Handle failure
      const error = exec.error;
      const policy = this.resolveNodePolicy(flow, node);
      const decision = this.decideOnError(flow, node, policy, error);

      // Emit node.failed
      await this.queue.run(() =>
        this.env.events.append({
          runId: this.runId,
          type: 'node.failed',
          nodeId: node.id,
          attempt,
          error,
          decision: decision.kind,
        } as RunEventInput),
      );

      // Log failure to overlay
      if (this.config.tabId) {
        void logOverlay.step(this.config.tabId, node.kind, node.id, 'error', error.message).catch(() => { });
      }

      if (decision.kind === 'retry' && decision.retryPolicy) {
        const maxAttempts = 1 + Math.max(0, decision.retryPolicy.retries);
        const canRetry =
          attempt < maxAttempts &&
          (decision.retryPolicy.retryOn
            ? decision.retryPolicy.retryOn.includes(
              error.code as (typeof decision.retryPolicy.retryOn)[number],
            )
            : true);

        if (!canRetry) {
          return { terminal: 'failed', error };
        }

        const delay = computeRetryDelayMs(decision.retryPolicy, attempt);
        if (delay > 0) {
          await sleep(delay);
        }
        attempt++;
        continue;
      }

      if (decision.kind === 'continue') {
        return { nextNodeId: findNextNode(flow, node.id) };
      }

      if (decision.kind === 'goto') {
        if (decision.target.kind === 'node') {
          return { nextNodeId: decision.target.nodeId };
        }
        return { nextNodeId: findNextNode(flow, node.id, decision.target.label) };
      }

      return { terminal: 'failed', error };
    }
  }

  private resolveNodePolicy(flow: Flow, node: Node): NodePolicy {
    const def = this.env.plugins.getNode(node.kind);
    const flowDefault = flow.policy?.defaultNodePolicy;
    const pluginDefault = def?.defaultPolicy;
    const merged1 = mergeNodePolicy(flowDefault, pluginDefault);
    return mergeNodePolicy(merged1, node.policy);
  }

  private async applyWaitPolicy(wait?: WaitPolicy) {
    if (!wait) return;

    if (wait.delayBeforeMs && wait.delayBeforeMs > 0) {
      await sleep(wait.delayBeforeMs);
    }

    // We assume handleCallTool is available for more advanced waits if needed
    // but for V3 core, delay is the strict minimum.
    // StableDOM/NetworkIdle would typically require tool calls or script injections.
    if (wait.waitForStableDom || wait.waitForNetworkIdle) {
      // Placeholder for advanced wait logic
      // await handleCallTool({ name: TOOL_NAMES.BROWSER.WAIT_FOR_STABLE_DOM ... })
    }
  }

  private decideOnError(
    flow: Flow,
    node: Node,
    policy: NodePolicy,
    _error: RRError,
  ): OnErrorDecision {
    const configured = policy.onError;

    // Default: if there's an ON_ERROR edge, use it
    if (!configured) {
      const onErrorEdge = findEdgeByLabel(flow, node.id, EDGE_LABELS.ON_ERROR);
      if (onErrorEdge) {
        return { kind: 'goto', target: { kind: 'edgeLabel', label: EDGE_LABELS.ON_ERROR } };
      }
      return { kind: 'stop' };
    }

    if (configured.kind === 'stop') return { kind: 'stop' };
    if (configured.kind === 'continue') return { kind: 'continue' };
    if (configured.kind === 'goto') {
      return {
        kind: 'goto',
        target: configured.target as
          | { kind: 'edgeLabel'; label: string }
          | { kind: 'node'; nodeId: NodeId },
      };
    }

    // retry
    const base: RetryPolicy = policy.retry ?? { retries: 1, intervalMs: 0 };
    const retryPolicy: RetryPolicy = configured.override
      ? { ...base, ...configured.override }
      : base;
    return { kind: 'retry', retryPolicy };
  }

  private async executeNodeAttempt(flow: Flow, node: Node): Promise<NodeExecutionResult> {
    const def = this.env.plugins.getNode(node.kind);
    if (!def) {
      return {
        status: 'failed',
        error: createRRError(
          RR_ERROR_CODES.UNSUPPORTED_NODE,
          `Node kind "${node.kind}" is not registered`,
        ),
      };
    }

    let parsedConfig: unknown = node.config;
    try {
      parsedConfig = def.schema.parse(node.config);
    } catch (e) {
      return {
        status: 'failed',
        error: createRRError(
          RR_ERROR_CODES.VALIDATION_ERROR,
          `Invalid node config: ${errorMessage(e)}`,
        ),
      };
    }

    const ctx: NodeExecutionContext = {
      runId: this.runId,
      flow,
      nodeId: node.id,
      tabId: this.config.tabId,
      vars: this.state.vars,
      log: (level, message, data) => {
        void this.queue
          .run(() =>
            this.env.events.append({
              runId: this.runId,
              type: 'log',
              level,
              message,
              ...(data !== undefined ? { data } : {}),
            } as RunEventInput),
          )
          .catch(() => { });
      },
      chooseNext: (label) => ({ kind: 'edgeLabel', label }),
      artifacts: {
        screenshot: () => this.env.artifactService.screenshot(this.config.tabId),
      },
      persistent: {
        get: async (name) => (await this.env.storage.persistentVars.get(name))?.value,
        set: async (name, value) => {
          await this.env.storage.persistentVars.set(name, value);
        },
        delete: async (name) => {
          await this.env.storage.persistentVars.delete(name);
        },
      },
    };

    const policy = this.resolveNodePolicy(flow, node);
    const timeoutMs = policy.timeout?.ms;
    const scope = policy.timeout?.scope ?? 'attempt';
    const attemptTimeoutMs = scope === 'attempt' && timeoutMs !== undefined ? timeoutMs : undefined;

    try {
      const nodeWithConfig = { ...node, config: parsedConfig } as Parameters<typeof def.execute>[1];
      const execPromise = def.execute(ctx, nodeWithConfig);
      const result = await withTimeout(execPromise, attemptTimeoutMs, () =>
        createRRError(RR_ERROR_CODES.TIMEOUT, `Node "${node.id}" timed out`),
      );
      return result;
    } catch (e) {
      return {
        status: 'failed',
        error: toRRError(e, { code: RR_ERROR_CODES.INTERNAL, message: 'Node execution threw' }),
      };
    }
  }

  private finishSucceeded(startedAt: number): RunResult {
    this.state.status = 'succeeded';
    const finishedAt = this.env.now();
    const tookMs = finishedAt - startedAt;
    void this.queue.run(async () => {
      await this.env.storage.runs.patch(this.runId, {
        status: 'succeeded',
        finishedAt,
        tookMs,
        outputs: this.outputs,
      });
      await this.env.events.append({
        runId: this.runId,
        type: 'run.succeeded',
        tookMs,
        outputs: this.outputs,
      } as RunEventInput);
    });

    // Mark overlay as done
    if (this.config.tabId) {
      void logOverlay.done(this.config.tabId).catch(() => { });
    }

    // Filter sensitive outputs
    const sensitiveKeys = new Set(
      (this.config.flow.variables || [])
        .filter(v => !!(v as any).sensitive) // Cast in case sensitive missing from type definition yet
        .map(v => v.name)
    );
    const safeOutputs: Record<string, JsonValue> = {};
    for (const [key, val] of Object.entries(this.outputs)) {
      if (!sensitiveKeys.has(key)) {
        safeOutputs[key] = val;
      }
    }

    // Stop network capture if it was started (backgrounded)
    if (this.config.captureNetwork) {
      void this.queue.run(async () => {
        try {
          await handleCallTool({ name: TOOL_NAMES.BROWSER.NETWORK_DEBUGGER_STOP, args: {} });
        } catch { }
      });
    }

    return { runId: this.runId, status: 'succeeded', tookMs, outputs: safeOutputs };
  }

  private finishFailed(startedAt: number, error: RRError, nodeId?: NodeId): RunResult {
    this.state.status = 'failed';
    const finishedAt = this.env.now();
    const tookMs = finishedAt - startedAt;
    void this.queue.run(async () => {
      await this.env.storage.runs.patch(this.runId, {
        status: 'failed',
        finishedAt,
        tookMs,
        error,
        ...(nodeId ? { currentNodeId: nodeId } : {}),
      });
      await this.env.events.append({
        runId: this.runId,
        type: 'run.failed',
        error,
        ...(nodeId ? { nodeId } : {}),
      } as RunEventInput);
    });

    // Log final error to overlay
    if (this.config.tabId) {
      void logOverlay.error(this.config.tabId, `Run failed: ${error.message}`).catch(() => { });
    }

    return { runId: this.runId, status: 'failed', tookMs, error };
  }

  private async finishCanceled(startedAt: number): Promise<RunResult> {
    const tookMs = this.env.now() - startedAt;
    await this.queue.run(async () => {
      await this.env.storage.runs.patch(this.runId, {
        status: 'canceled',
        finishedAt: this.env.now(),
        tookMs,
      });
      await this.env.events.append({
        runId: this.runId,
        type: 'run.canceled',
        ...(this.cancelReason ? { reason: this.cancelReason } : {}),
      } as RunEventInput);
    });

    // Log cancellation to overlay
    if (this.config.tabId) {
      void logOverlay.warning(this.config.tabId, 'Run canceled').catch(() => { });
    }

    return { runId: this.runId, status: 'canceled', tookMs };
  }
}
