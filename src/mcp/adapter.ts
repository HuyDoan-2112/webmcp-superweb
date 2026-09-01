// The document.modelContext adapter.
//
// Everything that touches the browser API goes through here, so the rest of
// src/mcp/ is plain functions returning text. Three jobs:
//
//   1. Feature detection that degrades instead of throwing. The Claude Code
//      in-app browser is Chromium 148 and has no modelContext at all; the page
//      must still work there, with the panel saying so.
//   2. Group lifecycle. Tools are registered in named groups (public,
//      internal, report, preview, diagnostics) and each group owns one
//      AbortController.
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

/**
 * What registration actually did, in order, for the panel to show.
 *
 * console.error is the right place for these and the wrong place to read them:
 * a host browser with no devtools reachable, which is every in-app browser, hid
 * the one line that explains an empty tool list. The panel renders this when it
 * has nothing else to show, so a page that registered nothing says why on
 * screen rather than looking indistinguishable from a page that never tried.
 */
export const registrationLog: string[] = [];

/**
 * How long a group's build may take before it is treated as failed.
 *
 * Generous on purpose: the public group's probe is a real request and a cold
 * serverless start is slow. The deployed page registers all twelve tools in
 * 848 ms, so this is an outer bound on a hang, not a performance budget.
 */
const BUILD_DEADLINE_MS = 8_000;

/** Record a registration step from outside the adapter. */
export function noteRegistration(line: string): void {
  note(line);
}

const noteListeners = new Set<() => void>();

/**
 * Watch the registration log.
 *
 * The panel cannot rely on `toolchange` for this. That event fires on register
 * and abort, so a page where registration never happens never fires it, and the
 * panel stays on the render it made before the boot path ran. That is exactly
 * the case this log exists to explain, so the log has to push.
 */
export function onRegistrationNote(listener: () => void): () => void {
  noteListeners.add(listener);
  return () => noteListeners.delete(listener);
}

function note(line: string): void {
  registrationLog.push(line);
  if (registrationLog.length > 40) registrationLog.shift();
  for (const listener of noteListeners) listener();
}

/**
 * Close the schema, because a strict validator rejects one that is open.
 *
 * ChatGPT's site-tools guide writes `additionalProperties: false` into every
 * example, and OpenAI's function-calling validator treats a schema without it
 * as invalid rather than as permissive. Chrome does not care either way, so
 * setting it costs nothing here and may be the difference between a tool that
 * is offered to a model and one that is silently dropped.
 *
 * Written once at registration rather than in each tool module: the schemas are
 * built from live data in twelve places and this is a property of how we
 * register, not of what any one tool means.
 */
function closeSchema(schema: Record<string, unknown>): Record<string, unknown> {
  if (schema.type !== "object") return schema;
  if ("additionalProperties" in schema) return schema;
  return { ...schema, additionalProperties: false };
}

function guard(spec: ToolSpec): ToolSpec {
  return {
    ...spec,
    inputSchema: closeSchema(spec.inputSchema),
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
    if (!mc) {
      note(`group "${this.id}": no document.modelContext, nothing registered`);
      return;
    }
    const controller = new AbortController();
    this.controller = controller;

    // Logged before the await, not after. build() fetches, and a fetch that
    // never settles leaves open() parked forever with isOpen already true, so
    // the reconciler never retries and every later note is unreachable. Without
    // this line that state is indistinguishable from open() never being called.
    note(`group "${this.id}": opening, building tools`);

    // A build that throws must not take the registration with it. The public
    // group probes /api/products for its facet enums, and a probe that fails
    // should cost the agent real enums, not every tool on the page.
    let specs: ToolSpec[];
    try {
      // A deadline, because the shared HTTP client sets none. open() already
      // promises that a failed probe costs real enums rather than every tool
      // on the page, and a request that never settles broke that promise the
      // worst way: parked here with isOpen already true, so the reconciler
      // never retried and nothing reached the log. A rejection lands in the
      // catch below, which clears the controller and makes the next store
      // change try again.
      specs = await Promise.race([
        this.build(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`build did not settle within ${BUILD_DEADLINE_MS} ms`)),
            BUILD_DEADLINE_MS,
          ),
        ),
      ]);
    } catch (error) {
      console.error(`[superweb] building tool group "${this.id}" failed`, error);
      note(
        `group "${this.id}": build failed, ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
      this.controller = null;
      return;
    }
    // A close() while the build was in flight wins. Registering afterwards
    // would attach tools to a controller nobody is holding any more.
    if (this.controller !== controller) return;
    for (const spec of specs) {
      // Sequential rather than Promise.all: registration order is the order
      // getTools() reports, and the panel reads that order straight through.
      //
      // Guarded for the same reason build() is. registerTool is an experimental
      // API, and one rejected descriptor must not escape open() and poison the
      // reconciler's queue.
      try {
        await mc.registerTool(guard(spec), { signal: controller.signal });
      } catch (firstError) {
        // A host that supports only part of WebMCP may take the descriptor and
        // refuse the options argument. Retry with one argument rather than lose
        // the tool, and say so, because what we lose by succeeding here is
        // unregistration: there is no unregisterTool, so a tool registered
        // without a signal stays for the life of the page and the surface swap
        // cannot remove it.
        try {
          await mc.registerTool(guard(spec));
          note(
            `${spec.name}: two-argument registerTool rejected ` +
              `(${firstError instanceof Error ? firstError.message : String(firstError)}), ` +
              `registered with one argument instead, so it cannot be unregistered`,
          );
          continue;
        } catch {
          // Fall through to the original report: neither call shape worked.
        }
        const error = firstError;
        console.error(
          `[superweb] registering "${spec.name}" in group "${this.id}" failed`,
          error,
        );
        note(
          `${spec.name}: registerTool rejected, ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    note(`group "${this.id}": open, ${specs.length} tools built`);
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
