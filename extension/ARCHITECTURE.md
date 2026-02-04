# Record & Replay Architecture

## Overview

Your Record & Replay system is a **browser automation framework** that records user interactions and executes them as repeatable workflows. It uses a **3-layer execution model** with adapter bridges for backward compatibility.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CHROME EXTENSION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐      ┌──────────────┐      ┌──────────────┐   │
│  │  RECORDING  │─────▶│   STORAGE    │─────▶│    REPLAY    │   │
│  │   SYSTEM    │      │  (IndexedDB) │      │    ENGINE    │   │
│  └─────────────┘      └──────────────┘      └──────────────┘   │
│        │                                            │            │
│        │ Browser Events                   Commands │            │
│        ▼                                            ▼            │
│  ┌────────────────────────── WEB PAGE ───────────────────────┐  │
│  │  • Click, Fill, Navigate                                  │  │
│  │  • Content Script Injection                               │  │
│  │  • Selector Capture                                       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. **Recording System** 📹

**Location**: `extension/entrypoints/background/record-replay/recording/`

**Purpose**: Captures browser interactions and converts them to flows

**Key Files**:
- `recorder-manager.ts` - Orchestrates recording lifecycle
- `session-manager.ts` - Manages active recording session state
- `browser-event-listener.ts` - Listens to DOM events from content scripts
- `flow-builder.ts` - Constructs Flow objects (Nodes + Edges)

**Data Flow**:
```
User clicks button
    ↓
Content script captures event → background/browser-event-listener
    ↓
Creates Step object
    ↓
session-manager.appendSteps([step])
    ↓
Converts Step → Node via mapStepToNodeConfig()
    ↓
Appends Node to Flow.nodes[]
    ↓
Creates Edge connecting nodes
    ↓
Stores Flow in IndexedDB
```

---

### 2. **Storage Layer** 💾

**Location**: `extension/entrypoints/background/record-replay/storage/`

**Purpose**: Persistent storage for flows, runs, events, and queue

**Database**: IndexedDB (`record_replay`)

**Stores**:
| Store | Purpose | Key Type |
|:------|:--------|:---------|
| `flows` | Saved workflows (Nodes + Edges) | FlowId |
| `runs` | Execution records | RunId |
| `events` | Run event log (per-node execution) | RunId + seq |
| `queue` | Scheduled runs with priority | QueueId |
| `persistent_vars` | Persistent variables | VarName |
| `triggers` | Flow triggers (URL, schedule, etc.) | TriggerId |

**Key Interfaces**:
```typescript
interface Flow {
  id: FlowId;
  nodes: Node[];      // DAG nodes
  edges: Edge[];      // DAG edges
  entryNodeId: NodeId;
  variables?: VariableDefinition[];
}

interface RunRecord {
  id: RunId;
  flowId: FlowId;
  status: 'queued' | 'running' | 'paused' | 'canceled' | 'succeeded' | 'failed';
  currentNodeId?: NodeId;
  args?: JsonObject;
}
```

---

### 3. **Execution Engine** ⚙️

**Location**: `extension/entrypoints/background/record-replay/engine/`

**Purpose**: Executes flows as DAG traversal with retry, error handling, and state management

#### 3.1 Kernel (Core Execution)

**Files**:
- `kernel/runner.ts` - **RunRunner**: Executes a single run (Flow instance)
- `kernel/kernel.ts` - Manages concurrent runs
- `kernel/traversal.ts` - DAG navigation logic

**RunRunner Responsibilities**:
1. Load Flow from storage
2. Traverse nodes following edges
3. Execute each node via PluginRegistry
4. Handle retries, timeouts, breakpoints
5. Emit events to EventsBus
6. Update RunRecord status

**Example Run Lifecycle**:
```
RunRunner.start()
  ↓
Load Flow by flowId
  ↓
Start at Flow.entryNodeId
  ↓
For each node:
  - Execute via plugins.getNode(kind).execute()
  - Handle result.next (which edge to follow)
  - Emit run.node.started, run.node.completed events
  - Check for pause/cancel requests
  ↓
Mark run as 'succeeded' or 'failed'
```

#### 3.2 Plugin System

**Files**:
- `plugins/registry.ts` - **PluginRegistry**: Maps node kinds to NodeDefinitions
- `plugins/action-node-bridge.ts` - Adapts ActionHandlers → NodeDefinitions
- `plugins/register-action-nodes.ts` - Bulk registration of action handlers

**How Plugins Work**:
```typescript
interface NodeDefinition {
  kind: string;  // e.g., 'click', 'navigate'
  execute(ctx: NodeExecutionContext, node: Node): Promise<NodeExecutionResult>;
}

// Runner calls:
const nodeDef = pluginRegistry.getNode(node.kind);
const result = await nodeDef.execute(ctx, node);
```

#### 3.3 Action Handlers (Legacy Bridge)

**Location**: `engine/actions/handlers/`

**Files**: 19 handler files (click.ts, fill.ts, navigate.ts, etc.)

**Purpose**: Actual execution logic for browser interactions

**Bridge Flow**:
```
Node {kind: 'click', config: {...}}
    ↓
action-node-bridge.ts adapts to:
    ↓
ActionHandler<'click'>.run(ctx, action)
    ↓
Executes: chrome.scripting.executeScript() to click element
    ↓
Returns ActionExecutionResult
    ↓
Converted to NodeExecutionResult
```

#### 3.4 Queue & Scheduler

**Files**:
- `queue/queue.ts` - Priority queue with lease-based claiming
- `queue/scheduler.ts` - Concurrent run scheduler (respects maxParallelRuns)
- `queue/leasing.ts` - Distributed lease manager for MV3 service workers

**Scheduler Flow**:
```
User triggers flow
    ↓
enqueueRun() → Add to queue with priority
    ↓
Scheduler.kick()
    ↓
While activeRuns < maxParallelRuns:
  item = queue.claimNext()
  launch RunRunner(item)
    ↓
RunRunner executes flow
    ↓
On completion: queue.markDone(), scheduler backfills
```

#### 3.5 Triggers

**Location**: `engine/triggers/`

**Types**:
- **URL Trigger** - Activate when visiting matching URL
- **Command Trigger** - Keyboard shortcut
- **Context Menu** - Right-click menu item
- **DOM Trigger** - Element appears/changes
- **Cron Trigger** - Time-based schedule
- **Interval Trigger** - Recurring interval
- **Once Trigger** - One-time delayed execution
- **Manual Trigger** - User-initiated from UI

**Architecture**:
```
TriggerManager
  ├─ urlTriggerHandler (listens to chrome.tabs.onUpdated)
  ├─ commandTriggerHandler (chrome.commands)
  ├─ cronTriggerHandler (setInterval)
  └─ ...

When triggered:
  handler → calls enqueueRun(flowId, args)
```

---

### 4. **RPC Layer** 🔌

**Location**: `engine/transport/`

**Files**:
- `rpc-server.ts` - Background service RPC server
- `rpc.ts` - RPC method definitions
- `useRRRpc.ts` - React hook for UI to call RPC

**Communication**:
```
Sidepanel UI
    ↓
useRRRpc() hook
    ↓
chrome.runtime.connect('rr-rpc')
    ↓
RpcServer in background
    ↓
Executes methods: rr.execute, rr.pause, rr.resume, etc.
```

**Available RPC Methods**:
- `rr.execute` - Start flow execution
- `rr.pause` / `rr.resume` - Pause/resume run
- `rr.cancel` - Stop run
- `rr.get_state` - Get run state
- `rr.list_flows` - List all flows
- `rr.get_events` - Get run events

---

### 5. **Domain Model** 📐

**Location**: `extension/entrypoints/background/record-replay/domain/`

**Core Types**:

```typescript
// Flow IR (Intermediate Representation)
interface Flow {
  schemaVersion: 3;
  id: FlowId;
  nodes: Node[];
  edges: Edge[];
  entryNodeId: NodeId;
  variables?: VariableDefinition[];
  policy?: FlowPolicy;
}

interface Node {
  id: NodeId;
  kind: string;      // 'click', 'navigate', 'fill', etc.
  config: JsonObject; // Kind-specific configuration
  policy?: NodePolicy;
}

interface Edge {
  id: EdgeId;
  from: NodeId;
  to: NodeId;
  label?: EdgeLabel;  // 'default', 'true', 'false', 'onError'
}

// Execution Model
interface RunRecord {
  id: RunId;
  flowId: FlowId;
  status: 'queued' | 'running' | 'paused' | 'canceled' | 'succeeded' | 'failed';
  currentNodeId?: NodeId;
  attempt: number;
  maxAttempts: number;
  nextSeq: number;  // Event sequence counter
}

interface RunEvent {
  runId: RunId;
  seq: number;
  type: 'run.started' | 'run.node.started' | 'run.node.completed' | 'run.failed' | ...;
  // ... event-specific fields
}
```

---

## Data Model Evolution (3 Layers)

### Layer 1: **Step** (Recording Format - Legacy)

**Location**: `core/recording-types.ts`

**Type**: Linear sequence of recorded actions

**Example**:
```typescript
interface StepClick {
  id: string;
  type: 'click';
  target: TargetLocator;  // Selector candidates
  timeoutMs?: number;
  retry?: { count: number; intervalMs: number };
}
```

**Status**: ⚠️ Still used by recorder, being phased out

**Why exists**: Original recording format, simpler for event capture

---

### Layer 2: **Action** (Execution Handlers - Middle)

**Location**: `engine/actions/types.ts`

**Type**: Typed execution primitives with handlers

**Example**:
```typescript
interface Action<'click'> {
  id: ActionId;
  type: 'click';
  params: ClickParams;
  policy?: ActionPolicy;
}

const clickHandler: ActionHandler<'click'> = {
  type: 'click',
  run: async (ctx, action) => {
    // Execute click via content script
    return { status: 'success' };
  }
};
```

**Status**: ✅ Active, used for actual execution

**Why exists**: Separation of concerns - handlers are testable, reusable primitives

---

### Layer 3: **Node** (Flow IR - Current)

**Location**: `domain/flow.ts`

**Type**: Generic DAG node for graph execution

**Example**:
```typescript
interface Node {
  id: 'node-1';
  kind: 'click';  // Maps to ActionHandler
  config: {
    target: { candidates: [...] }
  };
}
```

**Status**: ✅ Current, storage format

**Why exists**: Graph-based execution model (DAG), supports conditionals, loops, parallel execution

---

## Execution Flow: End-to-End

### Recording a Flow

```
1. User clicks "Record" in UI
     ↓
2. RecorderManager.start(meta)
     ↓
3. Creates initial Flow object
     ↓
4. Injects content scripts into tabs
     ↓
5. Content script listens for DOM events
     ↓
6. User clicks button on page
     ↓
7. Content script → chrome.runtime.sendMessage({type: 'STEP_RECORDED', step})
     ↓
8. browser-event-listener receives message
     ↓
9. Creates Step object: {id, type: 'click', target}
     ↓
10. session-manager.appendSteps([step])
     ↓
11. Converts Step → Node via mapStepToNodeConfig()
     ↓
12. Appends Node to flow.nodes[]
     ↓
13. Creates Edge: previous node → new node
     ↓
14. User clicks "Stop Recording"
     ↓
15. RecorderManager.stop() → Saves Flow to storage
```

### Replaying a Flow

```
1. User clicks "Play" on flow in UI
     ↓
2. UI calls rpc.execute(flowId, args)
     ↓
3. enqueueRun() → Adds to queue
     ↓
4. Scheduler claims run from queue
     ↓
5. Creates RunRunner instance
     ↓
6. RunRunner.start()
     ├─ Loads Flow from storage
     ├─ Creates RunRecord (status: 'running')
     └─ Starts at flow.entryNodeId
     ↓
7. For each node in DAG:
     ├─ RunRunner.executeNode(node)
     ├─ Gets NodeDefinition from PluginRegistry
     ├─ Calls nodeDef.execute(ctx, node)
     │    ↓
     │  action-node-bridge converts to Action
     │    ↓
     │  ActionHandler.run(ctx, action)
     │    ↓
     │  Executes in browser (click, fill, etc.)
     │    ↓
     │  Returns result
     ├─ Emits events: 'run.node.started', 'run.node.completed'
     ├─ Follows edge based on result.next
     └─ Repeats until terminal node or error
     ↓
8. RunRunner marks run as 'succeeded' or 'failed'
     ↓
9. queue.markDone(runId)
     ↓
10. Scheduler backfills next queued run
```

---

## Key Design Patterns

### 1. **DAG Execution Model**

Flows are directed acyclic graphs enabling:
- **Conditional branching** (if/else via edge labels)
- **Error handling** (onError edge to recovery node)
- **Parallel execution** (multiple entry points)
- **Loop prevention** (cycle detection)

### 2. **Event Sourcing**

Run execution is event-driven:
- Every node execution emits events
- Events stored in `events` store
- UI reconstructs run state from events
- Enables pause/resume, replay analysis

### 3. **Lease-Based Concurrency**

Queue uses distributed leases:
- Each run is "claimed" by owner (service worker instance)
- Lease has TTL with heartbeat renewal
- Prevents duplicate execution across restarts
- Handles MV3 service worker suspension

### 4. **Plugin Architecture**

Nodes are executed via registered plugins:
- Extensible: Add new node types without core changes
- Testable: Mock plugin for testing
- Composable: Combine multiple plugins

### 5. **Adapter Pattern**

Bridges legacy systems to new architecture:
- `action-node-bridge.ts`: ActionHandler → NodeDefinition
- `adapter.ts`: Step → Action (unused, can delete)
- Enables gradual migration

---

## Technology Stack

| Layer | Technology |
|:------|:-----------|
| **Storage** | IndexedDB (via custom abstraction) |
| **Runtime** | Chrome Extension MV3 Service Worker |
| **UI** | React + TypeScript (Sidepanel) |
| **Content Scripts** | Vanilla JS injection |
| **IPC** | chrome.runtime messaging + ports |
| **Type Safety** | TypeScript + Zod validation |

---

## Directory Structure

```
extension/entrypoints/background/record-replay/
├── bootstrap.ts              # System initialization
├── core/
│   ├── types.ts              # Legacy type exports
│   └── recording-types.ts    # Step type system (legacy)
├── domain/                   # Core type definitions
│   ├── flow.ts               # Flow, Node, Edge
│   ├── events.ts             # RunRecord, RunEvent
│   ├── ids.ts                # FlowId, NodeId, etc.
│   ├── errors.ts             # RRError
│   └── policy.ts             # Retry, timeout policies
├── recording/                # Recording system
│   ├── recorder-manager.ts
│   ├── session-manager.ts
│   ├── browser-event-listener.ts
│   └── flow-builder.ts
├── storage/                  # IndexedDB abstraction
│   ├── db.ts
│   ├── flows.ts
│   ├── runs.ts
│   ├── events.ts
│   └── queue.ts
├── engine/
│   ├── kernel/               # Core execution
│   │   ├── runner.ts         # RunRunner
│   │   └── traversal.ts      # DAG navigation
│   ├── plugins/              # Plugin system
│   │   ├── registry.ts
│   │   ├── action-node-bridge.ts
│   │   └── register-action-nodes.ts
│   ├── actions/              # Action handlers (19 files)
│   │   ├── handlers/
│   │   │   ├── click.ts
│   │   │   ├── fill.ts
│   │   │   └── ...
│   │   ├── registry.ts
│   │   └── types.ts
│   ├── queue/                # Job queue
│   │   ├── scheduler.ts
│   │   └── queue.ts
│   ├── triggers/             # Trigger handlers (8 types)
│   └── transport/            # RPC & events
│       ├── rpc-server.ts
│       └── events-bus.ts
└── index.ts                  # Public API exports
```

---

## Summary

Your Record & Replay system is a **sophisticated browser automation framework** with:

✅ **DAG-based execution** for complex workflows  
✅ **Event-sourced run logs** for debugging  
✅ **Concurrent job scheduling** with lease management  
✅ **Extensible plugin system** for custom node types  
✅ **Multiple trigger mechanisms** (URL, schedule, DOM, etc.)  
✅ **3-layer architecture** (Step → Action → Node) for backward compatibility

The **core innovation** is the Node/Edge graph model, which provides flexibility beyond simple linear scripts while maintaining robust execution semantics through policies, retries, and error handling.
