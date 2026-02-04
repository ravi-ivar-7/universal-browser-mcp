# Legacy Code Removal Plan: Step & Action Layers

## Executive Summary

Your Record & Replay codebase has **THREE execution layers** stacked for backward compatibility:

1. **Step** (Oldest) - Recording format
2. **Action** (Middle) - Execution handlers  
3. **Node** (Current) - Flow engine

To remove legacy code, you need to **eliminate or consolidate** Step and Action layers.

---

## Current Architecture

### Data Flow

```
Recording Phase:
Browser Events → Recorder → Step[] → mapStepToNodeConfig → Node[] + Edge[]
                                                              ↓
                                                        Storage (Flow)

Replay Phase:
Storage → Load Flow (Node[] + Edge[])
                ↓
        PluginRegistry.getNode(kind)
                ↓
        NodeDefinition (adapted from ActionHandler)
                ↓
        ActionHandler.run()
                ↓
        Execute in browser
```

### Critical Files Using Legacy Systems

#### **STEP System** (7 files)
| File | Purpose | Uses Steps |
|:-----|:--------|:-----------|
| [core/recording-types.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/core/recording-types.ts) | Type definitions | ✅ Defines |
| [core/types.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/core/types.ts) | Type exports | ✅ Re-exports |
| [core/rr-utils.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/core/rr-utils.ts) | Utilities | ✅ Uses |
| [recording/browser-event-listener.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/recording/browser-event-listener.ts) | Event capture | ✅ Creates |
| [recording/session-manager.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/recording/session-manager.ts) | Session state | ✅ Consumes |
| [recording/flow-builder.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/recording/flow-builder.ts) | Flow creation | ✅ Converts |
| [recording/content-message-handler.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/recording/content-message-handler.ts) | IPC | ✅ Transports |

#### **ACTION System** (24 files)
| Directory | File Count | Purpose |
|:----------|:-----------|:--------|
| `engine/actions/` | 22 files | ActionRegistry, handlers, types |
| `engine/plugins/` | 2 files | action-node-bridge.ts, register-action-nodes.ts |

#### **Current NODE System** (Active)
- [domain/flow.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/domain/flow.ts) - Flow/Node/Edge types
- [engine/plugins/registry.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/engine/plugins/registry.ts) - PluginRegistry
- [engine/kernel/runner.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/engine/kernel/runner.ts) - RunRunner (executes Nodes via PluginRegistry)
- [bootstrap.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/bootstrap.ts) - Wires everything together

---

## What Can Be Removed?

###  Option 1: **Minimal Removal** (Safest)
**Remove**: [engine/actions/adapter.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/engine/actions/adapter.ts) only  
**Reason**: Not used by current Node execution path  
**Impact**: Low risk

### Option 2: **Partial Consolidation** (Recommended)
**Remove**: Step layer entirely  
**Keep**: Action layer as internal execution primitives  
**Changes Needed**:
1. Recorder outputs Nodes directly (not Steps)
2. Remove `mapStepToNodeConfig` dependency
3. Delete [core/recording-types.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/core/recording-types.ts) and Step references

### Option 3: **Full Modernization** (High Risk)
**Remove**: Both Step and Action layers  
**Strategy**: Direct Node execution without ActionHandlers  
**Massive refactor** - not recommended unless rearchitecting

---

## Recommended Approach: Option 2

### Phase 1: Recording Modernization

#### 1.1 Update Recorder to Output Nodes Directly

**Current**: Recorder creates [Step](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/core/recording-types.ts#228-253) objects  
**New**: Recorder creates [Node](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/domain/flow.ts#36-52) objects

**Files to modify**:
- [recording/browser-event-listener.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/recording/browser-event-listener.ts) 
  - Change event handlers to create Nodes, not Steps
  - Use Node kind + config instead of Step type + params

**Example transformation**:
```typescript
// BEFORE (Step)
const step: Step = {
  id: generateId(),
  type: 'click',
  target: { candidates: [...] }
};

// AFTER (Node)
const node: Node = {
  id: generateId(),
  kind: 'click',
  config: {
    target: { candidates: [...] }
  }
};
```

#### 1.2 Remove mapStepToNodeConfig Dependency

**Current**: `mapStepToNodeConfig` (from shared package) converts Step → Node.config  
**New**: Recorder directly creates proper Node.config

**Files using mapStepToNodeConfig**:
- [recording/flow-builder.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/recording/flow-builder.ts) ✅ Remove
- [recording/session-manager.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/recording/session-manager.ts) ✅ Remove

#### 1.3 Delete Step Type System

**Files to delete**:
```
core/recording-types.ts          # Step type definitions
```

**Files to update** (remove Step imports/exports):
```
core/types.ts                    # Stop re-exporting Step types
core/rr-utils.ts                 # Remove Step utilities
recording/session-manager.ts     # Use Node instead of Step
recording/flow-builder.ts        # Use Node instead of Step
recording/content-message-handler.ts  # Transport Nodes instead
```

### Phase 2: Simplify Action Bridge

#### 2.1 Keep ActionHandlers but Simplify

**Current**: 3-layer conversion (Step → Action → Node)  
**New**: 2-layer conversion (Node → Action)

Since [action-node-bridge.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/engine/plugins/action-node-bridge.ts) already converts Action → Node, and Nodes are the storage format, you don't need Step → Action conversion anymore.

**Files to keep** (still useful):
```
engine/actions/
├── types.ts                      # Action type system
├── registry.ts                   # ActionRegistry
├── handlers/                     # All 19 handler files
└── index.ts                      # Handler exports

engine/plugins/
├── action-node-bridge.ts         # Keeps Actions working in Node engine
├── register-action-nodes.ts      # Registers ActionHandlers as NodeDefinitions
└── registry.ts                   # PluginRegistry
```

**Files to delete**:
```
engine/actions/adapter.ts         # No longer needed (Step→Action conversion)
```

### Phase 3: Update Shared Package

#### 3.1 Remove mapStepToNodeConfig

This function is in `chrome-mcp-shared` package.

**Location**: [shared/src/rr-graph.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/shared/src/rr-graph.ts)

Either:
- Delete the function entirely
- Keep as deprecated for external consumers

#### 3.2 Update Exports

Remove Step-related exports from shared package if no longer needed by other consumers (desktop app, etc.).

---

## Migration Checklist

### **Pre-Migration**
- [ ] Audit all existing flows in storage - do they use Step format?
- [ ] Check if desktop app or other consumers depend on Steps
- [ ] Backup production data

### **Phase 1: Recording**
- [ ] Update [browser-event-listener.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/recording/browser-event-listener.ts) to create Nodes
- [ ] Update [flow-builder.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/recording/flow-builder.ts) - remove mapStepToNodeConfig
- [ ] Update [session-manager.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/recording/session-manager.ts) - remove Step references
- [ ] Update [content-message-handler.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/recording/content-message-handler.ts) - transport Nodes
- [ ] Remove [core/recording-types.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/core/recording-types.ts)
- [ ] Update [core/types.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/core/types.ts) - remove Step exports

### **Phase 2: Simplify Actions**
- [ ] Delete [engine/actions/adapter.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/engine/actions/adapter.ts)
- [ ] Verify [action-node-bridge.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/engine/plugins/action-node-bridge.ts) still works
- [ ] Verify [register-action-nodes.ts](file:///home/ravi/Desktop/Auto%20Job%20Apply/universal-browser-mcp/extension/entrypoints/background/record-replay/engine/plugins/register-action-nodes.ts) still works

### **Phase 3: Shared Package**
- [ ] Remove `mapStepToNodeConfig` from shared package
- [ ] Update shared package version
- [ ] Update extension dependency

### **Testing**
- [ ] Test new recordings create valid Flows
- [ ] Test replay works for new recordings
- [ ] Test existing flows still replay (if supporting backward compat)
- [ ] Test all action types (click, fill, navigate, etc.)

---

## Risks & Mitigation

### Risk 1: Breaking Existing Recordings
**Impact**: Users' saved flows become unplayable  
**Mitigation**:
- Keep backward compatibility: Detect if Flow has old format, auto-migrate on load
- Or: Require users to re-record (breaking change)

### Risk 2: Shared Package Consumers
**Impact**: Desktop app or other tools break if they depend on Steps  
**Mitigation**:
- Check all consumers before removing from shared package
- Version bump with migration guide

### Risk 3: Complex Debugging
**Impact**: Subtle bugs from removing intermediate layers  
**Mitigation**:
- Comprehensive automated tests
- Feature flag the new recording path
- Gradual rollout

---

## Alternative: Keep Everything (Status Quo)

If you're **not actively developing** this codebase and it works:
- **Don't remove anything**
- The adapters are harmless compatibility layers
- Focus on new features instead

Only remove legacy code if:
1. You need to add features that conflict with old layers
2. Code complexity is blocking development
3. You have time/resources for thorough testing

---

## Estimated Effort

| Phase | Files Changed | Complexity | Time Estimate |
|:------|:--------------|:-----------|:--------------|
| Phase 1 | ~7 files | High | 2-3 days |
| Phase 2 | ~2 files | Low | 2-4 hours |
| Phase 3 | ~2 files | Medium | 4-6 hours |
| Testing | All | High | 1-2 days |
| **Total** | **~11 files** | **High** | **4-5 days** |

---

## Conclusion

The **recommended path** is **Option 2: Partial Consolidation**:
1. Eliminate Step layer (recording outputs Nodes directly)
2. Keep Action layer (handlers are well-tested and work)
3. Delete adapter.ts (unused bridge code)

This gives you **80% of the simplification** with **20% of the risk**.

Full removal of Actions would require **rewriting all 19 action handlers** to be pure NodeDefinitions, which is a massive undertaking with unclear benefits.
