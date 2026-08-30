// Remeasure the WebMCP browser API. The claims in src/mcp/model-context.d.ts,
// README and docs/PLAN.md are whatever this script prints, and nothing else.
//
// ADR 0001 keeps the ETL real so lineage points at something true. This is the
// same argument applied to the browser: a version stamp nobody can rerun is a
// claim about a browser rather than a fact about one. A previous stamp cited a
// scratchpad file that no longer existed, and its assertion about
// `navigator.modelContext` turned out to be wrong.
//
//   npm run dev                       # serves the app
//   node docs/probe-modelcontext.mjs  # add --url=http://localhost:5174/
//
// Needs Chrome with WebMCP on. The flag is a feature name, exact casing:
// --enable-features=WebMCP. Neither --enable-blink-features nor any other
// spelling turns it on.

import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const arg = (n, d) => process.argv.find(a => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=") ?? d;

const URL_UNDER_TEST = arg("url", "http://localhost:5173/");
const PORT = Number(arg("port", "9333"));
const CHROME = arg("chrome", process.platform === "win32"
  ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
  : process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "google-chrome");

const sleep = ms => new Promise(r => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "webmcp-probe-"));
const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--enable-features=WebMCP",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  URL_UNDER_TEST,
], { stdio: "ignore" });

let ws;
const cleanup = () => { try { ws?.close(); } catch {} chrome.kill(); };
process.on("exit", cleanup);

async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find(t => t.type === "page" && !t.url.startsWith("devtools:"));
      if (page?.webSocketDebuggerUrl) return page;
    } catch {}
    await sleep(250);
  }
  throw new Error(`no debuggable page. Is ${URL_UNDER_TEST} being served, and is ${CHROME} the right binary?`);
}

const page = await target();
ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  pending.get(m.id)?.(m);
  pending.delete(m.id);
};
const send = (method, params = {}) =>
  new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) return `THREW: ${r.result.exceptionDetails.text}`;
  return r.result?.result?.value;
}

await send("Runtime.enable");
await sleep(3000);

const NAMES = `document.modelContext.getTools().then(ts => ts.map(t => t.name).sort())`;

console.log("url     :", URL_UNDER_TEST);
console.log("chrome  :", await evaluate(`(navigator.userAgent.split(" ").find(p => p.startsWith("Chrome/") || p.startsWith("HeadlessChrome/")) || navigator.userAgent)`));
console.log("");

console.log("-- shape of the API ------------------------------------------");
console.log(await evaluate(`(() => {
  const d = document.modelContext, n = navigator.modelContext;
  if (!d) return "document.modelContext is ABSENT. Chrome needs --enable-features=WebMCP.";
  return JSON.stringify({
    documentSpelling: typeof d,
    navigatorSpelling: typeof n,
    sameObject: d === n,
    isEventTarget: d instanceof EventTarget,
    members: Object.getOwnPropertyNames(Object.getPrototypeOf(d)).filter(k => k !== "constructor").sort(),
    unregisterTool: typeof d.unregisterTool,
    declarativeRespondWith: typeof SubmitEvent !== "undefined" && "respondWith" in SubmitEvent.prototype,
  }, null, 2);
})()`));

console.log("");
console.log("-- inputSchema comes back as a string ------------------------");
console.log(await evaluate(`document.modelContext.getTools().then(ts =>
  ts.length ? JSON.stringify({ sample: ts[0].name, inputSchemaType: typeof ts[0].inputSchema, annotations: ts[0].annotations, hasTitle: "title" in ts[0] }) : "no tools registered")`));

console.log("");
console.log("-- a declarative tool's lifetime is its element's ------------");
const before = await evaluate(NAMES);
console.log("public surface   :", Array.isArray(before) ? `${before.length} tools` : before);
console.log("                  ", before);
console.log("form in the DOM  :", await evaluate(`!!document.querySelector('form[toolname="search_catalog_form"]')`));

console.log("click            :", await evaluate(`(() => {
  const b = [...document.querySelectorAll("header button")].find(x => /sign in/i.test(x.textContent || ""));
  if (!b) return "no sign-in button found; is the public surface on screen?";
  b.click();
  return JSON.stringify((b.textContent || "").trim());
})()`));

await sleep(2500);
const after = await evaluate(NAMES);
console.log("internal surface :", Array.isArray(after) ? `${after.length} tools` : after);
console.log("                  ", after);
console.log("form in the DOM  :", await evaluate(`!!document.querySelector('form[toolname="search_catalog_form"]')`));

if (Array.isArray(before) && Array.isArray(after)) {
  const dropped = before.filter(n => !after.includes(n));
  console.log("");
  console.log("dropped on switch:", dropped);
  console.log(dropped.includes("search_catalog_form")
    ? "OK. The browser unregistered the declarative tool when React unmounted the form."
    : "CHECK THIS. search_catalog_form survived the switch; the docs say it should not.");
}

cleanup();
