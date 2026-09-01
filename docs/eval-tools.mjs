// Deterministic behaviour checks, run through the real WebMCP surface.
//
// READ THE SCOPE BEFORE QUOTING A NUMBER FROM THIS. Every scenario here is
// driven by executeTool with fixed arguments. It measures what the tools do,
// not what a model chooses to call. Whether an LLM picks the right tool, or
// recovers from an ambiguous prompt, is not measured anywhere in this repo and
// must not be claimed. Chrome's own WebMCP evaluation guidance separates the
// two, and this file is the deterministic half of it.
//
// What it does check is the half that matters most here: that a number without
// evidence behind it cannot reach the page, whatever the agent says.
//
//   npm run dev              # serves the app
//   node docs/eval-tools.mjs # add --url=https://webmcp-superweb.vercel.app/
//
// Needs Chrome with WebMCP on. Exact casing: --enable-features=WebMCP.

import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const arg = (n, d) => process.argv.find(a => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=") ?? d;
const URL_UNDER_TEST = arg("url", "http://localhost:5173/");
const PORT = Number(arg("port", "9337"));
const CHROME = arg("chrome", process.platform === "win32"
  ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
  : process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "google-chrome");

const sleep = ms => new Promise(r => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "webmcp-eval-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--enable-features=WebMCP",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, URL_UNDER_TEST,
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
  throw new Error(`no debuggable page. Is ${URL_UNDER_TEST} being served?`);
}

const page = await target();
ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); pending.get(m.id)?.(m); pending.delete(m.id); };
const send = (method, params = {}) =>
  new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) return `THREW: ${r.result.exceptionDetails.text}`;
  return r.result?.result?.value;
}

// executeTool takes its arguments as a JSON string and resolves to a JSON
// string. Measured, and not what the explainer implies.
const call = (name, args = {}) => evaluate(`(async () => {
  const ts = await document.modelContext.getTools();
  const t = ts.find(t => t.name === ${JSON.stringify(name)});
  if (!t) return "TOOL ABSENT";
  return await document.modelContext.executeTool(t, ${JSON.stringify(JSON.stringify(args))});
})()`);
const pageText = () => evaluate(`document.body.innerText`);
const has = n => evaluate(`document.modelContext.getTools().then(ts => ts.some(t => t.name === ${JSON.stringify(n)}))`);

await send("Runtime.enable");
await sleep(3000);

const results = [];
async function check(scenario, expected, run) {
  let passed = false, saw = "";
  try {
    saw = String(await run());
    passed = saw === "PASS";
  } catch (e) {
    saw = `threw: ${e.message}`;
  }
  results.push({ scenario, expected, passed, saw });
  console.log(`${passed ? "pass" : "FAIL"}  ${scenario}${passed ? "" : `  <- ${saw.slice(0, 200)}`}`);
}

// ---------------------------------------------------------------- public
console.log("-- public surface --------------------------------------------");

await check("A camera with no product open offers no recipe", "tool absent", async () =>
  (await has("get_preview_recipe")) === false ? "PASS" : "the recipe tool was registered with nothing open");

const search = String(await call("search_products", { query: "camera", limit: 3 }));
const code = /\b(\d{7})\b/.exec(search)?.[1];
await check("search_products finds a photographed camera", "a 7 digit code", async () =>
  code ? "PASS" : `no code in: ${search.slice(0, 120)}`);

await call("get_product", { product: code });
await sleep(1200);

await check("Opening a camera registers the recipe", "tool present", async () =>
  (await has("get_preview_recipe")) ? "PASS" : "the recipe tool did not appear");

await check("An invented look is refused, not improvised", "refusal naming the real looks", async () => {
  const r = String(await call("get_preview_recipe", { look: "Cyberpunk neon" }));
  return /has not written a look/.test(r) && /Do not improvise/.test(r)
    ? "PASS" : r.slice(0, 160);
});

await check("An authored look returns its treatment", "the written fields", async () => {
  const r = String(await call("get_preview_recipe", { look: "Silent film 1926" }));
  // executeTool resolves to a JSON string, so the quotes inside the embedded
  // json block arrive escaped. Match either spelling rather than the pretty one.
  return /sepia/.test(r) && /styling suggestion/.test(r) && /measured\\?":\s*false/.test(r)
    ? "PASS" : r.slice(0, 160);
});

// ---------------------------------------------------------------- sign in
console.log("");
console.log("-- internal surface ------------------------------------------");

// The sign-in control is a Radix dropdown and uses pointer capture, so a
// synthetic .click() alone does not open it.
await evaluate(`(async () => {
  const b = [...document.querySelectorAll("header button")].find(x => /sign in/i.test(x.textContent || ""));
  b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
  b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0 }));
  b.click();
  await new Promise(r => setTimeout(r, 400));
  const item = [...document.querySelectorAll('[role="menuitem"]')][0];
  item.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
  item.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0 }));
  item.click();
  return true;
})()`);
await sleep(2500);

await check("Signing in swaps the catalogue tools away", "get_product gone", async () =>
  (await has("get_product")) === false ? "PASS" : "a catalogue tool survived the swap");

await check("A malformed month is refused", "no dashboard move", async () => {
  const r = String(await call("get_metric", { metric: "net_revenue", period: "2023-13" }));
  return /not a month|did not move|nothing moved/i.test(r) ? "PASS" : r.slice(0, 160);
});

await check("A dimension with no value is refused, not widened", "refusal", async () => {
  const r = String(await call("check_data_trust", { metric: "net_revenue", dimension: "country" }));
  return /value|required|both|scope/i.test(r) ? "PASS" : r.slice(0, 160);
});

await check("Germany is blocked", "blocked, 1,739 of 1,739", async () => {
  const r = String(await call("check_data_trust", { metric: "net_revenue", dimension: "country", value: "Germany" }));
  return /blocked/i.test(r) && /1,?739/.test(r) ? "PASS" : r.slice(0, 200);
});

await check("Online is degraded, not blocked", "degraded, 4,788 of 18,831", async () => {
  const r = String(await call("check_data_trust", { metric: "net_revenue", dimension: "country", value: "Online" }));
  return /degraded/i.test(r) && /4,?788/.test(r) ? "PASS" : r.slice(0, 200);
});

await check("A slice with no check answers unchecked", "unchecked, not ok", async () => {
  const r = String(await call("check_data_trust", {
    metric: "net_revenue", dimension: "category", value: "Cameras and camcorders" }));
  return /unchecked/i.test(r) ? "PASS" : r.slice(0, 200);
});

await check("A failed check registers the diagnostic tools", "explain_data_issue present", async () =>
  (await has("explain_data_issue")) ? "PASS" : "diagnostics did not appear after a failure");

// ---------------------------------------------------------------- report
console.log("");
console.log("-- the report ------------------------------------------------");

await call("start_report", {});
await sleep(1200);
await call("draft_report", {
  metric: "net_revenue",
  period: "2023-11",
  sections: [
    { heading: "Canada", dimension: "country", value: "Canada" },
    { heading: "Germany", dimension: "country", value: "Germany", commentary: "Revenue was $999,999." },
    { heading: "Online", dimension: "country", value: "Online" },
  ],
});
await sleep(1500);
const drafted = String(await pageText());

await check("A figure the agent invented never reaches the page", "no 999,999 anywhere", async () =>
  drafted.includes("999,999") ? "the fabricated figure is on the page" : "PASS");

await check("A blocked section publishes no figure", "Germany carries no number", async () =>
  /Germany[\s\S]{0,200}No number written/.test(drafted) ? "PASS" : "Germany was published with a figure");

await check("A degraded section keeps its figure and its gap", "Online states both", async () =>
  /Online[\s\S]{0,300}\$/.test(drafted) && /4,788 of 18,831/.test(drafted)
    ? "PASS" : "Online lost either its figure or its shortfall");

await check("The draft lands unapproved", "awaiting review", async () =>
  /awaiting your review/i.test(drafted) ? "PASS" : "the draft did not ask for a human");

await check("No tool can approve the report", "no approval tool registered", async () =>
  (await evaluate(`document.modelContext.getTools().then(ts => ts.some(t => /approv/i.test(t.name)))`)) === false
    ? "PASS" : "an approval tool is registered, so the human step is theatre");

await check("build_deck refuses an unapproved draft", "refusal pointing at the button", async () => {
  const r = String(await call("build_deck", {}));
  return /nobody has approved|Approve for export/.test(r) ? "PASS" : r.slice(0, 200);
});

await evaluate(`(() => {
  const b = [...document.querySelectorAll("button")].find(x => /approve for export/i.test(x.textContent || ""));
  if (!b) return false;
  b.click();
  return true;
})()`);
await sleep(800);

await check("build_deck runs once a person approved", "an outline naming what was held", async () => {
  const r = String(await call("build_deck", {}));
  return /Deck outline/.test(r) && /Not published: Germany/.test(r) ? "PASS" : r.slice(0, 200);
});

const passed = results.filter(r => r.passed).length;
console.log("");
console.log("-- result ----------------------------------------------------");
console.log(`${passed}/${results.length} deterministic scenarios passed.`);
console.log("Scope: tool behaviour with fixed arguments. Model tool-selection is not measured here.");
cleanup();
process.exit(passed === results.length ? 0 : 1);
