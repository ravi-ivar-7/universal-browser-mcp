import type { Step } from '../core/recording-types';
import type { FlowV3, NodeV3, EdgeV3 } from '../domain/flow';
import type { VariableDefinition } from '../domain/variables';
import { FLOW_SCHEMA_VERSION } from '../domain/flow';
import { TOOL_MESSAGE_TYPES } from '@/common/message-types';
import { NODE_TYPES } from '@/common/node-types';
import { mapStepToNodeConfig, EDGE_LABELS } from 'chrome-mcp-shared';

/**
 * Recording status state machine:
 * - idle: No active recording
 * - recording: Actively capturing user interactions
 * - paused: Temporarily paused (UI can resume)
 * - stopping: Draining final steps from content scripts before save
 */
export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopping';

export interface RecordingSessionState {
  sessionId: string;
  status: RecordingStatus;
  originTabId: number | null;
  flow: FlowV3 | null;
  // Track tabs that have participated in this recording session
  activeTabs: Set<number>;
  // Track which tabs have acknowledged stop command
  stoppedTabs: Set<number>;
}

// Valid node types for type checking
const VALID_NODE_TYPES = new Set<string>(Object.values(NODE_TYPES));

export class RecordingSessionManager {
  private state: RecordingSessionState = {
    sessionId: '',
    status: 'idle',
    originTabId: null,
    flow: null,
    activeTabs: new Set<number>(),
    stoppedTabs: new Set<number>(),
  };

  // Session-level cache for incremental DAG sync
  private nodeIndexMap: Map<string, number> = new Map();
  // Monotonic counter for edge id generation
  private edgeSeq: number = 0;

  getStatus(): RecordingStatus {
    return this.state.status;
  }

  getSession(): Readonly<RecordingSessionState> {
    return this.state;
  }

  getFlow(): FlowV3 | null {
    return this.state.flow;
  }

  getOriginTabId(): number | null {
    return this.state.originTabId;
  }

  addActiveTab(tabId: number): void {
    if (typeof tabId === 'number') this.state.activeTabs.add(tabId);
  }

  removeActiveTab(tabId: number): void {
    this.state.activeTabs.delete(tabId);
  }

  getActiveTabs(): number[] {
    return Array.from(this.state.activeTabs);
  }

  async startSession(flow: FlowV3, originTabId: number): Promise<void> {
    // Clear cache for fresh session
    this.nodeIndexMap.clear();
    this.edgeSeq = 0;

    this.state = {
      sessionId: `sess_${Date.now()}`,
      status: 'recording',
      originTabId,
      flow,
      activeTabs: new Set<number>([originTabId]),
      stoppedTabs: new Set<number>(),
    };

    // Initialize caches from existing flow data
    this.rebuildCaches();
  }

  beginStopping(): string {
    if (this.state.status === 'idle') return '';
    this.state.status = 'stopping';
    this.state.stoppedTabs.clear();
    return this.state.sessionId;
  }

  markTabStopped(tabId: number): boolean {
    this.state.stoppedTabs.add(tabId);
    for (const activeTabId of this.state.activeTabs) {
      if (!this.state.stoppedTabs.has(activeTabId)) {
        return false;
      }
    }
    return true;
  }

  isStopping(): boolean {
    return this.state.status === 'stopping';
  }

  canAcceptSteps(): boolean {
    return this.state.status === 'recording' || this.state.status === 'stopping';
  }

  pause(): void {
    if (this.state.status === 'recording') {
      this.state.status = 'paused';
    }
  }

  resume(): void {
    if (this.state.status === 'paused') {
      this.state.status = 'recording';
    }
  }

  async stopSession(): Promise<FlowV3 | null> {
    const flow = this.state.flow;
    this.state.status = 'idle';
    this.state.flow = null;
    this.state.originTabId = null;
    this.state.activeTabs.clear();
    this.state.stoppedTabs.clear();
    this.nodeIndexMap.clear();
    this.edgeSeq = 0;
    return flow;
  }

  updateFlow(mutator: (f: FlowV3) => void): void {
    const f = this.state.flow;
    if (!f) return;
    mutator(f);
    try {
      f.updatedAt = new Date().toISOString();
    } catch (e) {
      // ignore meta update errors
    }
  }

  appendSteps(steps: Step[]): void {
    const f = this.state.flow;
    if (!f || !Array.isArray(steps) || steps.length === 0) return;

    if (!Array.isArray(f.nodes)) f.nodes = [];
    if (!Array.isArray(f.edges)) f.edges = [];

    const nodes = f.nodes;
    const edges = f.edges;

    // Check invariants
    if (!this.checkDagInvariant(nodes, edges)) {
      this.rechainEdges();
    }

    let needsRebuild = false;
    for (const step of steps) {
      if (!step.id) {
        step.id = `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      }

      const nodeIdx = this.nodeIndexMap.get(step.id);
      if (nodeIdx !== undefined) {
        if (!nodes[nodeIdx]) {
          needsRebuild = true;
          continue;
        }
        nodes[nodeIdx] = {
          ...nodes[nodeIdx],
          kind: this.toNodeKind(step.type),
          config: mapStepToNodeConfig(step) as any,
        };
      } else {
        const prevNodeId = nodes.length > 0 ? nodes[nodes.length - 1]?.id : undefined;

        const newNode: NodeV3 = {
          id: step.id,
          kind: this.toNodeKind(step.type),
          config: mapStepToNodeConfig(step) as any,
        };
        nodes.push(newNode);
        this.nodeIndexMap.set(step.id, nodes.length - 1);

        // Auto-set entryNodeId if not set
        if (!f.entryNodeId) {
          f.entryNodeId = newNode.id;
        }

        if (prevNodeId) {
          if (!this.nodeIndexMap.has(prevNodeId)) {
            needsRebuild = true;
            continue;
          }
          const edgeId = `e_${this.edgeSeq++}_${prevNodeId}_${step.id}`;
          edges.push({
            id: edgeId,
            from: prevNodeId,
            to: step.id,
            label: EDGE_LABELS.DEFAULT,
          });
        }
      }
    }

    if (needsRebuild || !this.checkDagInvariant(nodes, edges)) {
      this.rechainEdges();
    }

    try {
      f.updatedAt = new Date().toISOString();
    } catch {
      // ignore meta update errors
    }

    this.broadcastTimelineUpdate();
  }

  private toNodeKind(stepType: string): string {
    if (VALID_NODE_TYPES.has(stepType)) {
      return stepType;
    }
    console.warn(`[RecordingSession] Unknown step type "${stepType}", falling back to "script"`);
    return NODE_TYPES.SCRIPT;
  }

  private checkDagInvariant(nodes: NodeV3[], edges: EdgeV3[]): boolean {
    const nodeCount = nodes.length;
    const expectedEdgeCount = Math.max(0, nodeCount - 1);

    if (edges.length !== expectedEdgeCount) {
      return false;
    }

    if (edges.length > 0 && nodes.length > 0) {
      const lastEdge = edges[edges.length - 1];
      const lastNodeId = nodes[nodes.length - 1]?.id;
      if (lastEdge.to !== lastNodeId) {
        return false;
      }
    }

    return true;
  }

  private rebuildCaches(): void {
    const f = this.state.flow;
    if (!f) return;

    this.nodeIndexMap.clear();

    if (Array.isArray(f.nodes)) {
      for (let i = 0; i < f.nodes.length; i++) {
        const id = f.nodes[i]?.id;
        if (id) this.nodeIndexMap.set(id, i);
      }
    }

    this.edgeSeq = Array.isArray(f.edges) ? f.edges.length : 0;
  }

  private rechainEdges(): void {
    const f = this.state.flow;
    if (!f) return;

    if (!Array.isArray(f.nodes)) f.nodes = [];
    if (!Array.isArray(f.edges)) f.edges = [];

    f.edges.length = 0;
    for (let i = 0; i < f.nodes.length - 1; i++) {
      const from = f.nodes[i].id;
      const to = f.nodes[i + 1].id;
      f.edges.push({
        id: `e_${i}_${from}_${to}`,
        from,
        to,
        label: EDGE_LABELS.DEFAULT,
      });
    }

    this.rebuildCaches();
  }

  appendVariables(variables: VariableDefinition[]): void {
    const f = this.state.flow;
    if (!f || !Array.isArray(variables) || variables.length === 0) return;

    if (!f.variables) {
      f.variables = [];
    }

    const existingNames = new Set(f.variables.map((v) => v.name));
    for (const v of variables) {
      if (!v.name) continue;
      if (existingNames.has(v.name)) {
        const idx = f.variables.findIndex((fv) => fv.name === v.name);
        if (idx >= 0) {
          f.variables[idx] = v;
        }
      } else {
        f.variables.push(v);
        existingNames.add(v.name);
      }
    }

    try {
      f.updatedAt = new Date().toISOString();
    } catch {
      // ignore meta update errors
    }
  }

  private getTimelineSteps(): any[] {
    const f = this.state.flow;
    if (!f) return [];

    if (Array.isArray(f.nodes) && f.nodes.length > 0) {
      return f.nodes.map((n) => {
        const cfg =
          n && typeof n.config === 'object' && n.config != null
            ? (n.config as Record<string, unknown>)
            : {};
        return { ...cfg, id: n.id, type: n.kind };
      });
    }

    return [];
  }

  broadcastTimelineUpdate(): void {
    try {
      const fullSteps = this.getTimelineSteps();
      if (fullSteps.length === 0) return;

      const targets = this.getActiveTabs();
      const list =
        targets && targets.length
          ? targets
          : this.state.originTabId != null
            ? [this.state.originTabId]
            : [];
      for (const tabId of list) {
        chrome.tabs.sendMessage(
          tabId,
          { action: TOOL_MESSAGE_TYPES.RR_TIMELINE_UPDATE, steps: fullSteps },
          { frameId: 0 },
        );
      }
    } catch { }
  }
}

export const recordingSession = new RecordingSessionManager();
