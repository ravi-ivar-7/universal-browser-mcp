# Comprehensive Renaming Manifest - Record Replay Cleanup

## Objective
Remove ALL version numbers and legacy/v2 references. Use simple, clear names.

## Directory Renames

### Main Directory
```bash
record-replay-v3/ → record-replay/
```

### Subdirectories  
```bash
record-replay/legacy-compat/ → record-replay/core/
```

## File Renames

### Core Types
```bash
core/legacy-types.ts → core/recording-types.ts
```

### Plugin System
```bash
engine/plugins/v2-action-adapter.ts → engine/plugins/action-node-bridge.ts
engine/plugins/register-v2-replay-nodes.ts → engine/plugins/register-action-nodes.ts
```

## Import Path Updates

All imports will change from:
```typescript
// OLD
import { ... } from '@/entrypoints/background/record-replay-v3/...'
import { ... } from '../legacy-compat/legacy-types'
import { ... } from './v2-action-adapter'
import { registerV2ReplayNodesAsV3Nodes } from '...'

// NEW
import { ... } from '@/entrypoints/background/record-replay/...'
import { ... } from '../core/recording-types'
import { ... } from './action-node-bridge'
import { registerActionNodes } from '...'
```

## Function/Variable Renames

### In action-node-bridge.ts (formerly v2-action-adapter.ts):
- `V2ActionNodeAdapterOptions` → `ActionNodeBridgeOptions`
- `adaptV2ActionHandlerToV3NodeDefinition` → `adaptActionHandlerToNodeDefinition`

### In register-action-nodes.ts (formerly register-v2-replay-nodes.ts):
- `RegisterV2ReplayNodesOptions` → `RegisterActionNodesOptions`
- `registerV2ReplayNodesAsV3Nodes` → `registerActionNodes`
- `listV2ActionTypes` → `listActionTypes`
- `DEFAULT_V2_EXCLUDE_LIST` → `DEFAULT_EXCLUDE_LIST`

### In bootstrap.ts:
- All "V3" and "RR-V3" log prefixes → "RR"
- Variable names: `registeredNodes` stays the same (already clear)

## Comment/Documentation Updates

Search and replace across all files:
- "V3" → remove or replace with appropriate context
- "V2" → remove or replace with "Action"
- "legacy" → remove or replace with "recording" or "core"
- "RR-V3" → "RR"

## Execution Order

1. Rename main directory: `record-replay-v3` → `record-replay`
2. Rename subdirectory: `legacy-compat` → `core`
3. Rename files within plugins/
4. Rename files within core/
5. Update all imports (find & replace)
6. Update function/variable names
7. Update comments and documentation
8. Run TypeScript compilation check
9. Git commit with detailed message

## Files That Will Need Import Updates (~estimated)

Based on grep results, approximately:
- **50+** files import from `record-replay-v3`
- **20+** files import from `legacy-compat`
- **5** files use v2-action-adapter
- **3** files use register-v2-replay-nodes

## Risk Assessment

**Risk Level**: MEDIUM-HIGH (lots of import updates)

**Mitigation**:
- Use `git mv` to preserve history
- Do systematic find-replace for imports
- Verify TypeScript compilation after each major step
- Can rollback with `git reset --hard` if issues arise

## Expected Impact

**Lines Changed**: ~200-300 (mostly imports)
**Files Modified**: ~50-70 files
**Code Functionality**: ZERO CHANGE (pure refactor)
**Breaking Changes**: NONE (internal only)

## Verification Checklist

- [ ] TypeScript compilation succeeds
- [ ] No "cannot find module" errors
- [ ] Git status shows only renamed files (preserves history)
- [ ] Recording still works
- [ ] Replay still works

---
