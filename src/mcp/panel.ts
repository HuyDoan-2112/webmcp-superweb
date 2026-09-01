// The visible "tools available" list.
//
// This is the part of the demo a judge watches. It has to show a count and the
// tool names, be readable on screen without anyone expanding anything, and move
// the moment the surface moves. When someone signs in, the count jumps and the
// names change in front of them.
//
// It reads the browser's own inventory through getTools() and refreshes on the
// toolchange event, rather than mirroring our own bookkeeping. That matters:
// what it shows is what an attached agent would see, so a registration bug
// shows up on screen instead of hiding behind a list we maintained by hand.
//
// Plain DOM and inline styles on purpose. It sits outside the React tree, so it
// cannot be unmounted by a surface switch, and it holds no state of its own.

import {
  getModelContext,
  listTools,
  onToolChange,
  registrationLog,
  whenSupported,
} from "./adapter";
import { supportsDeclarativeTools } from "./declarative";

const ELEMENT_ID = "superweb-mcp-panel";
const COLLAPSED_KEY = "superweb.mcp.panel.collapsed";

function css(): string {
  return `
#${ELEMENT_ID} {
  position: fixed;
  inset-block-end: 1rem;
  inset-inline-end: 1rem;
  z-index: 2147483000;
  width: 17rem;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border, rgba(120,120,140,0.35));
  border-radius: var(--radius, 0.625rem);
  background: var(--card, Canvas);
  color: var(--card-foreground, CanvasText);
  box-shadow: 0 10px 30px -12px rgba(0,0,0,0.45);
  font: 400 12px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
#${ELEMENT_ID}[data-collapsed="true"] .mcp-body { display: none; }
#${ELEMENT_ID} .mcp-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}
#${ELEMENT_ID} .mcp-dot {
  width: 0.5rem; height: 0.5rem; border-radius: 999px;
  background: #10b981; flex: none;
}
#${ELEMENT_ID}[data-state="absent"] .mcp-dot { background: #f43f5e; }
#${ELEMENT_ID} .mcp-title { font-weight: 600; letter-spacing: 0.01em; }
#${ELEMENT_ID} .mcp-count {
  margin-inline-start: auto;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  background: var(--secondary, rgba(120,120,140,0.18));
  color: var(--secondary-foreground, inherit);
}
#${ELEMENT_ID} .mcp-body {
  padding: 0 0.75rem 0.7rem;
  overflow-y: auto;
}
#${ELEMENT_ID} .mcp-note {
  color: var(--muted-foreground, rgba(120,120,140,1));
  margin: 0 0 0.5rem;
}
#${ELEMENT_ID} ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 1px; }
#${ELEMENT_ID} li {
  display: flex; align-items: baseline; gap: 0.4rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  padding: 0.12rem 0;
}
#${ELEMENT_ID} li span.ro {
  color: var(--muted-foreground, rgba(120,120,140,1));
  font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase;
  margin-inline-start: auto;
}
`;
}

function mount(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;

  const style = document.createElement("style");
  style.id = `${ELEMENT_ID}-style`;
  style.textContent = css();
  document.head.append(style);

  const root = document.createElement("aside");
  root.id = ELEMENT_ID;
  root.setAttribute("aria-label", "WebMCP tools available on this page");
  root.dataset.collapsed = readCollapsed() ? "true" : "false";
  root.innerHTML = `
    <button class="mcp-head" type="button" aria-expanded="true">
      <span class="mcp-dot" aria-hidden="true"></span>
      <span class="mcp-title">Tools on this page</span>
      <span class="mcp-count">0</span>
    </button>
    <div class="mcp-body"></div>`;
  document.body.append(root);

  const head = root.querySelector<HTMLButtonElement>(".mcp-head");
  head?.addEventListener("click", () => {
    const collapsed = root.dataset.collapsed !== "true";
    root.dataset.collapsed = collapsed ? "true" : "false";
    head.setAttribute("aria-expanded", collapsed ? "false" : "true");
    writeCollapsed(collapsed);
  });

  return root;
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // Private windows throw on write. The panel works without remembering.
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] ?? c,
  );
}

async function render(root: HTMLElement): Promise<void> {
  const body = root.querySelector<HTMLElement>(".mcp-body");
  const count = root.querySelector<HTMLElement>(".mcp-count");
  if (!body || !count) return;

  if (!getModelContext()) {
    root.dataset.state = "absent";
    count.textContent = "0";
    body.innerHTML =
      `<p class="mcp-note">This browser has no <code>document.modelContext</code>, ` +
      `so no tools are registered. The page works normally. WebMCP needs ` +
      `Chrome 149 or later with the origin trial, or ` +
      `<code>chrome://flags/#enable-webmcp-testing</code> enabled.</p>`;
    return;
  }

  root.dataset.state = "present";
  const tools = await listTools();
  count.textContent = String(tools.length);

  const items = tools
    .map((t) => {
      const name = escapeHtml(t.name);
      const readOnly = t.annotations?.readOnlyHint === true;
      const untrusted = t.annotations?.untrustedContentHint === true;
      const tag = readOnly ? "read" : "acts";
      const title = escapeHtml(t.title || t.name);
      return (
        `<li title="${title}"><span>${name}</span>` +
        `<span class="ro">${tag}${untrusted ? " · ext" : ""}</span></li>`
      );
    })
    .join("");

  // An empty list with the API present is the one state the panel used to
  // report as if it were normal. It is not: either nothing tried to register,
  // or every attempt was rejected by a host that has the API but will not take
  // our descriptors. Show what happened, because the console that holds the
  // real error is unreachable in an in-app browser.
  if (tools.length === 0) {
    const lines = registrationLog.length
      ? registrationLog.map((l) => `<li>${escapeHtml(l)}</li>`).join("")
      : `<li>nothing attempted to register</li>`;
    body.innerHTML =
      `<p class="mcp-note">This browser has <code>document.modelContext</code>, ` +
      `but it reports no registered tools. What registration did:</p>` +
      `<ul>${lines}</ul>`;
    return;
  }

  body.innerHTML =
    `<p class="mcp-note">Registered right now, read from the browser itself. ` +
    `Signing in changes this list.${
      supportsDeclarativeTools()
        ? " This browser also supports declarative form tools."
        : ""
    }</p><ul>${items}</ul>`;
}

/**
 * Mount the panel and keep it in step with the browser's inventory.
 *
 * Listens to toolchange rather than being told when to refresh, so a tool
 * registered from anywhere shows up here without a second call site.
 */
export function mountPanel(): void {
  const root = mount();
  void render(root);
  onToolChange(() => {
    void render(root);
  });

  // A host that injects document.modelContext after load would otherwise leave
  // the panel stuck on "this browser has no modelContext" while tools register
  // behind it, which is the most misleading thing this panel could say.
  // onToolChange cannot cover it: with no API there is nothing to subscribe to.
  if (!getModelContext()) {
    void whenSupported().then((appeared) => {
      if (!appeared) return;
      void render(root);
      onToolChange(() => {
        void render(root);
      });
    });
  }
}
