/**
 * @fileoverview Plugin Type Definitions
 * @description Defines interfaces for Node and Trigger plugins in Record-Replay V3
 */

import { z } from 'zod';

import type { JsonObject, JsonValue } from '../../domain/json';
import type { FlowId, NodeId, RunId, TriggerId } from '../../domain/ids';
import type { NodeKind } from '../../domain/flow';
import type { RRError } from '../../domain/errors';
import type { NodePolicy } from '../../domain/policy';
import type { FlowV3, NodeV3 } from '../../domain/flow';
import type { TriggerKind } from '../../domain/triggers';

/**
 * Schema Type
 * @description Use Zod for configuration validation
 */
export type Schema<T> = z.ZodType<T, z.ZodTypeDef, unknown>;

/**
 * Node Execution Context
 * @description Runtime context provided to node executors
 */
export interface NodeExecutionContext {
  /** Run ID */
  runId: RunId;
  /** Flow Definition (Snapshot) */
  flow: FlowV3;
  /** Current Node ID */
  nodeId: NodeId;

  /** Bound Tab ID (Exclusive per Run) */
  tabId: number;
  /** Frame ID (Default 0 for main frame) */
  frameId?: number;

  /** Current Variables Table */
  vars: Record<string, JsonValue>;

  /**
   * Logging
   */
  log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: JsonValue) => void;

  /**
   * Choose Next Edge
   * @description Used for conditional branch nodes
   */
  chooseNext: (label: string) => { kind: 'edgeLabel'; label: string };

  /**
   * Artifact Operations
   */
  artifacts: {
    /** Capture current page screenshot */
    screenshot: () => Promise<{ ok: true; base64: string } | { ok: false; error: RRError }>;
  };

  /**
   * Persistent Variable Operations
   */
  persistent: {
    /** Get persistent variable */
    get: (name: `$${string}`) => Promise<JsonValue | undefined>;
    /** Set persistent variable */
    set: (name: `$${string}`, value: JsonValue) => Promise<void>;
    /** Delete persistent variable */
    delete: (name: `$${string}`) => Promise<void>;
  };
}

/**
 * Variable Patch Operation
 */
export interface VarsPatchOp {
  op: 'set' | 'delete';
  name: string;
  value?: JsonValue;
}

/**
 * Node Execution Result
 */
export type NodeExecutionResult =
  | {
    status: 'succeeded';
    /** Next Step Direction */
    next?: { kind: 'edgeLabel'; label: string } | { kind: 'end' };
    /** Output Results */
    outputs?: JsonObject;
    /** Variable Changes */
    varsPatch?: VarsPatchOp[];
  }
  | { status: 'failed'; error: RRError };

/**
 * Node Definition
 * @description Defines the execution logic for a node kind
 */
export interface NodeDefinition<
  TKind extends NodeKind = NodeKind,
  TConfig extends JsonObject = JsonObject,
> {
  /** Node Kind Identifier */
  kind: TKind;
  /** Config Validation Schema */
  schema: Schema<TConfig>;
  /** Default Policy */
  defaultPolicy?: NodePolicy;
  /**
   * Execute Node
   * @param ctx Execution Context
   * @param node Node Definition (including config)
   */
  execute(
    ctx: NodeExecutionContext,
    node: NodeV3 & { kind: TKind; config: TConfig },
  ): Promise<NodeExecutionResult>;
}

/**
 * Trigger Install Context
 */
export interface TriggerInstallContext<
  TKind extends TriggerKind = TriggerKind,
  TConfig extends JsonObject = JsonObject,
> {
  /** Trigger ID */
  triggerId: TriggerId;
  /** Trigger Kind */
  kind: TKind;
  /** Enabled Flag */
  enabled: boolean;
  /** Linked Flow ID */
  flowId: FlowId;
  /** Trigger Config */
  config: TConfig;
  /** Arguments passed to Flow */
  args?: JsonObject;
}

/**
 * Trigger Definition
 * @description Defines the install and uninstall logic for a trigger kind
 */
export interface TriggerDefinition<
  TKind extends TriggerKind = TriggerKind,
  TConfig extends JsonObject = JsonObject,
> {
  /** Trigger Kind Identifier */
  kind: TKind;
  /** Config Validation Schema */
  schema: Schema<TConfig>;
  /** Install Trigger */
  install(ctx: TriggerInstallContext<TKind, TConfig>): Promise<void> | void;
  /** Uninstall Trigger */
  uninstall(ctx: TriggerInstallContext<TKind, TConfig>): Promise<void> | void;
}

/**
 * Plugin Registration Context
 */
export interface PluginRegistrationContext {
  /** Register Node Definition */
  registerNode(def: NodeDefinition): void;
  /** Register Trigger Definition */
  registerTrigger(def: TriggerDefinition): void;
}

/**
 * Plugin Interface
 * @description Standard interface for Record-Replay plugins
 */
export interface RRPlugin {
  /** Plugin Name */
  name: string;
  /** Register Plugin Content */
  register(ctx: PluginRegistrationContext): void;
}
