/**
 * @fileoverview DAG Traversal and Validation
 * @description Provides validation, traversal, and next-node lookup functions for Flow DAG
 */

import type { NodeId, EdgeLabel } from '../../domain/ids';
import type { Flow, Edge } from '../../domain/flow';
import { EDGE_LABELS } from '../../domain/ids';
import { RR_ERROR_CODES, createRRError, type RRError } from '../../domain/errors';

/**
 * DAG Validation Result
 */
export type ValidateFlowDAGResult = { ok: true } | { ok: false; errors: RRError[] };

/**
 * Validate Flow DAG Structure
 * @param flow Flow Definition
 * @returns Validation Result
 */
export function validateFlowDAG(flow: Flow): ValidateFlowDAGResult {
  const errors: RRError[] = [];
  const nodeIds = new Set(flow.nodes.map((n) => n.id));

  // Check if entryNodeId exists
  if (!nodeIds.has(flow.entryNodeId)) {
    errors.push(
      createRRError(
        RR_ERROR_CODES.DAG_INVALID,
        `Entry node "${flow.entryNodeId}" does not exist in flow`,
      ),
    );
  }

  // Check if referenced nodes exist
  for (const edge of flow.edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(
        createRRError(
          RR_ERROR_CODES.DAG_INVALID,
          `Edge "${edge.id}" references non-existent source node "${edge.from}"`,
        ),
      );
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(
        createRRError(
          RR_ERROR_CODES.DAG_INVALID,
          `Edge "${edge.id}" references non-existent target node "${edge.to}"`,
        ),
      );
    }
  }

  // Check for cycles
  const cycle = detectCycle(flow);
  if (cycle) {
    errors.push(
      createRRError(RR_ERROR_CODES.DAG_CYCLE, `Cycle detected in flow: ${cycle.join(' -> ')}`),
    );
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

/**
 * Detect Cycle in DAG
 * @param flow Flow Definition
 * @returns Cycle path (if exists) or null
 */
export function detectCycle(flow: Flow): NodeId[] | null {
  const adjacency = buildAdjacencyMap(flow);
  const visited = new Set<NodeId>();
  const recursionStack = new Set<NodeId>();
  const path: NodeId[] = [];

  function dfs(nodeId: NodeId): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        // Cycle found
        const cycleStart = path.indexOf(neighbor);
        path.push(neighbor); // Close the cycle
        path.splice(0, cycleStart); // Remove nodes before cycle
        return true;
      }
    }

    path.pop();
    recursionStack.delete(nodeId);
    return false;
  }

  for (const node of flow.nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) {
        return path;
      }
    }
  }

  return null;
}

/**
 * Find Next Node
 * @param flow Flow Definition
 * @param currentNodeId Current Node ID
 * @param label Edge Label (optional, defaults to default)
 * @returns Next Node ID or null (if no subsequent node)
 */
export function findNextNode(
  flow: Flow,
  currentNodeId: NodeId,
  label?: EdgeLabel,
): NodeId | null {
  const outEdges = flow.edges.filter((e) => e.from === currentNodeId);

  if (outEdges.length === 0) {
    return null;
  }

  // If label specified, match priority
  if (label) {
    const matchedEdge = outEdges.find((e) => e.label === label);
    if (matchedEdge) {
      return matchedEdge.to;
    }
  }

  // Otherwise use default edge
  const defaultEdge = outEdges.find(
    (e) => e.label === EDGE_LABELS.DEFAULT || e.label === undefined,
  );
  if (defaultEdge) {
    return defaultEdge.to;
  }

  // If only one edge, use it
  if (outEdges.length === 1) {
    return outEdges[0].to;
  }

  return null;
}

/**
 * Find Edge by Label
 */
export function findEdgeByLabel(
  flow: Flow,
  fromNodeId: NodeId,
  label: EdgeLabel,
): Edge | undefined {
  return flow.edges.find((e) => e.from === fromNodeId && e.label === label);
}

/**
 * Get all outgoing edges of a node
 */
export function getOutEdges(flow: Flow, nodeId: NodeId): Edge[] {
  return flow.edges.filter((e) => e.from === nodeId);
}

/**
 * Get all incoming edges of a node
 */
export function getInEdges(flow: Flow, nodeId: NodeId): Edge[] {
  return flow.edges.filter((e) => e.to === nodeId);
}

/**
 * Build Adjacency Map
 */
function buildAdjacencyMap(flow: Flow): Map<NodeId, NodeId[]> {
  const map = new Map<NodeId, NodeId[]>();

  for (const node of flow.nodes) {
    map.set(node.id, []);
  }

  for (const edge of flow.edges) {
    const neighbors = map.get(edge.from);
    if (neighbors) {
      neighbors.push(edge.to);
    }
  }

  return map;
}

/**
 * Get all nodes reachable from entry node
 */
export function getReachableNodes(flow: Flow): Set<NodeId> {
  const reachable = new Set<NodeId>();
  const adjacency = buildAdjacencyMap(flow);

  function dfs(nodeId: NodeId): void {
    if (reachable.has(nodeId)) return;
    reachable.add(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      dfs(neighbor);
    }
  }

  dfs(flow.entryNodeId);
  return reachable;
}

/**
 * Check if node is reachable
 */
export function isNodeReachable(flow: Flow, nodeId: NodeId): boolean {
  return getReachableNodes(flow).has(nodeId);
}
