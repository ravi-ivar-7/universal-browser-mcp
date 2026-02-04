import type { Step } from '../core/recording-types';
import type { Flow, Node, Edge } from '../domain/flow';
import { FLOW_SCHEMA_VERSION } from '../domain/flow';
import { STEP_TYPES } from '@/common/step-types';
import { recordingSession } from './session-manager';
import { mapStepToNodeConfig, EDGE_LABELS } from 'chrome-mcp-shared';

/**
 * Creates an initial flow structure for recording in V3 format.
 */
export function createInitialFlow(meta?: Partial<Flow>): Flow {
  const timeStamp = new Date().toISOString();
  return {
    schemaVersion: FLOW_SCHEMA_VERSION,
    id: meta?.id || `flow_${Date.now()}`,
    name: meta?.name || 'New Recording',
    description: meta?.description || '',
    createdAt: timeStamp,
    updatedAt: timeStamp,
    entryNodeId: '', // Will be set when first node is added
    nodes: [],
    edges: [],
    variables: [],
    ...meta,
  };
}

export function generateStepId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Appends a navigation step to the flow.
 */
export function addNavigationStep(flow: Flow, url: string): void {
  const step: Step = { id: generateStepId(), type: STEP_TYPES.NAVIGATE, url } as Step;

  if (recordingSession.getStatus() === 'recording' && recordingSession.getFlow() === flow) {
    recordingSession.appendSteps([step]);
    return;
  }

  appendNodeToFlow(flow, step);
}

/**
 * Appends a step as a node to the flow's V3 structure.
 */
function appendNodeToFlow(flow: Flow, step: Step): void {
  if (!Array.isArray(flow.nodes)) flow.nodes = [];
  if (!Array.isArray(flow.edges)) flow.edges = [];

  const prevNodeId = flow.nodes.length > 0 ? flow.nodes[flow.nodes.length - 1]?.id : undefined;

  const newNode: Node = {
    id: step.id,
    kind: step.type,
    config: mapStepToNodeConfig(step) as any,
  };
  flow.nodes.push(newNode);

  if (!flow.entryNodeId) {
    flow.entryNodeId = newNode.id;
  }

  if (prevNodeId) {
    const edgeId = `e_${flow.edges.length}_${prevNodeId}_${step.id}`;
    const edge: Edge = {
      id: edgeId,
      from: prevNodeId,
      to: step.id,
      label: EDGE_LABELS.DEFAULT,
    };
    flow.edges.push(edge);
  }

  try {
    flow.updatedAt = new Date().toISOString();
  } catch {
    // ignore meta update errors
  }
}
