// Ambient types for the WebMCP browser API.
//
// Measured against Chrome 152, not copied from the explainer. See
// scratchpad gate0-webmcp/FINDINGS.md. Three shapes here are not what a first
// guess produces, and each was observed rather than assumed:
//
//   1. The object hangs off `document`, not `navigator`. `navigator.modelContext`
//      is undefined in Chrome 152.
//   2. `title` is a top level field on the descriptor. Nested inside
//      `annotations` the browser silently drops it.
//   3. `getTools()` hands back `inputSchema` as a JSON string, because the
//      browser normalises it on the way in and re-serialises it on the way out.
//
// There is no `unregisterTool`. Unregistration is an AbortSignal handed to
// `registerTool`, then aborted.

export {};

declare global {
  /** What `execute` must resolve to. The only content type Chrome 152 returns. */
  interface ModelContextTextContent {
    type: "text";
    text: string;
  }

  interface ModelContextResponse {
    content: ModelContextTextContent[];
  }

  /**
   * Normalised by the browser to exactly these two keys. Unknown annotation
   * keys are dropped without an error.
   */
  interface ModelContextAnnotations {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  }

  /** The descriptor handed to `registerTool`. `inputSchema` goes in as an object. */
  interface ModelContextToolDescriptor {
    name: string;
    title?: string;
    description: string;
    inputSchema: Record<string, unknown>;
    annotations?: ModelContextAnnotations;
    execute: (
      args: Record<string, unknown>,
      context?: { signal?: AbortSignal },
    ) => ModelContextResponse | Promise<ModelContextResponse>;
  }

  /** What `getTools()` hands back. Note `inputSchema` is a string here. */
  interface ModelContextRegisteredTool {
    name: string;
    title: string;
    description: string;
    inputSchema: string;
    annotations: Required<ModelContextAnnotations>;
    origin?: string;
    window?: Window;
  }

  interface ModelContext extends EventTarget {
    registerTool(
      tool: ModelContextToolDescriptor,
      options?: { signal?: AbortSignal },
    ): Promise<void>;
    getTools(): Promise<ModelContextRegisteredTool[]>;
    executeTool(
      tool: ModelContextRegisteredTool,
      args: string,
    ): Promise<string>;
    ontoolchange: ((this: ModelContext, ev: Event) => unknown) | null;
  }

  interface Document {
    modelContext?: ModelContext;
  }

  interface Navigator {
    /** Removed before Chrome 152. Kept only so feature detection type checks. */
    modelContext?: ModelContext;
  }

  /**
   * The declarative half of the API. A form carrying `toolname` responds
   * through this rather than through a registered `execute` callback.
   * Undocumented in the WebMCP implementation status page, but present in
   * Chrome 152 and verified end to end. See src/mcp/declarative.ts.
   */
  interface SubmitEvent {
    respondWith?: (response: Promise<ModelContextResponse>) => void;
  }
}
