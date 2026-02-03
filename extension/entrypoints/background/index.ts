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

// Record-Replay V3 (new engine)
import { bootstrapV3 } from './record-replay-v3/bootstrap';

/**
 * Feature flag for RR-V3
 * Set to true to enable the new Record-Replay V3 engine
 */
const ENABLE_RR_V3 = true;

/**
 * Background script entry point
 * Initializes all background services and listeners
 */
export default defineBackground(() => {
  // Open welcome page on first install
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      // Open the welcome/onboarding page for new installations
      chrome.tabs.create({
        url: chrome.runtime.getURL('/welcome.html'),
      });
    }
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

  // Record & Replay V3 (new engine)
  if (ENABLE_RR_V3) {
    bootstrapV3()
      .then((runtime) => {
        console.log(`[RR-V3] Bootstrap complete, ownerId: ${runtime.ownerId}`);
      })
      .catch((error) => {
        console.error('[RR-V3] Bootstrap failed:', error);
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
