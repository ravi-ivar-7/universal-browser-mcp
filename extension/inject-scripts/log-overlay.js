/**
 * @fileoverview Standalone Log Overlay for Web Pages
 * @description A reusable floating log panel that can display logs from anywhere
 *              (workflows, chat, tools, etc.) directly on the webpage.
 * 
 * Usage from background script:
 *   chrome.tabs.sendMessage(tabId, { action: 'log_overlay', cmd: 'init' });
 *   chrome.tabs.sendMessage(tabId, { action: 'log_overlay', cmd: 'append', text: '✔ Step completed', level: 'success' });
 *   chrome.tabs.sendMessage(tabId, { action: 'log_overlay', cmd: 'append', text: '✘ Failed', level: 'error' });
 *   chrome.tabs.sendMessage(tabId, { action: 'log_overlay', cmd: 'clear' });
 *   chrome.tabs.sendMessage(tabId, { action: 'log_overlay', cmd: 'hide' });
 *   chrome.tabs.sendMessage(tabId, { action: 'log_overlay', cmd: 'show' });
 *   chrome.tabs.sendMessage(tabId, { action: 'log_overlay', cmd: 'destroy' });
 */

(function () {
  'use strict';

  // Prevent double initialization
  if (window.__LOG_OVERLAY_INITIALIZED__) return;
  window.__LOG_OVERLAY_INITIALIZED__ = true;

  // ==================== Configuration ====================

  const CONFIG = {
    maxLogs: 100,
    autoDismissMs: 0, // 0 = no auto dismiss
    position: 'bottom-right', // 'top-left', 'top-right', 'bottom-left', 'bottom-right'
    width: '320px',
    maxHeight: '300px',
    zIndex: 2147483647,
    opacity: 0.95,
  };

  // ==================== Styles ====================

  const STYLES = `
    .log-overlay-container {
      position: fixed;
      z-index: ${CONFIG.zIndex};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      pointer-events: auto;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }
    .log-overlay-container.top-left { top: 16px; left: 16px; }
    .log-overlay-container.top-right { top: 16px; right: 16px; }
    .log-overlay-container.bottom-left { bottom: 16px; left: 16px; }
    .log-overlay-container.bottom-right { bottom: 16px; right: 16px; }
    .log-overlay-container.hidden {
      opacity: 0;
      transform: translateY(20px);
      pointer-events: none;
    }

    .log-overlay-panel {
      width: ${CONFIG.width};
      max-height: ${CONFIG.maxHeight};
      background: rgba(15, 23, 42, 0.45);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1);
      overflow: hidden;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      transition: height 0.3s ease, max-height 0.3s ease;
      display: flex;
      flex-direction: column;
    }

    .log-overlay-container.minimized .log-overlay-panel {
      max-height: 42px; /* Header height only */
    }
    
    .log-overlay-container.minimized .log-overlay-content {
      opacity: 0;
      pointer-events: none;
    }

    .log-overlay-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: rgba(30, 41, 59, 0.4);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      cursor: move;
      user-select: none;
      flex-shrink: 0;
    }

    .log-overlay-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #ffffff;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-shadow: 0 1px 2px rgba(0,0,0,0.8);
    }

    .log-overlay-title::before {
      content: '';
      width: 6px;
      height: 6px;
      background: #22c55e;
      border-radius: 50%;
      box-shadow: 0 0 8px #22c55e;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.9); }
    }

    .log-overlay-actions {
      display: flex;
      gap: 6px;
    }

    .log-overlay-btn {
      width: 22px;
      height: 22px;
      border: none;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      opacity: 0.8;
    }

    .log-overlay-btn:hover {
      background: rgba(255, 255, 255, 0.25);
      color: #ffffff;
      transform: translateY(-1px);
      opacity: 1;
    }

    .log-overlay-btn.close:hover {
      background: rgba(239, 68, 68, 0.6);
      color: #fff;
    }

    .log-overlay-content {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
      transition: opacity 0.2s ease;
    }

    /* Scrollbar Styling */
    .log-overlay-content::-webkit-scrollbar { width: 4px; }
    .log-overlay-content::-webkit-scrollbar-track { background: transparent; }
    .log-overlay-content::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.3); border-radius: 2px; }
    .log-overlay-content::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.5); }

    .log-overlay-entry {
      padding: 5px 14px;
      color: #ffffff;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
      font-size: 11px;
      line-height: 1.5;
      animation: slideIn 0.2s ease;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      text-shadow: 0 1px 1px rgba(0,0,0,0.5);
    }
    
    .log-overlay-entry:last-child { border-bottom: none; }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(-5px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .log-overlay-entry .icon {
      flex-shrink: 0;
      width: 14px;
      text-align: center;
      opacity: 1;
      font-weight: bold;
    }

    .log-overlay-entry .text {
      flex: 1;
      word-break: break-word;
      opacity: 1;
      font-weight: 500;
    }

    .log-overlay-entry .time {
      flex-shrink: 0;
      font-size: 9px;
      color: rgba(255, 255, 255, 0.7);
      margin-top: 1px;
      font-variant-numeric: tabular-nums;
    }

    .log-overlay-entry.success .icon { color: #4ade80; text-shadow: 0 0 10px rgba(74, 222, 128, 0.5); }
    .log-overlay-entry.error .icon { color: #f87171; text-shadow: 0 0 10px rgba(248, 113, 113, 0.5); }
    .log-overlay-entry.warning .icon { color: #fbbf24; }
    .log-overlay-entry.info .icon { color: #60a5fa; }
    .log-overlay-entry.debug .icon { color: #a78bfa; }

    .log-overlay-empty {
      padding: 30px 20px;
      text-align: center;
      color: rgba(255, 255, 255, 0.6);
      font-style: italic;
      font-size: 11px;
    }
  `;

  // ==================== State ====================

  let container = null;
  let contentDiv = null;
  let logs = [];
  let isVisible = false;
  let isMinimized = false;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  // ==================== Helpers ====================

  function getIcon(level) {
    switch (level) {
      case 'success': return '✓';
      case 'error': return '✕'; // Cross mark
      case 'warning': return '⚠';
      case 'info': return '•';
      case 'debug': return '○';
      default: return '→';
    }
  }

  function formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== DOM Creation ====================

  function injectStyles() {
    if (document.getElementById('log-overlay-styles')) return;
    const style = document.createElement('style');
    style.id = 'log-overlay-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  function createOverlay() {
    if (container) return;

    injectStyles();

    container = document.createElement('div');
    container.className = `log-overlay-container ${CONFIG.position} hidden`;
    container.innerHTML = `
      <div class="log-overlay-panel">
        <div class="log-overlay-header">
          <div class="log-overlay-title">Workflow Logs</div>
          <div class="log-overlay-actions">
            <button class="log-overlay-btn clear" title="Clear logs">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
            </button>
            <button class="log-overlay-btn minimize" title="Minimize">
              <svg width="10" height="2" viewBox="0 0 10 2" fill="currentColor"><rect width="10" height="2" rx="1"></rect></svg>
            </button>
            <button class="log-overlay-btn close" title="Close">
               <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
            </button>
          </div>
        </div>
        <div class="log-overlay-content">
          <div class="log-overlay-empty">Waiting for events...</div>
        </div>
      </div>
    `;

    contentDiv = container.querySelector('.log-overlay-content');

    // Event listeners
    container.querySelector('.log-overlay-btn.clear').addEventListener('click', clearLogs);
    container.querySelector('.log-overlay-btn.minimize').addEventListener('click', toggleMinimize);
    container.querySelector('.log-overlay-btn.close').addEventListener('click', () => hide()); // Close just hides it

    // Dragging
    const header = container.querySelector('.log-overlay-header');
    header.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);

    document.body.appendChild(container);
  }

  function toggleMinimize() {
    if (!container) return;
    isMinimized = !isMinimized;
    if (isMinimized) {
      container.classList.add('minimized');
    } else {
      container.classList.remove('minimized');
    }
  }

  function startDrag(e) {
    if (e.target.closest('.log-overlay-btn')) return;
    isDragging = true;
    const rect = container.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    container.style.transition = 'none';
  }

  function onDrag(e) {
    if (!isDragging) return;
    container.style.left = `${e.clientX - dragOffset.x}px`;
    container.style.top = `${e.clientY - dragOffset.y}px`;
    container.style.right = 'auto';
    container.style.bottom = 'auto';
  }

  function stopDrag() {
    if (!isDragging) return;
    isDragging = false;
    container.style.transition = '';
  }

  // ==================== Actions ====================

  function init() {
    createOverlay();
    show();
  }

  function show() {
    if (!container) createOverlay();
    container.classList.remove('hidden');
    isVisible = true;
  }

  function hide() {
    if (container) {
      container.classList.add('hidden');
      isVisible = false;
    }
  }

  function destroy() {
    if (container) {
      container.remove();
      container = null;
      contentDiv = null;
    }
    logs = [];
    isVisible = false;
  }

  function clearLogs() {
    logs = [];
    if (contentDiv) {
      contentDiv.innerHTML = '<div class="log-overlay-empty">No logs yet</div>';
    }
  }

  function appendLog(text, level = 'info') {
    if (!container) createOverlay();
    if (!isVisible) show();

    const entry = {
      text,
      level,
      time: new Date(),
    };
    logs.push(entry);

    // Trim old logs
    if (logs.length > CONFIG.maxLogs) {
      logs = logs.slice(-CONFIG.maxLogs);
    }

    renderLogs();
  }

  function renderLogs() {
    if (!contentDiv) return;

    if (logs.length === 0) {
      contentDiv.innerHTML = '<div class="log-overlay-empty">No logs yet</div>';
      return;
    }

    contentDiv.innerHTML = logs.map(log => `
      <div class="log-overlay-entry ${log.level}">
        <span class="icon">${getIcon(log.level)}</span>
        <span class="text">${escapeHtml(log.text)}</span>
        <span class="time">${formatTime(log.time)}</span>
      </div>
    `).join('');

    // Auto-scroll to bottom
    contentDiv.scrollTop = contentDiv.scrollHeight;
  }

  // ==================== Message Handler ====================

  function handleMessage(message, sender, sendResponse) {
    if (message.action !== 'log_overlay') return;

    try {
      switch (message.cmd) {
        case 'init':
          init();
          break;
        case 'show':
          show();
          break;
        case 'hide':
          hide();
          break;
        case 'destroy':
          destroy();
          break;
        case 'clear':
          clearLogs();
          break;
        case 'append':
          appendLog(message.text || '', message.level || 'info');
          break;
        case 'done':
          // Mark as completed - change header color or indicator
          if (container) {
            const title = container.querySelector('.log-overlay-title');
            if (title) {
              title.innerHTML = '<span style="color: #22c55e;">✓</span> Completed';
            }
          }
          break;
        default:
          console.warn('[LogOverlay] Unknown command:', message.cmd);
      }
      sendResponse?.({ ok: true });
    } catch (e) {
      console.error('[LogOverlay] Error:', e);
      sendResponse?.({ ok: false, error: e.message });
    }

    return true;
  }

  // Register message listener
  chrome.runtime.onMessage.addListener(handleMessage);

  // Expose global API for direct use from page scripts
  window.__LogOverlay = {
    init,
    show,
    hide,
    destroy,
    clear: clearLogs,
    append: appendLog,
  };

  console.log('[LogOverlay] Initialized and ready');
})();
