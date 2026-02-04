/**
 * @fileoverview Register Action handlers as RR nodes
 * @description
 * Batch registration of Action handlers into the PluginRegistry.
 * This enables the runner to execute flows that use these action types.
 */

import { createReplayActionRegistry } from '../actions/handlers';
import type {
  ActionHandler,
  ExecutableActionType,
} from '../actions/types';

import type { PluginRegistry } from './registry';
import {
  adaptActionHandlerToNodeDefinition,
  type ActionNodeBridgeOptions,
} from './action-node-bridge';

export interface RegisterActionNodesOptions extends ActionNodeBridgeOptions {
  /**
   * Only include these action types. If not specified, all handlers are included.
   */
  include?: ReadonlyArray<string>;

  /**
   * Exclude these action types. Applied after include filter.
   */
  exclude?: ReadonlyArray<string>;
}

/**
 * Register action handlers as node definitions.
 *
 * @param registry The PluginRegistry to register nodes into
 * @param options Configuration options
 * @returns Array of registered node kinds
 *
 * @example
 * ```ts
 * const plugins = new PluginRegistry();
 * const registered = registerActionNodes(plugins, {
 *   // Exclude control flow handlers that runner doesn't support
 *   exclude: ['foreach', 'while'],
 * });
 * console.log('Registered:', registered);
 * ```
 */
export function registerActionNodes(
  registry: PluginRegistry,
  options: RegisterActionNodesOptions = {},
): string[] {
  const actionRegistry = createReplayActionRegistry();
  const handlers = actionRegistry.list();

  const include = options.include ? new Set(options.include) : null;
  const exclude = options.exclude ? new Set(options.exclude) : null;

  const registered: string[] = [];

  for (const handler of handlers) {
    if (include && !include.has(handler.type)) continue;
    if (exclude && exclude.has(handler.type)) continue;

    // Cast needed because handler types don't perfectly align with NodeKind
    const nodeDef = adaptActionHandlerToNodeDefinition(
      handler as ActionHandler<ExecutableActionType>,
      options,
    );
    registry.registerNode(nodeDef as unknown as Parameters<typeof registry.registerNode>[0]);
    registered.push(handler.type);
  }

  return registered;
}

/**
 * Get list of action types that can be registered.
 * Useful for debugging and documentation.
 */
export function listActionTypes(): string[] {
  const actionRegistry = createReplayActionRegistry();
  return actionRegistry.list().map((h) => h.type);
}

/**
 * Default exclude list for registration.
 * These handlers rely on control directives that runner doesn't support.
 */
export const DEFAULT_EXCLUDE_LIST = ['foreach', 'while'] as const;
