// rr-utils.ts — shared helpers for record-replay runner
// Note: comments in English

import {
  TOOL_NAMES,
  topoOrder as sharedTopoOrder,
  mapNodeToStep as sharedMapNodeToStep,
} from 'chrome-mcp-shared';
import type { Edge as DagEdge, NodeBase as DagNode, Step } from './types';
import { handleCallTool } from '@/entrypoints/background/tools';
import { EDGE_LABELS } from 'chrome-mcp-shared';

export function applyAssign(
  target: Record<string, any>,
  source: any,
  assign: Record<string, string>,
) {
  const getByPath = (obj: any, path: string) => {
    try {
      const parts = path
        .replace(/\[(\d+)\]/g, '.$1')
        .split('.')
        .filter(Boolean);
      let cur = obj;
      for (const p of parts) {
        if (cur == null) return undefined;
        cur = (cur as any)[p as any];
      }
      return cur;
    } catch {
      return undefined;
    }
  };
  for (const [k, v] of Object.entries(assign || {})) {
    target[k] = getByPath(source, String(v));
  }
}

export function expandTemplatesDeep<T = any>(value: T, scope: Record<string, any>): T {
  const replaceOne = (s: string) =>
    s.replace(/\{([^}]+)\}/g, (_m, k) => (scope[k] ?? '').toString());
  const walk = (v: any): any => {
    if (v == null) return v;
    if (typeof v === 'string') return replaceOne(v);
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (typeof v === 'object') {
      const out: any = {};
      for (const [k, val] of Object.entries(v)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  return walk(value);
}

export async function ensureTab(options: {
  tabTarget?: 'current' | 'new';
  startUrl?: string;
  refresh?: boolean;
}): Promise<{ tabId: number; url?: string }> {
  const target = options.tabTarget || 'current';
  const startUrl = options.startUrl;
  const isWebUrl = (u?: string | null) => !!u && /^(https?:|file:)/i.test(u);

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const [active] = tabs.filter((t) => t.active);

  if (target === 'new') {
    let urlToOpen = startUrl;
    if (!urlToOpen) urlToOpen = isWebUrl(active?.url) ? active!.url! : 'about:blank';
    const created = await chrome.tabs.create({ url: urlToOpen, active: true });
    await new Promise((r) => setTimeout(r, 300));
    return { tabId: created.id!, url: created.url };
  }

  // current tab target
  if (startUrl) {
    await handleCallTool({ name: TOOL_NAMES.BROWSER.NAVIGATE, args: { url: startUrl } });
  } else if (options.refresh) {
    // only refresh if current tab is a web page
    if (isWebUrl(active?.url))
      await handleCallTool({ name: TOOL_NAMES.BROWSER.NAVIGATE, args: { refresh: true } });
  }

  // Re-evaluate active after potential navigation
  const cur = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  let tabId = cur?.id;
  let url = cur?.url;

  // If still on extension/internal page and no startUrl, try switch to an existing web tab
  if (!isWebUrl(url) && !startUrl) {
    const candidate = tabs.find((t) => isWebUrl(t.url));
    if (candidate?.id) {
      await chrome.tabs.update(candidate.id, { active: true });
      tabId = candidate.id;
      url = candidate.url;
    }
  }
  return { tabId: tabId!, url };
}

/**
 * Wait for document to be in ready state (interactive or complete)
 * This ensures the DOM is fully parsed and elements are accessible
 * 
 * @param tabId - Target tab ID
 * @param timeoutMs - Maximum time to wait (default: 10000ms)
 * @param checkTerminated - Optional termination check callback
 * @returns Promise that resolves when DOM is ready or rejects on timeout
 */
export async function waitForDocumentReady(
  tabId: number,
  timeoutMs: number = 10000,
  checkTerminated?: () => boolean,
): Promise<void> {
  const startTime = Date.now();
  const timeout = Math.max(1000, Math.min(timeoutMs, 30000));

  console.log(`[waitForDocumentReady] START tabId=${tabId} timeout=${timeout}ms`);

  while (Date.now() - startTime < timeout) {
    try {
      // Check if terminated
      if (checkTerminated?.()) {
        throw new Error('Terminated');
      }

      // Check tab existence
      const tab = await chrome.tabs.get(tabId);
      if (!tab) {
        throw new Error('Tab not found');
      }

      // Execute script to check document.readyState
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          try {
            return {
              readyState: document.readyState,
              url: document.location.href,
              title: document.title,
              bodyExists: !!document.body,
            };
          } catch (e) {
            return { error: String(e) };
          }
        },
      });

      const docState = result?.[0]?.result;

      if (docState?.error) {
        console.warn(`[waitForDocumentReady] Document check error: ${docState.error}`);
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      // Ready states: 'loading', 'interactive', 'complete'
      // 'interactive' = DOM parsed, but resources still loading
      // 'complete' = everything loaded
      if (docState?.readyState === 'complete' || docState?.readyState === 'interactive') {
        const elapsed = Date.now() - startTime;
        console.log(
          `[waitForDocumentReady] READY after ${elapsed}ms - state="${docState.readyState}", ` +
          `url="${docState.url?.substring(0, 60)}...", bodyExists=${docState.bodyExists}`
        );

        // Give a tiny grace period for any pending async operations
        await new Promise(resolve => setTimeout(resolve, 50));
        return;
      }

      console.log(`[waitForDocumentReady] Still loading... state="${docState?.readyState}"`);
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (e: any) {
      // Script injection might fail if page is still navigating
      const isNavigationError =
        e?.message?.includes('No tab with id') ||
        e?.message?.includes('Cannot access') ||
        e?.message?.includes('Frame with id');

      if (isNavigationError) {
        console.log(`[waitForDocumentReady] Navigation in progress, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 200));
        continue;
      }

      console.warn(`[waitForDocumentReady] Unexpected error:`, e);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.warn(`[waitForDocumentReady] TIMEOUT after ${timeout}ms`);
  throw new Error(`Document ready timeout after ${timeout}ms`);
}

export async function waitForNetworkIdle(
  totalTimeoutMs: number,
  idleThresholdMs: number,
  checkTerminated?: () => boolean,
) {
  const deadline = Date.now() + Math.max(500, totalTimeoutMs);
  const threshold = Math.max(200, idleThresholdMs);
  while (Date.now() < deadline) {
    if (checkTerminated?.()) throw new Error('Terminated');
    await handleCallTool({
      name: TOOL_NAMES.BROWSER.NETWORK_CAPTURE_START,
      args: {
        includeStatic: false,
        // Ensure capture remains active until we explicitly stop it
        maxCaptureTime: Math.min(60_000, Math.max(threshold + 500, 2_000)),
        inactivityTimeout: 0,
      },
    });
    await new Promise((r) => setTimeout(r, threshold + 200));
    if (checkTerminated?.()) throw new Error('Terminated');

    const stopRes = await handleCallTool({
      name: TOOL_NAMES.BROWSER.NETWORK_CAPTURE_STOP,
      args: {},
    });
    const text = (stopRes as any)?.content?.find((c: any) => c.type === 'text')?.text;
    try {
      const json = text ? JSON.parse(text) : null;
      const captureEnd = Number(json?.captureEndTime) || Date.now();
      const reqs: any[] = Array.isArray(json?.requests) ? json.requests : [];
      const lastActivity = reqs.reduce(
        (acc, r) => {
          const t = Number(r.responseTime || r.requestTime || 0);
          return t > acc ? t : acc;
        },
        Number(json?.captureStartTime || 0),
      );
      if (captureEnd - lastActivity >= threshold) return; // idle reached
    } catch {
      // ignore parse errors
    }
    await new Promise((r) => setTimeout(r, Math.min(500, threshold)));
  }
  throw new Error('wait for network idle timed out');
}

// Event-driven navigation wait helper
// Waits for top-frame navigation completion or SPA history updates on active tab.
// Falls back to short network idle on timeout.
// IMPORTANT: Also waits for DOM to be ready after navigation completes.
export async function waitForNavigation(
  timeoutMs?: number,
  prevUrl?: string,
  checkTerminated?: () => boolean,
  explicitTabId?: number,
): Promise<void> {
  let tabId = explicitTabId;
  if (typeof tabId !== 'number') {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tabs?.[0]?.id;
  }
  if (typeof tabId !== 'number') throw new Error('Target tab not found');
  const timeout = Math.max(1000, Math.min(timeoutMs || 15000, 30000));
  const startedAt = Date.now();

  console.log(`[waitForNavigation] START tabId=${tabId} prevUrl="${prevUrl}" timeout=${timeout}ms`);

  // Immediate check: if tab is already complete and URL is different from prevUrl (if provided)
  try {
    const currentTab = await chrome.tabs.get(tabId);
    console.log(`[waitForNavigation] Current tab status="${currentTab.status}" url="${currentTab.url}"`);

    if (currentTab.status === 'complete') {
      const currentUrl = currentTab.url || '';
      // Only early-return if URL has actually changed (navigation finished before we started waiting)
      if (prevUrl && currentUrl !== prevUrl) {
        console.log(`[waitForNavigation] Tab already navigated: "${prevUrl}" -> "${currentUrl}"`);
        // Still need to ensure DOM is ready
        console.log('[waitForNavigation] Ensuring DOM is ready...');
        await waitForDocumentReady(tabId, 5000, checkTerminated);
        return;
      }
      // If no prevUrl given, or URL hasn't changed yet, we need to wait for navigation events
      console.log(`[waitForNavigation] Tab complete but URL same, waiting for navigation events...`);
    }
  } catch (e) {
    console.warn('[waitForNavigation] Initial tab check failed:', e);
  }

  await new Promise<void>((resolve, reject) => {
    let done = false;
    let timer: any = null;
    let termCheck: any = null;

    const cleanup = () => {
      try {
        chrome.webNavigation.onCommitted.removeListener(onCommitted);
      } catch { }
      try {
        chrome.webNavigation.onCompleted.removeListener(onCompleted);
      } catch { }
      try {
        (chrome.webNavigation as any).onHistoryStateUpdated?.removeListener?.(
          onHistoryStateUpdated,
        );
      } catch { }
      try {
        chrome.tabs.onUpdated.removeListener(onTabUpdated);
      } catch { }
      try {
        chrome.tabs.onRemoved.removeListener(onTabRemoved);
      } catch { }
      if (timer) {
        try {
          clearTimeout(timer);
        } catch { }
      }
      if (termCheck) {
        try {
          clearInterval(termCheck);
        } catch { }
      }
    };
    const finish = async () => {
      if (done) return;
      done = true;
      cleanup();

      // CRITICAL: Wait for DOM to be ready after navigation completes
      console.log('[waitForNavigation] Navigation event detected, ensuring DOM ready...');
      try {
        await waitForDocumentReady(tabId!, 5000, checkTerminated);
        console.log('[waitForNavigation] COMPLETE - Navigation and DOM ready');
        resolve();
      } catch (e) {
        console.error('[waitForNavigation] DOM ready check failed:', e);
        // Don't fail the whole navigation, just log and continue
        resolve();
      }
    };

    if (checkTerminated) {
      termCheck = setInterval(() => {
        if (checkTerminated()) {
          done = true;
          cleanup();
          reject(new Error('Terminated'));
        }
      }, 200);
    }

    const onCommitted = (details: any) => {
      if (
        details &&
        details.tabId === tabId &&
        details.frameId === 0 &&
        details.timeStamp >= startedAt
      ) {
        // committed observed; we'll wait for completion or SPA fallback
      }
    };
    const onCompleted = (details: any) => {
      if (
        details &&
        details.tabId === tabId &&
        details.frameId === 0 &&
        details.timeStamp >= startedAt
      )
        void finish();
    };
    const onHistoryStateUpdated = (details: any) => {
      if (
        details &&
        details.tabId === tabId &&
        details.frameId === 0 &&
        details.timeStamp >= startedAt
      )
        void finish();
    };
    const onTabUpdated = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId !== tabId) return;
      if (changeInfo.status === 'complete') void finish();
      if (typeof changeInfo.url === 'string' && (!prevUrl || changeInfo.url !== prevUrl)) void finish();
    };
    const onTabRemoved = (removedTabId: number) => {
      if (removedTabId === tabId) {
        done = true;
        cleanup();
        reject(new Error('Tab closed during navigation'));
      }
    };
    const onTimeout = async () => {
      console.warn(`[waitForNavigation] Timed out after ${timeout}ms, attempting fallback...`);
      cleanup();
      try {
        // Use a short, bounded network idle check
        await waitForNetworkIdle(3000, 500, checkTerminated);
        console.log('[waitForNavigation] Fallback success (network idle)');
        // Still ensure DOM is ready after fallback
        await waitForDocumentReady(tabId!, 3000, checkTerminated);
        console.log('[waitForNavigation] DOM ready after fallback');
        resolve();
      } catch (e) {
        console.error('[waitForNavigation] Fallback failed:', e);
        reject(new Error('navigation timeout'));
      }
    };

    chrome.webNavigation.onCommitted.addListener(onCommitted);
    chrome.webNavigation.onCompleted.addListener(onCompleted);
    try {
      (chrome.webNavigation as any).onHistoryStateUpdated?.addListener?.(onHistoryStateUpdated);
    } catch { }
    chrome.tabs.onUpdated.addListener(onTabUpdated);
    chrome.tabs.onRemoved.addListener(onTabRemoved);
    timer = setTimeout(onTimeout, timeout);
  });
}

export function topoOrder(nodes: DagNode[], edges: DagEdge[]): DagNode[] {
  return sharedTopoOrder(nodes, edges as any);
}

// Helper: filter only default edges (no label or label === 'default')
export function defaultEdgesOnly(edges: DagEdge[] = []): DagEdge[] {
  return (edges || []).filter((e) => !e.label || e.label === EDGE_LABELS.DEFAULT);
}

export function mapDagNodeToStep(n: DagNode): Step {
  const s: any = sharedMapNodeToStep(n as any);
  if ((n as any)?.type === 'if') {
    // forward extended conditional config for DAG mode
    const cfg: any = (n as any).config || {};
    if (Array.isArray(cfg.branches)) s.branches = cfg.branches;
    if ('else' in cfg) s.else = cfg.else;
    if (cfg.condition && !s.condition) s.condition = cfg.condition; // backward-compat
  }
  return s as Step;
}
