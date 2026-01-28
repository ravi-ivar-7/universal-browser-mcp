"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTrace = parseTrace;
exports.getTraceSummary = getTraceSummary;
exports.getInsightText = getInsightText;
exports.analyzeTraceFile = analyzeTraceFile;
const fs = __importStar(require("fs"));
// Import DevTools trace engine and formatters from chrome-devtools-frontend
// We intentionally use deep imports to match the package structure.
// These modules are ESM and require NodeNext module resolution.
// Types are loosely typed to minimize coupling with DevTools internals.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const TraceEngine = __importStar(require("chrome-devtools-frontend/front_end/models/trace/trace.js"));
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const PerformanceTraceFormatter_js_1 = require("chrome-devtools-frontend/front_end/models/ai_assistance/data_formatters/PerformanceTraceFormatter.js");
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const PerformanceInsightFormatter_js_1 = require("chrome-devtools-frontend/front_end/models/ai_assistance/data_formatters/PerformanceInsightFormatter.js");
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const AIContext_js_1 = require("chrome-devtools-frontend/front_end/models/ai_assistance/performance/AIContext.js");
const engine = TraceEngine.TraceModel.Model.createWithAllHandlers();
function readJsonFile(path) {
    const text = fs.readFileSync(path, 'utf-8');
    return JSON.parse(text);
}
async function parseTrace(json) {
    var _a;
    engine.resetProcessor();
    const events = Array.isArray(json) ? json : json.traceEvents;
    if (!events || !Array.isArray(events)) {
        throw new Error('Invalid trace format: expected array or {traceEvents: []}');
    }
    await engine.parse(events);
    const parsedTrace = engine.parsedTrace();
    const insights = (_a = parsedTrace === null || parsedTrace === void 0 ? void 0 : parsedTrace.insights) !== null && _a !== void 0 ? _a : null;
    if (!parsedTrace)
        throw new Error('No parsed trace returned by engine');
    return { parsedTrace, insights };
}
function getTraceSummary(parsedTrace) {
    const focus = AIContext_js_1.AgentFocus.fromParsedTrace(parsedTrace);
    const formatter = new PerformanceTraceFormatter_js_1.PerformanceTraceFormatter(focus);
    return formatter.formatTraceSummary();
}
function getInsightText(parsedTrace, insights, insightName) {
    var _a, _b, _c, _d, _e, _f;
    if (!insights)
        throw new Error('No insights available for this trace');
    const mainNavId = (_f = (_e = (_d = (_c = (_b = (_a = parsedTrace.data) === null || _a === void 0 ? void 0 : _a.Meta) === null || _b === void 0 ? void 0 : _b.mainFrameNavigations) === null || _c === void 0 ? void 0 : _c.at(0)) === null || _d === void 0 ? void 0 : _d.args) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.navigationId;
    const NO_NAV = TraceEngine.Types.Events.NO_NAVIGATION;
    const set = insights.get(mainNavId !== null && mainNavId !== void 0 ? mainNavId : NO_NAV);
    if (!set)
        throw new Error('No insights for selected navigation');
    const model = set.model || {};
    if (!(insightName in model))
        throw new Error(`Insight not found: ${insightName}`);
    const formatter = new PerformanceInsightFormatter_js_1.PerformanceInsightFormatter(AIContext_js_1.AgentFocus.fromParsedTrace(parsedTrace), model[insightName]);
    return formatter.formatInsight();
}
async function analyzeTraceFile(filePath, insightName) {
    const json = readJsonFile(filePath);
    const { parsedTrace, insights } = await parseTrace(json);
    const summary = getTraceSummary(parsedTrace);
    if (insightName) {
        try {
            const insight = getInsightText(parsedTrace, insights, insightName);
            return { summary, insight };
        }
        catch (_a) {
            // If requested insight missing, still return summary
            return { summary };
        }
    }
    return { summary };
}
exports.default = { analyzeTraceFile };
//# sourceMappingURL=trace-analyzer.js.map