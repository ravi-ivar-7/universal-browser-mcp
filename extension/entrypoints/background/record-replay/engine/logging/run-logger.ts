// engine/logging/run-logger.ts — run logs, overlay and persistence
import type { RunLogEntry, RunRecord, Flow } from '../../types';
import { appendRun } from '../../flow-store';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { handleCallTool } from '@/entrypoints/background/tools';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';

export class RunLogger {
  private logs: RunLogEntry[] = [];
  constructor(
    private runId: string,
    private flowId?: string
  ) { }

  push(e: RunLogEntry) {
    this.logs.push(e);
    // Broadcast to UI (sidepanel/popup)
    chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.RR_REPLAY_EVENT,
      runId: this.runId,
      flowId: this.flowId,
      entry: e,
    }).catch(() => { });
  }

  getLogs() {
    return this.logs;
  }

  async overlayInit() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id)
        await chrome.tabs.sendMessage(tabs[0].id, { action: 'rr_overlay', cmd: 'init' } as any);
    } catch { }
  }

  async overlayAppend(text: string) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id)
        await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'rr_overlay',
          cmd: 'append',
          text,
        } as any);
    } catch { }
  }

  async overlayDone() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id)
        await chrome.tabs.sendMessage(tabs[0].id, { action: 'rr_overlay', cmd: 'done' } as any);
    } catch { }
  }

  async screenshotOnFailure() {
    try {
      const shot = await handleCallTool({
        name: TOOL_NAMES.BROWSER.COMPUTER,
        args: { action: 'screenshot' },
      });
      const img = (shot?.content?.find((c: any) => c.type === 'image') as any)?.data as string;
      if (img) this.logs[this.logs.length - 1].screenshotBase64 = img;
    } catch { }
  }

  async persist(flow: Flow, startedAt: number, success: boolean) {
    const record: RunRecord = {
      id: this.runId,
      flowId: flow.id,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      success,
      entries: this.logs,
    };
    await appendRun(record);
  }
}
