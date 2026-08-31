// Ambient types for the WebMCP browser API.
//
// Measured in the browser, not copied from the explainer. Rerun the probe with
// `node docs/probe-modelcontext.mjs` rather than trusting this comment. Three
// shapes here are not what a first guess produces, and each was observed:
//
//   1. The object hangs off `document`. It also hangs off `navigator`, and the
//      two are the SAME object: `document.modelContext === navigator.modelContext`
//      is true. Earlier notes here claimed the navigator spelling was undefined;
//      that was wrong, and remeasuring is what caught it. Prefer `document`,
//      which is the spelling the W3C explainer specifies.
//   2. `title` is a top level field on the descriptor. Nested inside
//      `annotations` the browser silently drops it.
//   3. `getTools()` hands back `inputSchema` as a JSON string, because the
//      browser normalises it on the way in and re-serialises it on the way out.
//   4. `executeTool(tool, args)` is a string on BOTH sides. `args` goes in as a
//      JSON string, and an object throws "UnknownError: Failed to parse input
//      arguments". The call then resolves to a JSON STRING, not the response
//      object, so a caller reading `result.content` gets undefined and an empty
//      answer with no error to explain it. JSON.parse the result first.
//   5. A declarative tool's schema is re-synthesised from the DOM after the
//      markup changes, so a `<select>` filled by an async fetch still ends up
//      with a real enum rather than the empty one it renders with first.
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
    /**
     * The same object as `document.modelContext`, not a legacy alias and not
     * absent. Declared so `adapter.ts`'s `??` chain type checks; `document` is
     * still the spelling to read.
     */
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
