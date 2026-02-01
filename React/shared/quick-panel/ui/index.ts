/**
 * Quick Panel UI Module Index
 *
 * Exports all UI components for the Quick Panel feature.
 */

// ============================================================
// Shadow DOM host
// ============================================================

export {
  mountQuickPanelShadowHost,
  type QuickPanelShadowHostElements,
  type QuickPanelShadowHostManager,
  type QuickPanelShadowHostOptions,
} from './shadow-host';

// ============================================================
// React UI Components
// ============================================================

export * from './components/mount';
export * from './components/App';
export * from './components/QuickPanelShell';
export * from './components/SearchPanel';
export * from './components/AiChatPanel';
export * from './components/SearchInput';
export * from './components/QuickEntries';
export * from './components/MessageItem';
export * from './components/MarkdownContent';
