import type { Flow } from '../domain/flow';
import { getRecordReplayRuntime } from '../bootstrap';
import { broadcastControlToTab, ensureRecorderInjected, REC_CMD } from './content-injection';
import { recordingSession as session } from './session-manager';
import { createInitialFlow, addNavigationStep } from './flow-builder';
import { initBrowserEventListeners } from './browser-event-listener';
import { initContentMessageHandler } from './content-message-handler';

/** Timeout for waiting for the top-frame content script to acknowledge stop. */
const STOP_BARRIER_TOP_TIMEOUT_MS = 5000;

/** Best-effort stop timeout for subframes (keeps top-frame still listening). */
const STOP_BARRIER_SUBFRAME_TIMEOUT_MS = 1500;

/** Small grace period for in-flight messages after all ACKs. */
const STOP_BARRIER_GRACE_MS = 150;

/** Types for stop barrier results */
interface StopAckStats {
  ack: boolean;
  steps: number;
  variables: number;
}

interface StopFrameAck {
  frameId: number;
  ack: boolean;
  timedOut: boolean;
  error?: string;
  stats?: StopAckStats;
}

interface StopTabBarrierResult {
  tabId: number;
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  top?: StopFrameAck;
  subframes: StopFrameAck[];
}

/**
 * List frameIds for a tab. Always includes 0 (main frame).
 */
async function listFrameIds(tabId: number): Promise<number[]> {
  try {
    const res = await chrome.webNavigation.getAllFrames({ tabId });
    const ids = Array.isArray(res)
      ? res.map((f) => f.frameId).filter((n) => typeof n === 'number')
      : [];
    if (!ids.includes(0)) ids.unshift(0);
    return Array.from(new Set(ids)).sort((a, b) => a - b);
  } catch {
    return [0];
  }
}

/**
 * Send stop command to a specific frame and wait for acknowledgment.
 */
async function sendStopToFrameWithAck(
  tabId: number,
  sessionId: string,
  frameId: number,
  timeoutMs: number,
): Promise<StopFrameAck> {
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      resolve({ frameId, ack: false, timedOut: true });
    }, timeoutMs);

    chrome.tabs
      .sendMessage(
        tabId,
        {
          action: REC_CMD.STOP,
          sessionId,
          requireAck: true,
        },
        { frameId },
      )
      .then((response) => {
        clearTimeout(t);
        const ack = !!(response && response.ack);
        const stats = response && response.stats ? (response.stats as StopAckStats) : undefined;
        resolve({ frameId, ack, timedOut: false, stats });
      })
      .catch((err) => {
        clearTimeout(t);
        resolve({ frameId, ack: false, timedOut: false, error: String(err) });
      });
  });
}

/**
 * Stop a tab with full barrier support.
 */
async function stopTabWithBarrier(tabId: number, sessionId: string): Promise<StopTabBarrierResult> {
  try {
    await chrome.tabs.get(tabId);
  } catch {
    return { tabId, ok: true, skipped: true, reason: 'tab not found', subframes: [] };
  }

  try {
    await ensureRecorderInjected(tabId);
  } catch { }

  const frameIds = await listFrameIds(tabId);
  const subframeIds = frameIds.filter((id) => id !== 0);

  const subframes = await Promise.all(
    subframeIds.map((fid) =>
      sendStopToFrameWithAck(tabId, sessionId, fid, STOP_BARRIER_SUBFRAME_TIMEOUT_MS),
    ),
  );

  const top = await sendStopToFrameWithAck(tabId, sessionId, 0, STOP_BARRIER_TOP_TIMEOUT_MS);

  return { tabId, ok: top.ack, top, subframes };
}

class RecorderManagerImpl {
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    initBrowserEventListeners(session);
    initContentMessageHandler(session);
    this.initialized = true;
  }

  async start(meta?: Partial<Flow>): Promise<{ success: boolean; error?: string }> {
    if (session.getStatus() !== 'idle')
      return { success: false, error: 'Recording already active' };

    const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!active?.id) {
      console.warn('[RecorderManager] No active tab found in last focused window');
      // Fallback to current window if lastFocused fails
      const [current] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!current?.id) return { success: false, error: 'Active tab not found' };
      active.id = current.id;
    }

    const flow: Flow = createInitialFlow(meta);
    await session.startSession(flow, active.id);

    await ensureRecorderInjected(active.id);
    await broadcastControlToTab(active.id, REC_CMD.START, {
      id: flow.id,
      name: flow.name,
      description: flow.description,
      sessionId: session.getSession().sessionId,
    });
    session.addActiveTab(active.id);

    const url = active.url;
    if (url) {
      addNavigationStep(flow, url);
      try {
        const runtime = getRecordReplayRuntime();
        if (runtime) await runtime.storage.flows.save(flow);
      } catch (e) {
        console.warn('RecorderManager: initial save failed', e);
      }
    }

    return { success: true };
  }

  async stop(): Promise<{ success: boolean; error?: string; flow?: Flow }> {
    const currentStatus = session.getStatus();
    if (currentStatus === 'idle' || !session.getFlow()) {
      return { success: false, error: 'No active recording' };
    }

    if (currentStatus === 'stopping') {
      return { success: false, error: 'Stop already in progress' };
    }

    const sessionId = session.beginStopping();
    const tabs = session.getActiveTabs();

    let results: StopTabBarrierResult[] = [];
    try {
      results = await Promise.all(tabs.map((tabId) => stopTabWithBarrier(tabId, sessionId)));
    } catch (e) {
      console.warn('RecorderManager: Error during stop broadcast:', e);
    }

    await new Promise((resolve) => setTimeout(resolve, STOP_BARRIER_GRACE_MS));

    const flow = await session.stopSession();
    const barrierOk = results.length === tabs.length && results.every((r) => r.ok || r.skipped);

    if (flow) {
      const runtime = getRecordReplayRuntime();
      if (runtime) await runtime.storage.flows.save(flow);
    }

    if (!barrierOk) {
      const failedTabs = results.filter((r) => !r.ok && !r.skipped).map((r) => r.tabId);
      return {
        success: true,
        flow: flow || undefined,
        error: failedTabs.length
          ? `Stop barrier incomplete; missing ACK from tabs: ${failedTabs.join(', ')}`
          : 'Stop barrier incomplete; missing ACK(s)',
      };
    }

    return flow ? { success: true, flow } : { success: true };
  }

  async pause(): Promise<{ success: boolean; error?: string }> {
    if (session.getStatus() !== 'recording') {
      return { success: false, error: 'Not currently recording' };
    }

    session.pause();

    const tabs = session.getActiveTabs();
    try {
      await Promise.all(tabs.map((id) => broadcastControlToTab(id, REC_CMD.PAUSE)));
    } catch (e) {
      console.warn('RecorderManager: Error during pause broadcast:', e);
    }

    return { success: true };
  }

  async resume(): Promise<{ success: boolean; error?: string }> {
    if (session.getStatus() !== 'paused') {
      return { success: false, error: 'Not currently paused' };
    }

    session.resume();

    const tabs = session.getActiveTabs();
    try {
      await Promise.all(tabs.map((id) => broadcastControlToTab(id, REC_CMD.RESUME)));
    } catch (e) {
      console.warn('RecorderManager: Error during resume broadcast:', e);
    }

    return { success: true };
  }
}

export const RecorderManager = new RecorderManagerImpl();
