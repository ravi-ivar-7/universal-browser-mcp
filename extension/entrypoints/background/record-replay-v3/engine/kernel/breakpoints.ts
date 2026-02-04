/**
 * @fileoverview Breakpoint Manager
 * @description Manages the addition, removal, and hit detection of debug breakpoints
 */

import type { NodeId, RunId } from '../../domain/ids';
import type { Breakpoint, DebuggerState } from '../../domain/debug';

/**
 * Breakpoint Manager
 * @description Manages breakpoints for a single Run
 */
export class BreakpointManager {
  private breakpoints = new Map<NodeId, Breakpoint>();
  private stepMode: 'none' | 'stepOver' = 'none';

  constructor(initialBreakpoints?: NodeId[]) {
    if (initialBreakpoints) {
      for (const nodeId of initialBreakpoints) {
        this.add(nodeId);
      }
    }
  }

  /**
   * Add Breakpoint
   */
  add(nodeId: NodeId): void {
    this.breakpoints.set(nodeId, { nodeId, enabled: true });
  }

  /**
   * Remove Breakpoint
   */
  remove(nodeId: NodeId): void {
    this.breakpoints.delete(nodeId);
  }

  /**
   * Set Breakpoint List (Replace all existing breakpoints)
   */
  setAll(nodeIds: NodeId[]): void {
    this.breakpoints.clear();
    for (const nodeId of nodeIds) {
      this.add(nodeId);
    }
  }

  /**
   * Enable Breakpoint
   */
  enable(nodeId: NodeId): void {
    const bp = this.breakpoints.get(nodeId);
    if (bp) {
      bp.enabled = true;
    }
  }

  /**
   * Disable Breakpoint
   */
  disable(nodeId: NodeId): void {
    const bp = this.breakpoints.get(nodeId);
    if (bp) {
      bp.enabled = false;
    }
  }

  /**
   * Check if node has an enabled breakpoint
   */
  hasBreakpoint(nodeId: NodeId): boolean {
    const bp = this.breakpoints.get(nodeId);
    return bp?.enabled ?? false;
  }

  /**
   * Check if execution should pause at node
   * @description Considers both breakpoints and step mode
   */
  shouldPauseAt(nodeId: NodeId): boolean {
    // If in step mode, always pause
    if (this.stepMode === 'stepOver') {
      return true;
    }
    // Otherwise check breakpoints
    return this.hasBreakpoint(nodeId);
  }

  /**
   * Get all breakpoints
   */
  getAll(): Breakpoint[] {
    return Array.from(this.breakpoints.values());
  }

  /**
   * Get enabled breakpoints
   */
  getEnabled(): Breakpoint[] {
    return this.getAll().filter((bp) => bp.enabled);
  }

  /**
   * Set step mode
   */
  setStepMode(mode: 'none' | 'stepOver'): void {
    this.stepMode = mode;
  }

  /**
   * Get step mode
   */
  getStepMode(): 'none' | 'stepOver' {
    return this.stepMode;
  }

  /**
   * Clear all breakpoints
   */
  clear(): void {
    this.breakpoints.clear();
    this.stepMode = 'none';
  }
}

/**
 * Breakpoint Registry
 * @description Manages BreakpointManagers for multiple Runs
 */
export class BreakpointRegistry {
  private managers = new Map<RunId, BreakpointManager>();

  /**
   * Get or create BreakpointManager
   */
  getOrCreate(runId: RunId, initialBreakpoints?: NodeId[]): BreakpointManager {
    let manager = this.managers.get(runId);
    if (!manager) {
      manager = new BreakpointManager(initialBreakpoints);
      this.managers.set(runId, manager);
    }
    return manager;
  }

  /**
   * Get BreakpointManager
   */
  get(runId: RunId): BreakpointManager | undefined {
    return this.managers.get(runId);
  }

  /**
   * Remove BreakpointManager
   */
  remove(runId: RunId): void {
    this.managers.delete(runId);
  }

  /**
   * Clear all
   */
  clear(): void {
    this.managers.clear();
  }
}

/** Global Breakpoint Registry */
let globalBreakpointRegistry: BreakpointRegistry | null = null;

/**
 * Get global Breakpoint Registry
 */
export function getBreakpointRegistry(): BreakpointRegistry {
  if (!globalBreakpointRegistry) {
    globalBreakpointRegistry = new BreakpointRegistry();
  }
  return globalBreakpointRegistry;
}

/**
 * Reset global Breakpoint Registry
 * @description Primarily for testing
 */
export function resetBreakpointRegistry(): void {
  globalBreakpointRegistry = null;
}
