import { initNativeHostListener } from './native-host';
import {
  initSemanticSimilarityListener,
  initializeSemanticEngineIfCached,
} from './semantic-similarity';
import { initStorageManagerListener } from './storage-manager';
import { cleanupModelCache } from '@/utils/semantic-similarity-engine';
import { initElementMarkerListeners } from './element-marker';
import { initQuickPanelAgentHandler } from './quick-panel/agent-handler';
import { initQuickPanelCommands } from './quick-panel/commands';
import { initQuickPanelTabsHandler } from './quick-panel/tabs-handler';
import { initQuickPanelBookmarksHandler } from './quick-panel/bookmarks-handler';
import { initQuickPanelHistoryHandler } from './quick-panel/history-handler';
import { initQuickPanelNavigationHandler } from './quick-panel/navigation-handler';

// Record-Replay (new engine)
import { bootstrapRecordReplay } from './record-replay/bootstrap';

/**
 * Feature flag for RR
 * Set to true to enable the new Record-Replay engine
 */
const ENABLE_RR = true;

/**
 * Background script entry point
 * Initializes all background services and listeners
 */
export default defineBackground(() => {
  // Open welcome page on first install
  // Open welcome page on first install
  chrome.runtime.onInstalled.addListener((details) => {
    // Configure sidepanel behavior to open on action click
    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
        .catch((error) => console.warn('Failed to set panel behavior:', error));
    }

    // if (details.reason === 'install') {
    //   chrome.tabs.create({
    //     url: chrome.runtime.getURL('/welcome.html'),
    //   });
    // }
  });

  // Initialize core services
  initNativeHostListener();
  initSemanticSimilarityListener();
  initStorageManagerListener();

  // Element marker: context menu + CRUD listeners
  initElementMarkerListeners();
  // Quick Panel: send messages to AgentChat via background-stream bridge
  initQuickPanelAgentHandler();
  // Quick Panel: tabs search bridge for content script UI
  initQuickPanelTabsHandler();
  // Quick Panel: keyboard shortcut handler
  initQuickPanelCommands();
  // Quick Panel: additional handlers
  initQuickPanelBookmarksHandler();
  initQuickPanelHistoryHandler();
  initQuickPanelNavigationHandler();

  // Record & Replay V1/V2: recording, playback, triggers, schedules

  // Record & Replay (new engine)
  if (ENABLE_RR) {
    bootstrapRecordReplay()
      .then((runtime) => {
        console.log(`[RR] Bootstrap complete, ownerId: ${runtime.ownerId}`);
      })
      .catch((error) => {
        console.error('[RR] Bootstrap failed:', error);
      });
  }

  // Conditionally initialize semantic similarity engine if model cache exists
  initializeSemanticEngineIfCached()
    .then((initialized) => {
      if (initialized) {
        console.log('Background: Semantic similarity engine initialized from cache');
      } else {
        console.log(
          'Background: Semantic similarity engine initialization skipped (no cache found)',
        );
      }
    })
    .catch((error) => {
      console.warn('Background: Failed to conditionally initialize semantic engine:', error);
    });

  // Initial cleanup on startup
  cleanupModelCache().catch((error) => {
    console.warn('Background: Initial cache cleanup failed:', error);
  });
});
