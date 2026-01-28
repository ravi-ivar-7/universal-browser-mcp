export declare function parseTrace(json: any): Promise<{
    parsedTrace: any;
    insights: any | null;
}>;
export declare function getTraceSummary(parsedTrace: any): string;
export declare function getInsightText(parsedTrace: any, insights: any, insightName: string): string;
export declare function analyzeTraceFile(filePath: string, insightName?: string): Promise<{
    summary: string;
    insight?: string;
}>;
declare const _default: {
    analyzeTraceFile: typeof analyzeTraceFile;
};
export default _default;
