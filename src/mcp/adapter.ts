// The document.modelContext adapter.
//
// Everything that touches the browser API goes through here, so the rest of
// src/mcp/ is plain functions returning text. Three jobs:
//
//   1. Feature detection that degrades instead of throwing. The Claude Code
//      in-app browser is Chromium 148 and has no modelContext at all; the page
//      must still work there, with the panel saying so.
//   2. Group lifecycle. Tools are registered in named groups (public,
//      internal, report, diagnostics) and each group owns one AbortController.
//      Aborting it unregisters every tool in the group. There is no
//      unregisterTool in Chrome 152.
//   3. A safe execute wrapper. A tool that throws inside the agent's turn is a
//      dead end with no next step in it. Every failure comes back as text that
//      names what to try instead.
//
// Tools are registered only from our own modules. Nothing here accepts a
// descriptor built from fetched content, which is the published attack surface
// on runtime registration.

/** What every tool in src/mcp/tools/ returns. */
export type ToolResponse = ModelContextResponse;

/**
 * A tool as we write it. Deliberately the browser's own shape with `execute`
 * narrowed, so there is no translation layer to get wrong.
 *
 * `title` sits at the top level because the browser drops it from
 * `annotations`. See src/mcp/model-context.d.ts.
 */
export type ToolSpec = ModelContextToolDescriptor;

/** Wrap a string in the one content shape Chrome 152 accepts. */
export function text(body: string): ToolResponse {
  return { content: [{ type: "text", text: body }] };
}

/**
 * Feature detection that survives both spellings.
 *
 * `document.modelContext` is the shape Chrome 152 ships and the one the W3C
 * explainer specifies. `navigator.modelContext` is checked only because every
 * piece of secondary writing about WebMCP still names it.
 */
export function getModelContext(): ModelContext | null {
  if (typeof document === "undefined") return null;
  return document.modelContext ?? navigator.modelContext ?? null;
}

export function isSupported(): boolean {
  return getModelContext() !== null;
}

/**
 * Wait for the API to appear, rather than deciding at first paint that it never
 * will.
 *
 * Chrome exposes `document.modelContext` before our code runs, so a single
 * check works there. Other hosts do not: an embedded browser can inject the
 * object after the page has loaded, and a one-shot check turns that into a
 * permanent "no tools on this page" with nothing on screen explaining why. The
 * cost of being wrong in that direction is the whole feature, so poll.
 *
 * Resolves immediately when the API is already there, and gives up after the
 * deadline so a browser that genuinely lacks it still gets the honest panel.
 */
export function whenSupported(timeoutMs = 15_000): Promise<boolean> {
  if (isSupported()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (isSupported()) {
        clearInterval(timer);
        resolve(true);
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 250);
  });
}

/**
 * Trim a thrown value into one line an agent can act on.
 *
 * Never re-throws. A tool that throws mid turn gives the agent an opaque
 * failure; a tool that returns a sentence gives it a next move.
 */
function describeFailure(name: string, cause: unknown): string {
  const detail =
    cause instanceof Error ? cause.message : String(cause ?? "unknown error");
  return (
    `${name} could not complete: ${detail}. ` +
    `Nothing on the page changed. Call list_metrics to see what is answerable, ` +
    `or report this to the person at the screen rather than working around it.`
  );
}

function guard(spec: ToolSpec): ToolSpec {
  return {
    ...spec,
    execute: async (args, context) => {
      try {
        return await spec.execute(args, context);
      } catch (cause) {
        return text(describeFailure(spec.name, cause));
      }
    },
  };
}

/**
 * One named set of tools with a shared lifetime.
 *
 * Open registers every tool and returns; close aborts the controller, which is
 * how unregistration works in this API. Both are idempotent, because the
 * reconciler in register.ts calls them from a store subscription that can fire
 * more than once for the same transition.
 */
export class ToolGroup {
  private controller: AbortController | null = null;

  constructor(
    readonly id: string,
    /**
     * Built at open time, not at import time, and allowed to be async.
     *
     * The public group fetches the catalogue facets before it builds its
     * schemas, so `category`, `brand`, `subcategory` and `colour` carry real
     * enums read from the data rather than free text an agent can typo. Nothing
     * is registered until that resolves.
     */
    private readonly build: () => ToolSpec[] | Promise<ToolSpec[]>,
  ) {}

  get isOpen(): boolean {
    return this.controller !== null;
  }

  async open(): Promise<void> {
    if (this.controller) return;
    const mc = getModelContext();
    if (!mc) return;
    const controller = new AbortController();
    this.controller = controller;

    // A build that throws must not take the registration with it. The public
    // group probes /api/products for its facet enums, and a probe that fails
    // should cost the agent real enums, not every tool on the page.
    let specs: ToolSpec[];
    try {
      specs = await this.build();
    } catch (error) {
      console.error(`[superweb] building tool group "${this.id}" failed`, error);
      this.controller = null;
      return;
    }
    // A close() while the build was in flight wins. Registering afterwards
    // would attach tools to a controller nobody is holding any more.
    if (this.controller !== controller) return;
    for (const spec of specs) {
      // Sequential rather than Promise.all: registration order is the order
      // getTools() reports, and the panel reads that order straight through.
      await mc.registerTool(guard(spec), { signal: controller.signal });
    }
  }

  close(): void {
    this.controller?.abort();
    this.controller = null;
  }
}

/**
 * Subscribe to the browser's own tool inventory.
 *
 * `toolchange` fires on every register and every abort and carries no detail,
 * so it is a "re-read getTools()" signal and nothing more. The panel listens
 * here rather than recomputing from our own bookkeeping, which means it shows
 * what the agent would actually see.
 */
export function onToolChange(listener: () => void): () => void {
  const mc = getModelContext();
  if (!mc) return () => {};
  mc.addEventListener("toolchange", listener);
  return () => mc.removeEventListener("toolchange", listener);
}

/** Read the live inventory. Empty when the API is absent. */
export async function listTools(): Promise<ModelContextRegisteredTool[]> {
  const mc = getModelContext();
  if (!mc) return [];
  try {
    return await mc.getTools();
  } catch {
    return [];
  }
}
