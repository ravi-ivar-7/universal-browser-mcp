/**
 * @fileoverview Flow type definitions
 * @description Defines the Flow IR (Intermediate Representation) for Record-Replay
 */

import type { ISODateTimeString, JsonObject } from './json';
import type { EdgeId, EdgeLabel, FlowId, NodeId } from './ids';
import type { FlowPolicy, NodePolicy } from './policy';
import type { VariableDefinition } from './variables';

/** Flow schema version */
export const FLOW_SCHEMA_VERSION = 3 as const;

/**
 * Edge V3
 * @description Edge in DAG, connects two nodes
 */
export interface EdgeV3 {
  /** Edge unique identifier */
  id: EdgeId;
  /** Source node ID */
  from: NodeId;
  /** Target node ID */
  to: NodeId;
  /** Edge label (for conditional branching and error handling) */
  label?: EdgeLabel;
}

/** Node type (extensible) */
export type NodeKind = string;

/**
 * Node V3
 * @description Node in DAG, represents an executable operation
 */
export interface NodeV3 {
  /** Node unique identifier */
  id: NodeId;
  /** Node type */
  kind: NodeKind;
  /** Node name (for display) */
  name?: string;
  /** Whether disabled */
  disabled?: boolean;
  /** Node-level policy */
  policy?: NodePolicy;
  /** Node configuration (type determined by kind) */
  config: JsonObject;
  /** UI layout information */
  ui?: { x: number; y: number };
}

/**
 * Flow metadata binding
 * @description Defines Flow association with specific domains/paths/URLs
 */
export interface FlowBinding {
  kind: 'domain' | 'path' | 'url';
  value: string;
}

/**
 * Flow V3
 * @description Complete Flow definition including nodes, edges, and configuration
 */
export interface FlowV3 {
  /** Schema version */
  schemaVersion: typeof FLOW_SCHEMA_VERSION;
  /** Flow unique identifier */
  id: FlowId;
  /** Flow name */
  name: string;
  /** Flow description */
  description?: string;
  /** Creation time */
  createdAt: ISODateTimeString;
  /** Update time */
  updatedAt: ISODateTimeString;

  /** Entry node ID (explicitly specified, independent of in-degree inference) */
  entryNodeId: NodeId;
  /** Node list */
  nodes: NodeV3[];
  /** Edge list */
  edges: EdgeV3[];

  /** Variable definitions */
  variables?: VariableDefinition[];
  /** Flow-level policy */
  policy?: FlowPolicy;
  /** Metadata */
  meta?: {
    /** Tags */
    tags?: string[];
    /** Binding rules */
    bindings?: FlowBinding[];
    /** Associated domain (for UI display) */
    domain?: string;
  };
}

/**
 * Find node by ID
 */
export function findNodeById(flow: FlowV3, nodeId: NodeId): NodeV3 | undefined {
  return flow.nodes.find((n) => n.id === nodeId);
}

/**
 * Find all edges from specified node
 */
export function findEdgesFrom(flow: FlowV3, nodeId: NodeId): EdgeV3[] {
  return flow.edges.filter((e) => e.from === nodeId);
}

/**
 * Find all edges to specified node
 */
export function findEdgesTo(flow: FlowV3, nodeId: NodeId): EdgeV3[] {
  return flow.edges.filter((e) => e.to === nodeId);
}
