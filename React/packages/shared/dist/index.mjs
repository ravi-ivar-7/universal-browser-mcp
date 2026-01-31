// src/constants.ts
var DEFAULT_SERVER_PORT = 12306;
var HOST_NAME = "com.chromemcp.nativehost";

// src/types.ts
var NativeMessageType = /* @__PURE__ */ ((NativeMessageType2) => {
  NativeMessageType2["START"] = "start";
  NativeMessageType2["STARTED"] = "started";
  NativeMessageType2["STOP"] = "stop";
  NativeMessageType2["STOPPED"] = "stopped";
  NativeMessageType2["PING"] = "ping";
  NativeMessageType2["PONG"] = "pong";
  NativeMessageType2["ERROR"] = "error";
  NativeMessageType2["PROCESS_DATA"] = "process_data";
  NativeMessageType2["PROCESS_DATA_RESPONSE"] = "process_data_response";
  NativeMessageType2["CALL_TOOL"] = "call_tool";
  NativeMessageType2["CALL_TOOL_RESPONSE"] = "call_tool_response";
  NativeMessageType2["SERVER_STARTED"] = "server_started";
  NativeMessageType2["SERVER_STOPPED"] = "server_stopped";
  NativeMessageType2["ERROR_FROM_NATIVE_HOST"] = "error_from_native_host";
  NativeMessageType2["CONNECT_NATIVE"] = "connectNative";
  NativeMessageType2["ENSURE_NATIVE"] = "ensure_native";
  NativeMessageType2["PING_NATIVE"] = "ping_native";
  NativeMessageType2["DISCONNECT_NATIVE"] = "disconnect_native";
  return NativeMessageType2;
})(NativeMessageType || {});

// src/tools.ts
var TOOL_NAMES = {
  BROWSER: {
    GET_WINDOWS_AND_TABS: "get_windows_and_tabs",
    SEARCH_TABS_CONTENT: "search_tabs_content",
    NAVIGATE: "chrome_navigate",
    SCREENSHOT: "chrome_screenshot",
    CLOSE_TABS: "chrome_close_tabs",
    SWITCH_TAB: "chrome_switch_tab",
    WEB_FETCHER: "chrome_get_web_content",
    CLICK: "chrome_click_element",
    FILL: "chrome_fill_or_select",
    REQUEST_ELEMENT_SELECTION: "chrome_request_element_selection",
    GET_INTERACTIVE_ELEMENTS: "chrome_get_interactive_elements",
    NETWORK_CAPTURE: "chrome_network_capture",
    // Legacy tool names (kept for internal use, not exposed in TOOL_SCHEMAS)
    NETWORK_CAPTURE_START: "chrome_network_capture_start",
    NETWORK_CAPTURE_STOP: "chrome_network_capture_stop",
    NETWORK_REQUEST: "chrome_network_request",
    NETWORK_DEBUGGER_START: "chrome_network_debugger_start",
    NETWORK_DEBUGGER_STOP: "chrome_network_debugger_stop",
    KEYBOARD: "chrome_keyboard",
    HISTORY: "chrome_history",
    BOOKMARK_SEARCH: "chrome_bookmark_search",
    BOOKMARK_ADD: "chrome_bookmark_add",
    BOOKMARK_DELETE: "chrome_bookmark_delete",
    INJECT_SCRIPT: "chrome_inject_script",
    SEND_COMMAND_TO_INJECT_SCRIPT: "chrome_send_command_to_inject_script",
    JAVASCRIPT: "chrome_javascript",
    CONSOLE: "chrome_console",
    FILE_UPLOAD: "chrome_upload_file",
    READ_PAGE: "chrome_read_page",
    COMPUTER: "chrome_computer",
    HANDLE_DIALOG: "chrome_handle_dialog",
    HANDLE_DOWNLOAD: "chrome_handle_download",
    USERSCRIPT: "chrome_userscript",
    PERFORMANCE_START_TRACE: "performance_start_trace",
    PERFORMANCE_STOP_TRACE: "performance_stop_trace",
    PERFORMANCE_ANALYZE_INSIGHT: "performance_analyze_insight",
    GIF_RECORDER: "chrome_gif_recorder"
  },
  RECORD_REPLAY: {
    FLOW_RUN: "record_replay_flow_run",
    LIST_PUBLISHED: "record_replay_list_published"
  }
};
var TOOL_SCHEMAS = [
  {
    name: TOOL_NAMES.BROWSER.GET_WINDOWS_AND_TABS,
    description: "Get all currently open browser windows and tabs",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  // {
  //   name: TOOL_NAMES.RECORD_REPLAY.FLOW_RUN,
  //   description:
  //     'Run a recorded flow by ID with optional variables and run options. Returns a standardized run result.',
  //   inputSchema: {
  //     type: 'object',
  //     properties: {
  //       flowId: { type: 'string', description: 'ID of the flow to run' },
  //       args: {
  //         type: 'object',
  //         description: 'Variable values for the flow (flat object of key/value)',
  //       },
  //       tabTarget: {
  //         type: 'string',
  //         description: "Target tab: 'current' or 'new' (default: current)",
  //         enum: ['current', 'new'],
  //       },
  //       refresh: { type: 'boolean', description: 'Refresh before running (default false)' },
  //       captureNetwork: {
  //         type: 'boolean',
  //         description: 'Capture network snippets for debugging (default false)',
  //       },
  //       returnLogs: { type: 'boolean', description: 'Return run logs (default false)' },
  //       timeoutMs: { type: 'number', description: 'Global timeout in ms (optional)' },
  //       startUrl: { type: 'string', description: 'Optional start URL to open before running' },
  //     },
  //     required: ['flowId'],
  //   },
  // },
  // {
  //   name: TOOL_NAMES.RECORD_REPLAY.LIST_PUBLISHED,
  //   description: 'List published flows available as dynamic tools (for discovery).',
  //   inputSchema: {
  //     type: 'object',
  //     properties: {},
  //     required: [],
  //   },
  // },
  {
    name: TOOL_NAMES.BROWSER.PERFORMANCE_START_TRACE,
    description: "Starts a performance trace recording on the selected page. Optionally reloads the page and/or auto-stops after a short duration.",
    inputSchema: {
      type: "object",
      properties: {
        reload: {
          type: "boolean",
          description: "Determines if, once tracing has started, the page should be automatically reloaded (ignore cache)."
        },
        autoStop: {
          type: "boolean",
          description: "Determines if the trace should be automatically stopped (default false)."
        },
        durationMs: {
          type: "number",
          description: "Auto-stop duration in milliseconds when autoStop is true (default 5000)."
        }
      },
      required: []
    }
  },
  {
    name: TOOL_NAMES.BROWSER.PERFORMANCE_STOP_TRACE,
    description: "Stops the active performance trace recording on the selected page.",
    inputSchema: {
      type: "object",
      properties: {
        saveToDownloads: {
          type: "boolean",
          description: "Whether to save the trace as a JSON file in Downloads (default true)."
        },
        filenamePrefix: {
          type: "string",
          description: "Optional filename prefix for the downloaded trace JSON."
        }
      },
      required: []
    }
  },
  {
    name: TOOL_NAMES.BROWSER.PERFORMANCE_ANALYZE_INSIGHT,
    description: "Provides a lightweight summary of the last recorded trace. For deep insights (CWV, breakdowns), integrate native-side DevTools trace engine.",
    inputSchema: {
      type: "object",
      properties: {
        insightName: {
          type: "string",
          description: 'Optional insight name for future deep analysis (e.g., "DocumentLatency"). Currently informational only.'
        },
        timeoutMs: {
          type: "number",
          description: "Timeout for deep analysis via native host (milliseconds). Default 60000. Increase for large traces."
        }
      },
      required: []
    }
  },
  {
    name: TOOL_NAMES.BROWSER.READ_PAGE,
    description: `Get an accessibility tree representation of visible elements on the page. Only returns elements that are visible in the viewport. Optionally filter for only interactive elements.
Tip: If the returned elements do not include the specific element you need, use the computer tool's screenshot (action="screenshot") to capture the element's on-screen coordinates, then operate by coordinates.`,
    inputSchema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          description: 'Filter elements: "interactive" for such as  buttons/links/inputs only (default: all visible elements)'
        },
        depth: {
          type: "number",
          description: "Maximum DOM depth to traverse (integer >= 0). Lower values reduce output size and can improve performance."
        },
        refId: {
          type: "string",
          description: 'Focus on the subtree rooted at this element refId (e.g., "ref_12"). The refId must come from a recent chrome_read_page response in the same tab (refs may expire).'
        },
        tabId: {
          type: "number",
          description: "Target an existing tab by ID (default: active tab)."
        },
        windowId: {
          type: "number",
          description: "Target window ID to pick active tab when tabId is omitted."
        }
      },
      required: []
    }
  },
  {
    name: TOOL_NAMES.BROWSER.COMPUTER,
    description: "Use a mouse and keyboard to interact with a web browser, and take screenshots.\n* Whenever you intend to click on an element like an icon, you should consult a read_page to determine the ref of the element before moving the cursor.\n* If you tried clicking on a program or link but it failed to load, even after waiting, try screenshot and then adjusting your click location so that the tip of the cursor visually falls on the element that you want to click.\n* Make sure to click any buttons, links, icons, etc with the cursor tip in the center of the element. Don't click boxes on their edges unless asked.",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: "number", description: "Target tab ID (default: active tab)" },
        background: {
          type: "boolean",
          description: "Avoid focusing/activating tab/window for certain operations (best-effort). Default: false"
        },
        action: {
          type: "string",
          description: "Action to perform: left_click | right_click | double_click | triple_click | left_click_drag | scroll | scroll_to | type | key | fill | fill_form | hover | wait | resize_page | zoom | screenshot"
        },
        ref: {
          type: "string",
          description: "Element ref from chrome_read_page. For click/scroll/scroll_to/key/type and drag end when provided; takes precedence over coordinates."
        },
        coordinates: {
          type: "object",
          properties: {
            x: { type: "number", description: "X coordinate" },
            y: { type: "number", description: "Y coordinate" }
          },
          description: "Coordinates for actions (in screenshot space if a recent screenshot was taken, otherwise viewport). Required for click/scroll and as end point for drag."
        },
        startCoordinates: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" }
          },
          description: "Starting coordinates for drag action"
        },
        startRef: {
          type: "string",
          description: "Drag start ref from chrome_read_page (alternative to startCoordinates)."
        },
        scrollDirection: {
          type: "string",
          description: "Scroll direction: up | down | left | right"
        },
        scrollAmount: {
          type: "number",
          description: "Scroll ticks (1-10), default 3"
        },
        text: {
          type: "string",
          description: 'Text to type (for action=type) or keys/chords separated by space (for action=key, e.g. "Backspace Enter" or "cmd+a")'
        },
        repeat: {
          type: "number",
          description: "For action=key: number of times to repeat the key sequence (integer 1-100, default 1)."
        },
        modifiers: {
          type: "object",
          description: "Modifier keys for click actions (left_click/right_click/double_click/triple_click).",
          properties: {
            altKey: { type: "boolean" },
            ctrlKey: { type: "boolean" },
            metaKey: { type: "boolean" },
            shiftKey: { type: "boolean" }
          }
        },
        region: {
          type: "object",
          description: "For action=zoom: rectangular region to capture (x0,y0)-(x1,y1) in viewport pixels (or screenshot-space if a recent screenshot context exists).",
          properties: {
            x0: { type: "number" },
            y0: { type: "number" },
            x1: { type: "number" },
            y1: { type: "number" }
          },
          required: ["x0", "y0", "x1", "y1"]
        },
        // For action=fill
        selector: {
          type: "string",
          description: "CSS selector for fill (alternative to ref)."
        },
        value: {
          oneOf: [{ type: "string" }, { type: "boolean" }, { type: "number" }],
          description: "Value to set for action=fill (string | boolean | number)"
        },
        elements: {
          type: "array",
          description: "For action=fill_form: list of elements to fill (ref + value)",
          items: {
            type: "object",
            properties: {
              ref: { type: "string", description: "Element ref from chrome_read_page" },
              value: { type: "string", description: "Value to set (stringified if non-string)" }
            },
            required: ["ref", "value"]
          }
        },
        width: { type: "number", description: "For action=resize_page: viewport width" },
        height: { type: "number", description: "For action=resize_page: viewport height" },
        appear: {
          type: "boolean",
          description: "For action=wait with text: whether to wait for the text to appear (true, default) or disappear (false)"
        },
        timeout: {
          type: "number",
          description: "For action=wait with text: timeout in milliseconds (default 10000, max 120000)"
        },
        duration: {
          type: "number",
          description: "Seconds to wait for action=wait (max 30s)"
        }
      },
      required: ["action"]
    }
  },
  // {
  //   name: TOOL_NAMES.BROWSER.USERSCRIPT,
  //   description:
  //     'Unified userscript tool (create/list/get/enable/disable/update/remove/send_command/export). Paste JS/CSS/Tampermonkey script and the system will auto-select the best strategy (insertCSS / persistent script in ISOLATED or MAIN world / once by CDP) with CSP-aware fallbacks.',
  //   inputSchema: {
  //     type: 'object',
  //     properties: {
  //       action: {
  //         type: 'string',
  //         description:
  //           'Operation to perform',
  //         enum: [
  //           'create',
  //           'list',
  //           'get',
  //           'enable',
  //           'disable',
  //           'update',
  //           'remove',
  //           'send_command',
  //           'export',
  //         ],
  //       },
  //       args: {
  //         type: 'object',
  //         description:
  //           'Arguments for the specified action.\n- create: { script (required), name?, description?, matches?: string[], excludes?: string[], persist?: boolean (default true), runAt?: "document_start"|"document_end"|"document_idle"|"auto", world?: "auto"|"ISOLATED"|"MAIN", allFrames?: boolean (default true), mode?: "auto"|"css"|"persistent"|"once", dnrFallback?: boolean (default true), tags?: string[] }\n- list: { query?: string, status?: "enabled"|"disabled", domain?: string }\n- get: { id (required) }\n- enable/disable: { id (required) }\n- update: { id (required), script?, name?, description?, matches?, excludes?, runAt?, world?, allFrames?, persist?, dnrFallback?, tags? }\n- remove: { id (required) }\n- send_command: { id (required), payload?: string, tabId?: number }\n- export: {}\nTip: For a one-off execution that returns a value, use create with args.mode="once". The returned value is included as onceResult in the tool response.',
  //         properties: {
  //           // Common identifiers
  //           id: { type: 'string', description: 'Userscript id (for get/enable/disable/update/remove/send_command)' },
  //           // Create / Update fields
  //           script: { type: 'string', description: 'JS/CSS/Tampermonkey script source (required for create)' },
  //           name: { type: 'string', description: 'Userscript name (optional)' },
  //           description: { type: 'string', description: 'Userscript description (optional)' },
  //           matches: {
  //             type: 'array',
  //             items: { type: 'string' },
  //             description: 'Match patterns for pages to apply to (e.g., https://*.example.com/*)'
  //           },
  //           excludes: {
  //             type: 'array',
  //             items: { type: 'string' },
  //             description: 'Exclude patterns'
  //           },
  //           persist: { type: 'boolean', description: 'Persist userscript for matched pages (default true)' },
  //           runAt: {
  //             type: 'string',
  //             description: 'Injection timing',
  //             enum: ['document_start', 'document_end', 'document_idle', 'auto'],
  //           },
  //           world: {
  //             type: 'string',
  //             description: 'Execution world',
  //             enum: ['auto', 'ISOLATED', 'MAIN'],
  //           },
  //           allFrames: { type: 'boolean', description: 'Inject into all frames (default true)' },
  //           mode: {
  //             type: 'string',
  //             description:
  //               'Injection strategy: auto | css | persistent | once. Use once to evaluate immediately (no persistence) and include the return value in onceResult.',
  //             enum: ['auto', 'css', 'persistent', 'once'],
  //           },
  //           dnrFallback: { type: 'boolean', description: 'Use DNR fallback when needed (default true)' },
  //           tags: { type: 'array', items: { type: 'string' }, description: 'Custom tags' },
  //           // List filters
  //           query: { type: 'string', description: 'Search by name/description (list action)' },
  //           status: { type: 'string', enum: ['enabled', 'disabled'], description: 'Filter by status (list action)' },
  //           domain: { type: 'string', description: 'Filter by domain (list action)' },
  //           // Send command
  //           payload: { type: 'string', description: 'Arbitrary payload (stringified) for send_command' },
  //           tabId: { type: 'number', description: 'Target tab for send_command (default active tab)' },
  //         },
  //       },
  //     },
  //     required: ['action'],
  //   },
  // },
  {
    name: TOOL_NAMES.BROWSER.NAVIGATE,
    description: "Navigate to a URL, refresh the current tab, or navigate browser history (back/forward)",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: 'URL to navigate to. Special values: "back" or "forward" to navigate browser history in the target tab.'
        },
        newWindow: {
          type: "boolean",
          description: "Create a new window to navigate to the URL or not. Defaults to false"
        },
        tabId: {
          type: "number",
          description: "Target an existing tab by ID (if provided, navigate/refresh/back/forward that tab instead of the active tab)."
        },
        windowId: {
          type: "number",
          description: "Target an existing window by ID (when creating a new tab in existing window, or picking active tab if tabId is not provided)."
        },
        background: {
          type: "boolean",
          description: "Perform the operation without stealing focus (do not activate the tab or focus the window). Default: false"
        },
        width: {
          type: "number",
          description: "Window width in pixels (default: 1280). When width or height is provided, a new window will be created."
        },
        height: {
          type: "number",
          description: "Window height in pixels (default: 720). When width or height is provided, a new window will be created."
        },
        refresh: {
          type: "boolean",
          description: "Refresh the current active tab instead of navigating to a URL. When true, the url parameter is ignored. Defaults to false"
        }
      },
      required: []
    }
  },
  {
    name: TOOL_NAMES.BROWSER.SCREENSHOT,
    description: '[Prefer read_page over taking a screenshot and Prefer chrome_computer] Take a screenshot of the current page or a specific element. For new usage, use chrome_computer with action="screenshot". Use this tool if you need advanced options.',
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name for the screenshot, if saving as PNG" },
        selector: { type: "string", description: "CSS selector for element to screenshot" },
        tabId: {
          type: "number",
          description: "Target tab ID to capture from (default: active tab)."
        },
        windowId: {
          type: "number",
          description: "Target window ID to pick active tab from when tabId is not provided."
        },
        background: {
          type: "boolean",
          description: "Attempt capture without bringing tab/window to foreground. CDP-based capture is used for simple viewport captures. For element/full-page capture, the tab may still be made active in its window without focusing the window. Default: false"
        },
        width: { type: "number", description: "Width in pixels (default: 800)" },
        height: { type: "number", description: "Height in pixels (default: 600)" },
        storeBase64: {
          type: "boolean",
          description: "return screenshot in base64 format (default: false) if you want to see the page, recommend set this to be true"
        },
        fullPage: {
          type: "boolean",
          description: "Store screenshot of the entire page (default: true)"
        },
        savePng: {
          type: "boolean",
          description: "Save screenshot as PNG file (default: true)\uFF0Cif you want to see the page, recommend set this to be false, and set storeBase64 to be true"
        }
      },
      required: []
    }
  },
  {
    name: TOOL_NAMES.BROWSER.CLOSE_TABS,
    description: "Close one or more browser tabs",
    inputSchema: {
      type: "object",
      properties: {
        tabIds: {
          type: "array",
          items: { type: "number" },
          description: "Array of tab IDs to close. If not provided, will close the active tab."
        },
        url: {
          type: "string",
          description: "Close tabs matching this URL. Can be used instead of tabIds."
        }
      },
      required: []
    }
  },
  {
    name: TOOL_NAMES.BROWSER.SWITCH_TAB,
    description: "Switch to a specific browser tab",
    inputSchema: {
      type: "object",
      properties: {
        tabId: {
          type: "number",
          description: "The ID of the tab to switch to."
        },
        windowId: {
          type: "number",
          description: "The ID of the window where the tab is located."
        }
      },
      required: ["tabId"]
    }
  },
  {
    name: TOOL_NAMES.BROWSER.WEB_FETCHER,
    description: "Fetch content from a web page",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to fetch content from. If not provided, uses the current active tab"
        },
        tabId: {
          type: "number",
          description: "Target an existing tab by ID (default: active tab)."
        },
        background: {
          type: "boolean",
          description: "Do not activate tab/focus window while fetching (default: false)"
        },
        htmlContent: {
          type: "boolean",
          description: "Get the visible HTML content of the page. If true, textContent will be ignored (default: false)"
        },
        textContent: {
          type: "boolean",
          description: "Get the visible text content of the page with metadata. Ignored if htmlContent is true (default: true)"
        },
        selector: {
          type: "string",
          description: "CSS selector to get content from a specific element. If provided, only content from this element will be returned"
        }
      },
      required: []
    }
  },
  {
    name: TOOL_NAMES.BROWSER.NETWORK_REQUEST,
    description: "Send a network request from the browser with cookies and other browser context",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to send the request to"
        },
        method: {
          type: "string",
          description: "HTTP method to use (default: GET)"
        },
        headers: {
          type: "object",
          description: "Headers to include in the request"
        },
        body: {
          type: "string",
          description: "Body of the request (for POST, PUT, etc.)"
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default: 30000)"
        },
        formData: {
          type: "object",
          description: "Multipart/form-data descriptor. If provided, overrides body and builds FormData with optional file attachments. Shape: { fields?: Record<string,string|number|boolean>, files?: Array<{ name: string, fileUrl?: string, filePath?: string, base64Data?: string, filename?: string, contentType?: string }> }. Also supports a compact array form: [ [name, fileSpec, filename?], ... ] where fileSpec may be url:, file:, or base64:."
        }
      },
      required: ["url"]
    }
  },
  {
    name: TOOL_NAMES.BROWSER.NETWORK_CAPTURE,
    description: 'Unified network capture tool. Use action="start" to begin capturing, action="stop" to end and retrieve results. Set needResponseBody=true to capture response bodies (uses Debugger API, may conflict with DevTools). Default mode uses webRequest API (lightweight, no debugger conflict, but no response body).',
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["start", "stop"],
          description: 'Action to perform: "start" begins capture, "stop" ends and returns results'
        },
        needResponseBody: {
          type: "boolean",
          description: "When true, captures response body using Debugger API (default: false). Only use when you need to inspect response content."
        },
        url: {
          type: "string",
          description: 'URL to capture network requests from. For action="start". If not provided, uses the current active tab.'
        },
        maxCaptureTime: {
          type: "number",
          description: "Maximum capture time in milliseconds (default: 180000)"
        },
        inactivityTimeout: {
          type: "number",
          description: "Stop after inactivity in milliseconds (default: 60000). Set 0 to disable."
        },
        includeStatic: {
          type: "boolean",
          description: "Include static resources like images/scripts/styles (default: false)"
        }
      },
      required: ["action"]
    }
  },
  {
    name: TOOL_NAMES.BROWSER.HANDLE_DOWNLOAD,
    description: "Wait for a browser download and return details (id, filename, url, state, size)",
    inputSchema: {
      type: "object",
      properties: {
        filenameContains: { type: "string", description: "Filter by substring in filename or URL" },
        timeoutMs: { type: "number", description: "Timeout in ms (default 60000, max 300000)" },
        waitForComplete: { type: "boolean", description: "Wait until completed (default true)" }
      },
      required: []
    }
  },
  {
    name: TOOL_NAMES.BROWSER.HISTORY,
    description: "Retrieve and search browsing history from Chrome",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to search for in history URLs and titles. Leave empty to retrieve all history entries within the time range."
        },
        startTime: {
          type: "string",
          description: 'Start time as a date string. Supports ISO format (e.g., "2023-10-01", "2023-10-01T14:30:00"), relative times (e.g., "1 day ago", "2 weeks ago", "3 months ago", "1 year ago"), and special keywords ("now", "today", "yesterday"). Default: 24 hours ago'
        },
        endTime: {
          type: "string",
          description: 'End time as a date string. Supports ISO format (e.g., "2023-10-31", "2023-10-31T14:30:00"), relative times (e.g., "1 day ago", "2 weeks ago", "3 months ago", "1 year ago"), and special keywords ("now", "today", "yesterday"). Default: current time'
        },
        maxResults: {
          type: "number",
          description: "Maximum number of history entries to return. Use this to limit results for performance or to focus on the most relevant entries. (default: 100)"
        },
        excludeCurrentTabs: {
          type: "boolean",
          description: "When set to true, filters out URLs that are currently open in any browser tab. Useful for finding pages you've visited but don't have open anymore. (default: false)"
        }
      },
      required: []
    }
  },
  {
    name: TOOL_NAMES.BROWSER.BOOKMARK_SEARCH,
    description: "Search Chrome bookmarks by title and URL",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query to match against bookmark titles and URLs. Leave empty to retrieve all bookmarks."
        },
        maxResults: {
          type: "number",
          description: "Maximum number of bookmarks to return (default: 50)"
        },
        folderPath: {
          type: "string",
          description: 'Optional folder path or ID to limit search to a specific bookmark folder. Can be a path string (e.g., "Work/Projects") or a folder ID.'
        }
      },
      required: []
    }
  },
  {
    name: TOOL_NAMES.BROWSER.BOOKMARK_ADD,
    description: "Add a new bookmark to Chrome",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to bookmark. If not provided, uses the current active tab URL."
        },
        title: {
          type: "string",
          description: "Title for the bookmark. If not provided, uses the page title from the URL."
        },
        parentId: {
          type: "string",
          description: 'Parent folder path or ID to add the bookmark to. Can be a path string (e.g., "Work/Projects") or a folder ID. If not provided, adds to the "Bookmarks Bar" folder.'
        },
        createFolder: {
          type: "boolean",
          description: "Whether to create the parent folder if it does not exist (default: false)"
        }
      },
      required: []
    }
  },
  {
    name: TOOL_NAMES.BROWSER.BOOKMARK_DELETE,
    description: "Delete a bookmark from Chrome",
    inputSchema: {
      type: "object",
      properties: {
        bookmarkId: {
          type: "string",
          description: "ID of the bookmark to delete. Either bookmarkId or url must be provided."
        },
        url: {
          type: "string",
          description: "URL of the bookmark to delete. Used if bookmarkId is not provided."
        },
        title: {
          type: "string",
          description: "Title of the bookmark to help with matching when deleting by URL."
        }
      },
      required: []
    }
  },
  // {
  //   name: TOOL_NAMES.BROWSER.SEARCH_TABS_CONTENT,
  //   description:
  //     'search for related content from the currently open tab and return the corresponding web pages.',
  //   inputSchema: {
  //     type: 'object',
  //     properties: {
  //       query: {
  //         type: 'string',
  //         description: 'the query to search for related content.',
  //       },
  //     },
  //     required: ['query'],
  //   },
  // },
  // {
  //   name: TOOL_NAMES.BROWSER.INJECT_SCRIPT,
  //   description:
  //     'inject the user-specified content script into the webpage. By default, inject into the currently active tab',
  //   inputSchema: {
  //     type: 'object',
  //     properties: {
  //       url: {
  //         type: 'string',
  //         description:
  //           'If a URL is specified, inject the script into the webpage corresponding to the URL.',
  //       },
  //       tabId: {
  //         type: 'number',
  //         description:
  //           'Target an existing tab by ID to inject into. Overrides url/active tab selection when provided.',
  //       },
  //       windowId: {
  //         type: 'number',
  //         description:
  //           'Target window ID for selecting active tab or creating new tab when url is provided and tabId is omitted.',
  //       },
  //       background: {
  //         type: 'boolean',
  //         description:
  //           'Do not activate tab/focus window during injection when true (default: false).',
  //       },
  //       type: {
  //         type: 'string',
  //         description:
  //           'the javaScript world for a script to execute within. must be ISOLATED or MAIN',
  //       },
  //       jsScript: {
  //         type: 'string',
  //         description: 'the content script to inject',
  //       },
  //     },
  //     required: ['type', 'jsScript'],
  //   },
  // },
  // {
  //   name: TOOL_NAMES.BROWSER.SEND_COMMAND_TO_INJECT_SCRIPT,
  //   description:
  //     'if the script injected using chrome_inject_script listens for user-defined events, this tool can be used to trigger those events',
  //   inputSchema: {
  //     type: 'object',
  //     properties: {
  //       tabId: {
  //         type: 'number',
  //         description:
  //           'the tab where you previously injected the script(if not provided,  use the currently active tab)',
  //       },
  //       eventName: {
  //         type: 'string',
  //         description: 'the eventName your injected content script listen for',
  //       },
  //       payload: {
  //         type: 'string',
  //         description: 'the payload passed to event, must be a json string',
  //       },
  //     },
  //     required: ['eventName'],
  //   },
  // },
  {
    name: TOOL_NAMES.BROWSER.JAVASCRIPT,
    description: "Execute JavaScript code in a browser tab and return the result. Uses CDP Runtime.evaluate with awaitPromise and returnByValue; automatically falls back to chrome.scripting.executeScript if the debugger is busy. Output is sanitized (sensitive data redacted) and truncated by default.",
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: 'JavaScript code to execute. Runs inside an async function body, so top-level await and "return ..." are supported.'
        },
        tabId: {
          type: "number",
          description: "Target tab ID. If omitted, uses the current active tab."
        },
        timeoutMs: {
          type: "number",
          description: "Execution timeout in milliseconds (default: 15000)."
        },
        maxOutputBytes: {
          type: "number",
          description: "Maximum output size in bytes after sanitization (default: 51200). Output exceeding this limit will be truncated."
        }
      },
      required: ["code"]
    }
  },
  {
    name: TOOL_NAMES.BROWSER.CLICK,
    description: "Click on an element in a web page. Supports multiple targeting methods: CSS selector, XPath, element ref (from chrome_read_page), or viewport coordinates. More focused than chrome_computer for simple click operations.",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector or XPath for the element to click."
        },
        selectorType: {
          type: "string",
          enum: ["css", "xpath"],
          description: 'Type of selector (default: "css").'
        },
        ref: {
          type: "string",
          description: "Element ref from chrome_read_page (takes precedence over selector)."
        },
        coordinates: {
          type: "object",
          description: "Viewport coordinates to click at.",
          properties: {
            x: { type: "number" },
            y: { type: "number" }
          },
          required: ["x", "y"]
        },
        double: {
          type: "boolean",
          description: "Perform double click when true (default: false)."
        },
        button: {
          type: "string",
          enum: ["left", "right", "middle"],
          description: 'Mouse button to click (default: "left").'
        },
        modifiers: {
          type: "object",
          description: "Modifier keys to hold during click.",
          properties: {
            altKey: { type: "boolean" },
            ctrlKey: { type: "boolean" },
            metaKey: { type: "boolean" },
            shiftKey: { type: "boolean" }
          }
        },
        waitForNavigation: {
          type: "boolean",
          description: "Wait for navigation to complete after click (default: false)."
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds for waiting (default: 5000)."
        },
        tabId: {
          type: "number",
          description: "Target tab ID. If omitted, uses the current active tab."
        },
        windowId: {
          type: "number",
          description: "Window ID to select active tab from (when tabId is omitted)."
        },
        frameId: {
          type: "number",
          description: "Target frame ID for iframe support."
        }
      },
      required: []
    }
  },
  {
    name: TOOL_NAMES.BROWSER.FILL,
    description: "Fill or select a form element on a web page. Supports input, textarea, select, checkbox, and radio elements. Use CSS selector, XPath, or element ref to target the element.",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector or XPath for the form element."
        },
        selectorType: {
          type: "string",
          enum: ["css", "xpath"],
          description: 'Type of selector (default: "css").'
        },
        ref: {
          type: "string",
          description: "Element ref from chrome_read_page (takes precedence over selector)."
        },
        value: {
          type: ["string", "number", "boolean"],
          description: "Value to fill. For text inputs: string. For checkboxes/radios: boolean. For selects: option value or text."
        },
        tabId: {
          type: "number",
          description: "Target tab ID. If omitted, uses the current active tab."
        },
        windowId: {
          type: "number",
          description: "Window ID to select active tab from (when tabId is omitted)."
        },
        frameId: {
          type: "number",
          description: "Target frame ID for iframe support."
        }
      },
      required: ["value"]
    }
  },
  {
    name: TOOL_NAMES.BROWSER.REQUEST_ELEMENT_SELECTION,
    description: "Request the user to manually select one or more elements on the current page. Use this as a human-in-the-loop fallback when you cannot reliably locate the target element after approximately 3 attempts using chrome_read_page combined with chrome_click_element/chrome_fill_or_select/chrome_computer. The user will see a panel with instructions and can click on the requested elements. Returns element refs compatible with chrome_click_element/chrome_fill_or_select (including iframe frameId for cross-frame support).",
    inputSchema: {
      type: "object",
      properties: {
        requests: {
          type: "array",
          description: "A list of element selection requests. Each request produces exactly one picked element. The user will see these requests in a panel and select each element by clicking on the page.",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: 'Optional stable request id for correlation. If omitted, an id is auto-generated (e.g., "req_1").'
              },
              name: {
                type: "string",
                description: 'Short label shown to the user describing what element to select (e.g., "Login button", "Email input field").'
              },
              description: {
                type: "string",
                description: 'Optional longer instruction shown to the user with more context (e.g., "Click on the primary login button in the top-right corner").'
              }
            },
            required: ["name"]
          }
        },
        timeoutMs: {
          type: "number",
          description: "Timeout in milliseconds for the user to complete all selections. Default: 180000 (3 minutes). Maximum: 600000 (10 minutes)."
        },
        tabId: {
          type: "number",
          description: "Target tab ID. If omitted, uses the current active tab."
        },
        windowId: {
          type: "number",
          description: "Window ID to select active tab from (when tabId is omitted)."
        }
      },
      required: ["requests"]
    }
  },
  {
    name: TOOL_NAMES.BROWSER.KEYBOARD,
    description: "Simulate keyboard input on a web page. Supports single keys (Enter, Tab, Escape), key combinations (Ctrl+C, Ctrl+V), and text input. Can target a specific element or send to the focused element.",
    inputSchema: {
      type: "object",
      properties: {
        keys: {
          type: "string",
          description: 'Keys or key combinations to simulate. Examples: "Enter", "Tab", "Ctrl+C", "Shift+Tab", "Hello World".'
        },
        selector: {
          type: "string",
          description: "CSS selector or XPath for target element to receive keyboard events."
        },
        selectorType: {
          type: "string",
          enum: ["css", "xpath"],
          description: 'Type of selector (default: "css").'
        },
        delay: {
          type: "number",
          description: "Delay between keystrokes in milliseconds (default: 50)."
        },
        tabId: {
          type: "number",
          description: "Target tab ID. If omitted, uses the current active tab."
        },
        windowId: {
          type: "number",
          description: "Window ID to select active tab from (when tabId is omitted)."
        },
        frameId: {
          type: "number",
          description: "Target frame ID for iframe support."
        }
      },
      required: ["keys"]
    }
  },
  {
    name: TOOL_NAMES.BROWSER.CONSOLE,
    description: "Capture console output from a browser tab. Supports snapshot mode (default; one-time capture with ~2s wait) and buffer mode (persistent per-tab buffer you can read/clear instantly without waiting).",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to navigate to and capture console from. If not provided, uses the current active tab"
        },
        tabId: {
          type: "number",
          description: "Target an existing tab by ID (default: active tab)."
        },
        windowId: {
          type: "number",
          description: "Target window ID to pick active tab when tabId is omitted."
        },
        background: {
          type: "boolean",
          description: "Do not activate tab/focus window when capturing via CDP. Default: false"
        },
        includeExceptions: {
          type: "boolean",
          description: "Include uncaught exceptions in the output (default: true)"
        },
        maxMessages: {
          type: "number",
          description: "Maximum number of console messages to capture in snapshot mode (default: 100). If limit is provided, it takes precedence."
        },
        mode: {
          type: "string",
          enum: ["snapshot", "buffer"],
          description: "Console capture mode: snapshot (default; waits ~2s for messages) or buffer (persistent per-tab buffer; reads from memory instantly)."
        },
        buffer: {
          type: "boolean",
          description: 'Alias for mode="buffer" (default: false).'
        },
        clear: {
          type: "boolean",
          description: "Buffer mode only: clear the buffered logs for this tab before reading (default: false). Use clearAfterRead instead to clear after reading (mcp-tools.js style)."
        },
        clearAfterRead: {
          type: "boolean",
          description: "Buffer mode only: clear the buffered logs for this tab AFTER reading, to avoid duplicate messages on subsequent calls (default: false). This matches mcp-tools.js behavior."
        },
        pattern: {
          type: "string",
          description: "Optional regex filter applied to message/exception text. Supports /pattern/flags syntax."
        },
        onlyErrors: {
          type: "boolean",
          description: "Only return error-level console messages (and exceptions when includeExceptions=true). Default: false."
        },
        limit: {
          type: "number",
          description: "Limit returned console messages. In snapshot mode this is an alias for maxMessages; in buffer mode it limits returned messages from the buffer."
        }
      },
      required: []
    }
  },
  {
    name: TOOL_NAMES.BROWSER.FILE_UPLOAD,
    description: "Upload files to web forms with file input elements using Chrome DevTools Protocol",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: "number", description: "Target tab ID (default: active tab)" },
        windowId: {
          type: "number",
          description: "Target window ID to pick active tab when tabId is omitted"
        },
        selector: {
          type: "string",
          description: 'CSS selector for the file input element (input[type="file"])'
        },
        filePath: {
          type: "string",
          description: "Local file path to upload"
        },
        fileUrl: {
          type: "string",
          description: "URL to download file from before uploading"
        },
        base64Data: {
          type: "string",
          description: "Base64 encoded file data to upload"
        },
        fileName: {
          type: "string",
          description: 'Optional filename when using base64 or URL (default: "uploaded-file")'
        },
        multiple: {
          type: "boolean",
          description: "Whether the input accepts multiple files (default: false)"
        }
      },
      required: ["selector"]
    }
  },
  {
    name: TOOL_NAMES.BROWSER.HANDLE_DIALOG,
    description: "Handle JavaScript dialogs (alert/confirm/prompt) via CDP",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "accept | dismiss" },
        promptText: {
          type: "string",
          description: "Optional prompt text when accepting a prompt"
        }
      },
      required: ["action"]
    }
  },
  {
    name: TOOL_NAMES.BROWSER.GIF_RECORDER,
    description: 'Record browser tab activity as an animated GIF.\n\nModes:\n- Fixed FPS mode (action="start"): Captures frames at regular intervals. Good for animations/videos.\n- Auto-capture mode (action="auto_start"): Captures frames automatically when chrome_computer or chrome_navigate actions succeed. Better for interaction recordings with natural pacing.\n\nUse "stop" to end recording and save the GIF.',
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["start", "stop", "status", "auto_start", "capture", "clear", "export"],
          description: 'Action to perform:\n- "start": Begin fixed-FPS recording (captures frames at regular intervals)\n- "auto_start": Begin auto-capture mode (frames captured on tool actions)\n- "stop": End recording and save GIF\n- "status": Get current recording state\n- "capture": Manually trigger a frame capture in auto mode\n- "clear": Clear all recording state and cached GIF without saving\n- "export": Export the last recorded GIF (download or drag&drop upload)'
        },
        tabId: {
          type: "number",
          description: 'Target tab ID (default: active tab). Used with "start"/"auto_start" for recording, and with "export" (download=false) for drag&drop upload target.'
        },
        fps: {
          type: "number",
          description: "Frames per second for fixed-FPS mode (1-30, default: 5). Higher values = smoother but larger file."
        },
        durationMs: {
          type: "number",
          description: "Maximum recording duration in milliseconds (default: 5000, max: 60000). Only for fixed-FPS mode."
        },
        maxFrames: {
          type: "number",
          description: "Maximum number of frames to capture (default: 50 for fixed-FPS, 100 for auto mode, max: 300)."
        },
        width: {
          type: "number",
          description: "Output GIF width in pixels (default: 800, max: 1920)."
        },
        height: {
          type: "number",
          description: "Output GIF height in pixels (default: 600, max: 1080)."
        },
        maxColors: {
          type: "number",
          description: "Maximum colors in palette (default: 256). Lower values = smaller file size."
        },
        filename: {
          type: "string",
          description: "Output filename (without extension). Defaults to timestamped name."
        },
        captureDelayMs: {
          type: "number",
          description: "Auto-capture mode only: Delay in ms after action before capturing frame (default: 150). Allows UI to stabilize."
        },
        frameDelayCs: {
          type: "number",
          description: "Auto-capture mode only: Display duration per frame in centiseconds (default: 20 = 200ms per frame)."
        },
        annotation: {
          type: "string",
          description: 'Auto-capture mode only (action="capture"): Optional text label to render on the captured frame.'
        },
        download: {
          type: "boolean",
          description: "Export action only: Set to true (default) to download the GIF, or false to upload via drag&drop."
        },
        coordinates: {
          type: "object",
          description: "Export action only (when download=false): Target coordinates for drag&drop upload.",
          properties: {
            x: { type: "number" },
            y: { type: "number" }
          },
          required: ["x", "y"]
        },
        ref: {
          type: "string",
          description: "Export action only (when download=false): Element ref from chrome_read_page for drag&drop target."
        },
        selector: {
          type: "string",
          description: "Export action only (when download=false): CSS selector for drag&drop target element."
        },
        enhancedRendering: {
          type: "object",
          description: "Auto-capture mode only: Configure visual overlays for recorded actions (click indicators, drag paths, labels). Pass `true` to enable all defaults.",
          properties: {
            clickIndicators: {
              oneOf: [
                { type: "boolean" },
                {
                  type: "object",
                  properties: {
                    enabled: {
                      type: "boolean",
                      description: "Enable click indicators (default: true)"
                    },
                    color: {
                      type: "string",
                      description: 'CSS color for click indicator (default: "rgba(255, 87, 34, 0.8)")'
                    },
                    radius: { type: "number", description: "Initial radius in px (default: 20)" },
                    animationDurationMs: {
                      type: "number",
                      description: "Animation duration in ms (default: 400)"
                    },
                    animationFrames: {
                      type: "number",
                      description: "Number of animation frames (default: 3)"
                    },
                    animationIntervalMs: {
                      type: "number",
                      description: "Interval between animation frames in ms (default: 80)"
                    }
                  }
                }
              ],
              description: "Click indicator overlay config (true for defaults, or object for custom)."
            },
            dragPaths: {
              oneOf: [
                { type: "boolean" },
                {
                  type: "object",
                  properties: {
                    enabled: {
                      type: "boolean",
                      description: "Enable drag path rendering (default: true)"
                    },
                    color: {
                      type: "string",
                      description: 'CSS color for drag path (default: "rgba(33, 150, 243, 0.7)")'
                    },
                    lineWidth: { type: "number", description: "Line width in px (default: 3)" },
                    lineDash: {
                      type: "array",
                      items: { type: "number" },
                      description: "Dash pattern (default: [6, 4])"
                    },
                    arrowSize: {
                      type: "number",
                      description: "Arrow head size in px (default: 10)"
                    }
                  }
                }
              ],
              description: "Drag path overlay config (true for defaults, or object for custom)."
            },
            labels: {
              oneOf: [
                { type: "boolean" },
                {
                  type: "object",
                  properties: {
                    enabled: {
                      type: "boolean",
                      description: "Enable action labels (default: true)"
                    },
                    font: {
                      type: "string",
                      description: 'Font for labels (default: "bold 12px sans-serif")'
                    },
                    textColor: { type: "string", description: 'Text color (default: "#fff")' },
                    bgColor: {
                      type: "string",
                      description: 'Background color (default: "rgba(0,0,0,0.7)")'
                    },
                    padding: { type: "number", description: "Padding in px (default: 4)" },
                    borderRadius: {
                      type: "number",
                      description: "Border radius in px (default: 4)"
                    },
                    offset: {
                      type: "object",
                      properties: { x: { type: "number" }, y: { type: "number" } },
                      description: "Offset from action position (default: {x: 10, y: -20})"
                    }
                  }
                }
              ],
              description: "Action label overlay config (true for defaults, or object for custom)."
            },
            durationMs: {
              type: "number",
              description: "How long overlays remain visible in ms (default: 1500)."
            }
          }
        }
      },
      required: ["action"]
    }
  }
];

// src/step-types.ts
var STEP_TYPES = {
  CLICK: "click",
  DBLCLICK: "dblclick",
  FILL: "fill",
  TRIGGER_EVENT: "triggerEvent",
  SET_ATTRIBUTE: "setAttribute",
  SCREENSHOT: "screenshot",
  SWITCH_FRAME: "switchFrame",
  LOOP_ELEMENTS: "loopElements",
  KEY: "key",
  SCROLL: "scroll",
  DRAG: "drag",
  WAIT: "wait",
  ASSERT: "assert",
  SCRIPT: "script",
  IF: "if",
  FOREACH: "foreach",
  WHILE: "while",
  NAVIGATE: "navigate",
  HTTP: "http",
  EXTRACT: "extract",
  OPEN_TAB: "openTab",
  SWITCH_TAB: "switchTab",
  CLOSE_TAB: "closeTab",
  HANDLE_DOWNLOAD: "handleDownload",
  EXECUTE_FLOW: "executeFlow",
  // UI-only helpers
  TRIGGER: "trigger",
  DELAY: "delay"
};

// src/labels.ts
var EDGE_LABELS = {
  DEFAULT: "default",
  TRUE: "true",
  FALSE: "false",
  ON_ERROR: "onError"
};

// src/node-spec-registry.ts
var REG = /* @__PURE__ */ new Map();
function registerNodeSpec(spec) {
  REG.set(spec.type, spec);
}
function getNodeSpec(type) {
  return REG.get(type);
}
function listNodeSpecs() {
  return Array.from(REG.values());
}

// src/node-specs-builtin.ts
function registerBuiltinSpecs() {
  const nav = {
    type: STEP_TYPES.NAVIGATE,
    version: 1,
    display: { label: "Navigate", iconClass: "icon-navigate", category: "Actions" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      {
        key: "url",
        label: "URL",
        type: "string",
        required: true,
        placeholder: "https://example.com",
        help: "Target URL, supports {var} templates",
        default: ""
      }
    ],
    defaults: { url: "" },
    validate: (cfg) => {
      const errs = [];
      if (!cfg || !cfg.url || String(cfg.url).trim() === "") errs.push("URL is required");
      return errs;
    }
  };
  registerNodeSpec(nav);
  registerNodeSpec({
    type: STEP_TYPES.CLICK,
    version: 1,
    display: { label: "Click", iconClass: "icon-click", category: "Actions" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      {
        key: "target",
        label: "Target",
        type: "json",
        widget: "targetlocator",
        help: "Select or enter element selector"
      },
      {
        key: "before",
        label: "Before",
        type: "object",
        fields: [
          { key: "scrollIntoView", label: "Scroll into View", type: "boolean", default: true },
          { key: "waitForSelector", label: "Wait for Selector", type: "boolean", default: true }
        ]
      },
      {
        key: "after",
        label: "After",
        type: "object",
        fields: [
          { key: "waitForNavigation", label: "Wait for Navigation", type: "boolean", default: false },
          { key: "waitForNetworkIdle", label: "Wait for Network Idle", type: "boolean", default: false }
        ]
      }
    ],
    defaults: { before: { scrollIntoView: true, waitForSelector: true }, after: {} }
  });
  registerNodeSpec({
    type: STEP_TYPES.DBLCLICK,
    version: 1,
    display: { label: "Double Click", iconClass: "icon-click", category: "Actions" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      { key: "target", label: "Target", type: "json", widget: "targetlocator" },
      {
        key: "before",
        label: "Before",
        type: "object",
        fields: [
          { key: "scrollIntoView", label: "Scroll into View", type: "boolean", default: true },
          { key: "waitForSelector", label: "Wait for Selector", type: "boolean", default: true }
        ]
      },
      {
        key: "after",
        label: "After",
        type: "object",
        fields: [
          { key: "waitForNavigation", label: "Wait for Navigation", type: "boolean", default: false },
          { key: "waitForNetworkIdle", label: "Wait for Network Idle", type: "boolean", default: false }
        ]
      }
    ],
    defaults: { before: { scrollIntoView: true, waitForSelector: true }, after: {} }
  });
  registerNodeSpec({
    type: STEP_TYPES.FILL,
    version: 1,
    display: { label: "Fill Input", iconClass: "icon-fill", category: "Actions" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      { key: "target", label: "Target", type: "json", widget: "targetlocator" },
      { key: "value", label: "Value", type: "string", required: true, help: "Supports {var} templates" }
    ],
    defaults: { value: "" }
  });
  registerNodeSpec({
    type: STEP_TYPES.KEY,
    version: 1,
    display: { label: "Press Key", iconClass: "icon-key", category: "Actions" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      {
        key: "keys",
        label: "Key Sequence",
        type: "string",
        widget: "keysequence",
        required: true,
        help: "e.g., Backspace, Enter, or cmd+a"
      },
      { key: "target", label: "Target (Optional)", type: "json", widget: "targetlocator" }
    ],
    defaults: { keys: "" }
  });
  registerNodeSpec({
    type: STEP_TYPES.SCROLL,
    version: 1,
    display: { label: "Scroll", iconClass: "icon-scroll", category: "Actions" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      {
        key: "mode",
        label: "Mode",
        type: "select",
        options: [
          { label: "Element", value: "element" },
          { label: "Offset", value: "offset" },
          { label: "Container", value: "container" }
        ],
        default: "offset"
      },
      { key: "target", label: "Target (Element/Container)", type: "json", widget: "targetlocator" },
      {
        key: "offset",
        label: "Offset",
        type: "object",
        fields: [
          { key: "x", label: "X", type: "number" },
          { key: "y", label: "Y", type: "number" }
        ]
      }
    ],
    defaults: { mode: "offset", offset: { x: 0, y: 300 } }
  });
  registerNodeSpec({
    type: STEP_TYPES.DRAG,
    version: 1,
    display: { label: "Drag", iconClass: "icon-drag", category: "Actions" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      { key: "start", label: "Start Point", type: "json", widget: "targetlocator" },
      { key: "end", label: "End Point", type: "json", widget: "targetlocator" },
      {
        key: "path",
        label: "Path Coordinates",
        type: "array",
        item: {
          key: "p",
          label: "Point",
          type: "object",
          fields: [
            { key: "x", label: "X", type: "number" },
            { key: "y", label: "Y", type: "number" }
          ]
        }
      }
    ],
    defaults: {}
  });
  registerNodeSpec({
    type: STEP_TYPES.WAIT,
    version: 1,
    display: { label: "Wait", iconClass: "icon-wait", category: "Actions" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      {
        key: "condition",
        label: "Condition (JSON)",
        type: "json",
        help: 'e.g. {"sleep":1000} or {"text":"Hello","appear":true}'
      }
    ],
    defaults: { condition: { sleep: 500 } }
  });
  registerNodeSpec({
    type: STEP_TYPES.ASSERT,
    version: 1,
    display: { label: "Assert", iconClass: "icon-assert", category: "Actions" },
    ports: { inputs: 1, outputs: [{ label: "default" }, { label: "onError" }] },
    schema: [
      {
        key: "assert",
        label: "Assertion (JSON)",
        type: "json",
        help: 'e.g. {"exists":"#id"} / {"visible":".btn"}'
      },
      {
        key: "failStrategy",
        label: "Failure Strategy",
        type: "select",
        options: [
          { label: "Stop", value: "stop" },
          { label: "Warn", value: "warn" },
          { label: "Retry", value: "retry" }
        ],
        default: "stop"
      }
    ],
    defaults: { assert: {} }
  });
  registerNodeSpec({
    type: STEP_TYPES.HTTP,
    version: 1,
    display: { label: "HTTP Request", iconClass: "icon-http", category: "Tools" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      {
        key: "method",
        label: "Method",
        type: "select",
        options: ["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({
          label: m,
          value: m
        })),
        default: "GET"
      },
      { key: "url", label: "URL", type: "string", required: true },
      { key: "headers", label: "Headers (JSON)", type: "json" },
      { key: "body", label: "Body (JSON)", type: "json" },
      { key: "formData", label: "Form Data (JSON)", type: "json" },
      { key: "saveAs", label: "Save Response As", type: "string" },
      { key: "assign", label: "Variable Mapping (JSON)", type: "json" }
    ],
    defaults: { method: "GET" }
  });
  registerNodeSpec({
    type: STEP_TYPES.EXTRACT,
    version: 1,
    display: { label: "Extract Data", iconClass: "icon-extract", category: "Tools" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      { key: "selector", label: "Selector", type: "string", widget: "selector" },
      {
        key: "attr",
        label: "Attribute",
        type: "select",
        options: [
          { label: "Text (text)", value: "text" },
          { label: "Text Content (textContent)", value: "textContent" },
          { label: "Custom Attribute", value: "attr" }
        ]
      },
      { key: "js", label: "Custom JS", type: "string", help: "Run in page context and return value" },
      { key: "saveAs", label: "Save As Variable", type: "string", required: true }
    ],
    defaults: { saveAs: "" }
  });
  registerNodeSpec({
    type: STEP_TYPES.SCREENSHOT,
    version: 1,
    display: { label: "Screenshot", iconClass: "icon-screenshot", category: "Tools" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      { key: "selector", label: "Target Selector", type: "string" },
      { key: "fullPage", label: "Full Page", type: "boolean", default: false },
      { key: "saveAs", label: "Save As Variable", type: "string" }
    ],
    defaults: { fullPage: false }
  });
  registerNodeSpec({
    type: STEP_TYPES.TRIGGER_EVENT,
    version: 1,
    display: { label: "Trigger Event", iconClass: "icon-trigger", category: "Tools" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      { key: "target", label: "Target", type: "json", widget: "targetlocator" },
      { key: "event", label: "Event Type", type: "string", required: true },
      { key: "bubbles", label: "Bubbles", type: "boolean", default: true },
      { key: "cancelable", label: "Cancelable", type: "boolean", default: false }
    ],
    defaults: { event: "" }
  });
  registerNodeSpec({
    type: STEP_TYPES.SET_ATTRIBUTE,
    version: 1,
    display: { label: "Set Attribute", iconClass: "icon-attr", category: "Tools" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      { key: "target", label: "Target", type: "json", widget: "targetlocator" },
      { key: "name", label: "Attribute Name", type: "string", required: true },
      { key: "value", label: "Attribute Value", type: "string" },
      { key: "remove", label: "Remove Attribute", type: "boolean", default: false }
    ],
    defaults: { remove: false }
  });
  registerNodeSpec({
    type: STEP_TYPES.LOOP_ELEMENTS,
    version: 1,
    display: { label: "Loop Elements", iconClass: "icon-loop", category: "Tools" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      { key: "selector", label: "Selector", type: "string", required: true },
      { key: "saveAs", label: "List Variable Name", type: "string", default: "elements" },
      { key: "itemVar", label: "Item Variable Name", type: "string", default: "item" },
      { key: "subflowId", label: "Subflow ID", type: "string", required: true }
    ],
    defaults: { saveAs: "elements", itemVar: "item" }
  });
  registerNodeSpec({
    type: STEP_TYPES.SWITCH_FRAME,
    version: 1,
    display: { label: "Switch Frame", iconClass: "icon-frame", category: "Tools" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      {
        key: "frame",
        label: "Frame Locator",
        type: "object",
        fields: [
          { key: "index", label: "Index", type: "number" },
          { key: "urlContains", label: "URL Contains", type: "string" }
        ]
      }
    ],
    defaults: {}
  });
  registerNodeSpec({
    type: STEP_TYPES.HANDLE_DOWNLOAD,
    version: 1,
    display: { label: "Handle Download", iconClass: "icon-download", category: "Tools" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      { key: "filenameContains", label: "Filename Contains", type: "string" },
      { key: "waitForComplete", label: "Wait for Completion", type: "boolean", default: true },
      { key: "timeoutMs", label: "Timeout (ms)", type: "number", default: 6e4 },
      { key: "saveAs", label: "Save As Variable", type: "string" }
    ],
    defaults: { waitForComplete: true, timeoutMs: 6e4 }
  });
  registerNodeSpec({
    type: STEP_TYPES.SCRIPT,
    version: 1,
    display: { label: "Run Script", iconClass: "icon-script", category: "Tools" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      {
        key: "world",
        label: "Execution Context",
        type: "select",
        options: [
          { label: "ISOLATED", value: "ISOLATED" },
          { label: "MAIN", value: "MAIN" }
        ],
        default: "ISOLATED"
      },
      { key: "code", label: "Script Code", type: "string", widget: "code", required: true },
      {
        key: "when",
        label: "Timing",
        type: "select",
        options: [
          { label: "before", value: "before" },
          { label: "after", value: "after" }
        ],
        default: "after"
      },
      { key: "assign", label: "Return Mapping (JSON)", type: "json" },
      { key: "saveAs", label: "Save Return As", type: "string" }
    ],
    defaults: { world: "ISOLATED", when: "after" }
  });
  registerNodeSpec({
    type: STEP_TYPES.OPEN_TAB,
    version: 1,
    display: { label: "Open Tab", iconClass: "icon-openTab", category: "Tabs" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      { key: "url", label: "URL", type: "string" },
      { key: "newWindow", label: "New Window", type: "boolean", default: false }
    ],
    defaults: { newWindow: false }
  });
  registerNodeSpec({
    type: "executeFlow",
    version: 1,
    display: { label: "Execute Subflow", iconClass: "icon-exec", category: "Flow" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      { key: "flowId", label: "Flow ID", type: "string", required: true },
      { key: "inline", label: "Inline Execution", type: "boolean", default: false },
      { key: "args", label: "Arguments (JSON)", type: "json" }
    ],
    defaults: { inline: false }
  });
  registerNodeSpec({
    type: STEP_TYPES.SWITCH_TAB,
    version: 1,
    display: { label: "Switch Tab", iconClass: "icon-switchTab", category: "Tabs" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      { key: "tabId", label: "Tab ID", type: "number" },
      { key: "urlContains", label: "URL Contains", type: "string" },
      { key: "titleContains", label: "Title Contains", type: "string" }
    ],
    defaults: {}
  });
  registerNodeSpec({
    type: STEP_TYPES.CLOSE_TAB,
    version: 1,
    display: { label: "Close Tab", iconClass: "icon-closeTab", category: "Tabs" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      {
        key: "tabIds",
        label: "Tab IDs",
        type: "array",
        item: { key: "id", label: "ID", type: "number" }
      },
      { key: "url", label: "URL", type: "string" }
    ],
    defaults: {}
  });
  registerNodeSpec({
    type: STEP_TYPES.IF,
    version: 1,
    display: { label: "Condition", iconClass: "icon-if", category: "Logic" },
    ports: { inputs: 1, outputs: "any" },
    schema: [
      {
        key: "condition",
        label: "Expression (JSON)",
        type: "json",
        help: 'e.g. {"expression":"vars.a>0"}'
      },
      {
        key: "branches",
        label: "Branches",
        type: "array",
        item: {
          key: "b",
          label: "case",
          type: "object",
          fields: [
            { key: "id", label: "ID", type: "string" },
            { key: "name", label: "Name", type: "string" },
            { key: "expr", label: "Expression", type: "string" }
          ]
        }
      },
      { key: "else", label: "Enable Else", type: "boolean", default: true }
    ],
    defaults: { else: true }
  });
  registerNodeSpec({
    type: STEP_TYPES.FOREACH,
    version: 1,
    display: { label: "For Each", iconClass: "icon-foreach", category: "Logic" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      { key: "listVar", label: "List Variable", type: "string", required: true },
      { key: "itemVar", label: "Item Variable", type: "string", default: "item" },
      { key: "subflowId", label: "Subflow ID", type: "string", required: true },
      {
        key: "concurrency",
        label: "Concurrency",
        type: "number",
        default: 1,
        help: "Run subflows concurrently (shallow copy vars, no auto merge)"
      }
    ],
    defaults: { itemVar: "item" }
  });
  registerNodeSpec({
    type: STEP_TYPES.WHILE,
    version: 1,
    display: { label: "While Loop", iconClass: "icon-while", category: "Logic" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      { key: "condition", label: "Condition (JSON)", type: "json" },
      { key: "subflowId", label: "Subflow ID", type: "string", required: true },
      { key: "maxIterations", label: "Max Iterations", type: "number", default: 100 }
    ],
    defaults: { maxIterations: 100 }
  });
  registerNodeSpec({
    type: STEP_TYPES.DELAY,
    version: 1,
    display: { label: "Delay", iconClass: "icon-delay", category: "Actions" },
    ports: { inputs: 1, outputs: [{ label: "default" }] },
    schema: [
      {
        key: "sleep",
        label: "Duration (ms)",
        type: "number",
        widget: "duration",
        required: true,
        default: 1e3
      }
    ],
    defaults: { sleep: 1e3 }
  });
  registerNodeSpec({
    type: STEP_TYPES.TRIGGER,
    version: 1,
    display: { label: "Trigger", iconClass: "icon-trigger", category: "Flow" },
    ports: { inputs: 0, outputs: [{ label: "default" }] },
    schema: [
      { key: "enabled", label: "Enabled", type: "boolean", default: true },
      { key: "description", label: "Description", type: "string" },
      {
        key: "modes",
        label: "Trigger Mode",
        type: "object",
        fields: [
          { key: "manual", label: "Manual", type: "boolean", default: true },
          { key: "url", label: "On URL", type: "boolean", default: false },
          { key: "contextMenu", label: "Context Menu", type: "boolean", default: false },
          { key: "command", label: "Shortcut", type: "boolean", default: false },
          { key: "dom", label: "DOM Event", type: "boolean", default: false },
          { key: "schedule", label: "Scheduled", type: "boolean", default: false }
        ]
      },
      {
        key: "url",
        label: "URL Rules",
        type: "object",
        fields: [
          {
            key: "rules",
            label: "Rule List",
            type: "array",
            item: {
              key: "rule",
              label: "Rule",
              type: "object",
              fields: [
                {
                  key: "kind",
                  label: "Type",
                  type: "select",
                  options: [
                    { label: "URL", value: "url" },
                    { label: "Domain", value: "domain" },
                    { label: "Path", value: "path" }
                  ],
                  default: "url"
                },
                { key: "value", label: "Pattern", type: "string" }
              ]
            }
          }
        ]
      },
      {
        key: "contextMenu",
        label: "Context Menu",
        type: "object",
        fields: [
          { key: "title", label: "Item Title", type: "string", default: "Run Workflow" },
          { key: "enabled", label: "Enabled", type: "boolean", default: false }
        ]
      },
      {
        key: "command",
        label: "Shortcut",
        type: "object",
        fields: [
          { key: "commandKey", label: "Keys", type: "string" },
          { key: "enabled", label: "Enabled", type: "boolean", default: false }
        ]
      },
      {
        key: "dom",
        label: "DOM Event",
        type: "object",
        fields: [
          { key: "selector", label: "Selector", type: "string" },
          { key: "appear", label: "On Appear", type: "boolean", default: true },
          { key: "once", label: "Run Once", type: "boolean", default: true },
          { key: "debounceMs", label: "Debounce (ms)", type: "number", default: 800 },
          { key: "enabled", label: "Enabled", type: "boolean", default: false }
        ]
      },
      {
        key: "schedules",
        label: "Schedule",
        type: "array",
        item: {
          key: "sched",
          label: "Plan",
          type: "object",
          fields: [
            { key: "id", label: "ID", type: "string" },
            {
              key: "type",
              label: "Type",
              type: "select",
              options: [
                { label: "Once", value: "once" },
                { label: "Interval", value: "interval" },
                { label: "Daily", value: "daily" }
              ]
            },
            { key: "when", label: "Time (ISO/cron)", type: "string" },
            { key: "enabled", label: "Enabled", type: "boolean", default: true }
          ]
        }
      }
    ],
    defaults: { enabled: true }
  });
}

// src/agent-types.ts
var CODEX_AUTO_INSTRUCTIONS = `Act autonomously without asking for confirmations.
Use apply_patch to create and modify files directly in the current working directory (do not create subdirectories unless the user explicitly requests it).
Use exec_command to run, build, and test as needed.
You have full permissions. Keep taking concrete actions until the task is complete.
Respect the existing project structure when creating or modifying files.
Prefer concise status updates over questions.`;
var DEFAULT_CODEX_CONFIG = {
  includeApplyPatchTool: true,
  includePlanTool: true,
  enableWebSearch: true,
  useStreamableShell: true,
  sandboxMode: "danger-full-access",
  maxTurns: 20,
  maxThinkingTokens: 4096,
  reasoningEffort: "medium",
  autoInstructions: CODEX_AUTO_INSTRUCTIONS,
  appendProjectContext: true
};
export {
  CODEX_AUTO_INSTRUCTIONS,
  DEFAULT_CODEX_CONFIG,
  DEFAULT_SERVER_PORT,
  EDGE_LABELS,
  HOST_NAME,
  NativeMessageType,
  STEP_TYPES,
  TOOL_NAMES,
  TOOL_SCHEMAS,
  getNodeSpec,
  listNodeSpecs,
  registerBuiltinSpecs,
  registerNodeSpec
};
