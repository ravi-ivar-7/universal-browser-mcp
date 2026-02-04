/**
 * @fileoverview Plugin Registry
 * @description Manages registration and retrieval of Node and Trigger plugins
 */

import type { NodeKind } from '../../domain/flow';
import type { TriggerKind } from '../../domain/triggers';
import { RR_ERROR_CODES, createRRError } from '../../domain/errors';
import type {
  NodeDefinition,
  TriggerDefinition,
  PluginRegistrationContext,
  RRPlugin,
} from './types';

/**
 * Plugin Registry
 * @description Singleton pattern, manages all registered nodes and triggers
 */
export class PluginRegistry implements PluginRegistrationContext {
  private nodes = new Map<NodeKind, NodeDefinition>();
  private triggers = new Map<TriggerKind, TriggerDefinition>();

  /**
   * Register Node Definition
   * @description Overwrites if node with same kind already exists
   */
  registerNode(def: NodeDefinition): void {
    this.nodes.set(def.kind, def);
  }

  /**
   * Register Trigger Definition
   * @description Overwrites if trigger with same kind already exists
   */
  registerTrigger(def: TriggerDefinition): void {
    this.triggers.set(def.kind, def);
  }

  /**
   * Get Node Definition
   * @returns Node definition or undefined
   */
  getNode(kind: NodeKind): NodeDefinition | undefined {
    return this.nodes.get(kind);
  }

  /**
   * Get Node Definition (Must Exist)
   * @throws RRError if node is not registered
   */
  getNodeOrThrow(kind: NodeKind): NodeDefinition {
    const def = this.nodes.get(kind);
    if (!def) {
      throw createRRError(RR_ERROR_CODES.UNSUPPORTED_NODE, `Node kind "${kind}" is not registered`);
    }
    return def;
  }

  /**
   * Get Trigger Definition
   * @returns Trigger definition or undefined
   */
  getTrigger(kind: TriggerKind): TriggerDefinition | undefined {
    return this.triggers.get(kind);
  }

  /**
   * Get Trigger Definition (Must Exist)
   * @throws RRError if trigger is not registered
   */
  getTriggerOrThrow(kind: TriggerKind): TriggerDefinition {
    const def = this.triggers.get(kind);
    if (!def) {
      throw createRRError(
        RR_ERROR_CODES.UNSUPPORTED_NODE,
        `Trigger kind "${kind}" is not registered`,
      );
    }
    return def;
  }

  /**
   * Check if node is registered
   */
  hasNode(kind: NodeKind): boolean {
    return this.nodes.has(kind);
  }

  /**
   * Check if trigger is registered
   */
  hasTrigger(kind: TriggerKind): boolean {
    return this.triggers.has(kind);
  }

  /**
   * Get all registered node kinds
   */
  listNodeKinds(): NodeKind[] {
    return Array.from(this.nodes.keys());
  }

  /**
   * Get all registered trigger kinds
   */
  listTriggerKinds(): TriggerKind[] {
    return Array.from(this.triggers.keys());
  }

  /**
   * Register Plugin
   * @description Calls the plugin's register method
   */
  registerPlugin(plugin: RRPlugin): void {
    plugin.register(this);
  }

  /**
   * Batch Register Plugins
   */
  registerPlugins(plugins: RRPlugin[]): void {
    for (const plugin of plugins) {
      this.registerPlugin(plugin);
    }
  }

  /**
   * Clear all registrations
   * @description Primarily for testing
   */
  clear(): void {
    this.nodes.clear();
    this.triggers.clear();
  }
}

/** Global Plugin Registry Instance */
let globalRegistry: PluginRegistry | null = null;

/**
 * Get Global Plugin Registry
 */
export function getPluginRegistry(): PluginRegistry {
  if (!globalRegistry) {
    globalRegistry = new PluginRegistry();
  }
  return globalRegistry;
}

/**
 * Reset Global Plugin Registry
 * @description Primarily for testing
 */
export function resetPluginRegistry(): void {
  globalRegistry = null;
}
