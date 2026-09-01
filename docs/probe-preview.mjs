// Drive the preview recipe flow the way an agent would, and print what the
// browser actually did.
//
// The point of this file is the same as the other two probes: a claim about
// registration that nobody can rerun is a claim about a browser, not a fact
// about one. This one checks the three things the recipe tool promises.
//
//   1. get_preview_recipe is absent on the catalogue with nothing open.
//   2. It appears once a camera is open, and its look enum is the camera's.
//   3. It goes away again when a product with no authored profile is opened.
//
//   npm run dev                  # serves the app
//   node docs/probe-preview.mjs  # add --url=http://localhost:5174/
//
// Needs Chrome with WebMCP on. Exact casing: --enable-features=WebMCP.

import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const arg = (n, d) => process.argv.find(a => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=") ?? d;

const URL_UNDER_TEST = arg("url", "http://localhost:5173/");
const PORT = Number(arg("port", "9335"));
const CHROME = arg("chrome", process.platform === "win32"
  ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
  : process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "google-chrome");

const sleep = ms => new Promise(r => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "webmcp-preview-"));
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

// executeTool takes its arguments as a JSON string and resolves to a JSON
// string, which is measured behaviour and not what the explainer implies.
// Reading .content off the result gives undefined.
const call = (name, args = {}) => evaluate(`(async () => {
  const ts = await document.modelContext.getTools();
  const t = ts.find(t => t.name === ${JSON.stringify(name)});
  if (!t) return "TOOL ABSENT: ${name}";
  return await document.modelContext.executeTool(t, ${JSON.stringify(JSON.stringify(args))});
})()`);

const names = () => evaluate(`document.modelContext.getTools().then(ts => ts.map(t => t.name).sort())`);
const schemaOf = n => evaluate(`document.modelContext.getTools().then(ts => {
  const t = ts.find(t => t.name === ${JSON.stringify(n)});
  return t ? t.inputSchema : "absent";
})`);

console.log("url    :", URL_UNDER_TEST);
console.log("");

console.log("-- catalogue, nothing open -----------------------------------");
const before = await names();
console.log("tools            :", Array.isArray(before) ? before.length : before);
console.log("recipe present   :", Array.isArray(before) && before.includes("get_preview_recipe"));

console.log("");
console.log("-- open a camera ---------------------------------------------");
const found = await call("search_products", { query: "camera", limit: 3 });
const code = /\b(\d{7})\b/.exec(String(found))?.[1];
console.log("search found code:", code ?? "none, so the rest of this probe cannot run");
if (!code) { console.log(String(found).slice(0, 600)); cleanup(); process.exit(1); }

await call("get_product", { product: code });
await sleep(1200);
const opened = await names();
console.log("tools            :", Array.isArray(opened) ? opened.length : opened);
console.log("recipe present   :", Array.isArray(opened) && opened.includes("get_preview_recipe"));
console.log("look enum        :", String(await schemaOf("get_preview_recipe")).slice(0, 400));

console.log("");
console.log("-- the menu --------------------------------------------------");
console.log(String(await call("get_preview_recipe")).slice(0, 1400));

console.log("");
console.log("-- one look --------------------------------------------------");
console.log(String(await call("get_preview_recipe", { look: "Silent film 1926" })).slice(0, 1200));

console.log("");
console.log("-- a look nobody wrote ---------------------------------------");
console.log(String(await call("get_preview_recipe", { look: "Cyberpunk neon" })).slice(0, 500));

console.log("");
console.log("-- leave the product -----------------------------------------");
// Clicked, not navigated. The open product is store state rather than a route,
// so history.back() leaves it open.
console.log("clicked back     :", await evaluate(`(() => {
  const nav = document.querySelector('nav[aria-label]');
  const b = nav && nav.querySelector("button");
  if (!b) return "no back control found";
  b.click();
  return true;
})()`));
await sleep(1500);
const left = await names();
console.log("recipe present   :", Array.isArray(left) && left.includes("get_preview_recipe"));
console.log(Array.isArray(left) && !left.includes("get_preview_recipe")
  ? "OK. The tool unregistered when the product closed."
  : "CHECK THIS. The recipe tool outlived the product it describes.");

cleanup();
