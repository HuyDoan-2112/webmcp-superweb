# SuperWeb

SuperWeb is a fictional trade catalogue and revenue dashboard for Kestrel
Supply Co. The page registers WebMCP tools that use the same state setters and
API endpoints as the visible interface. When an agent filters the catalogue or
drafts a report, the person at the screen sees the same result.

| Resource | Link |
| --- | --- |
| Live app | [webmcp-superweb.vercel.app](https://webmcp-superweb.vercel.app/) |
| Demo video | [Watch on YouTube](https://youtu.be/nIOFaWsP4_Y) |
| Agent brief | [llms.txt](https://webmcp-superweb.vercel.app/llms.txt) |
| Challenge | [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/) |
| License | [MIT](LICENSE) |

## What the page does

The customer signed-out surface is a catalogue of photographed products. Its tools
search and filter the catalogue, open and compare products, manage a cart and
wishlist, file trade enquiries, switch between five languages, and check the
claims behind four promotions.

Opening a product with a Kestrel profile adds "get_preview_recipe". It returns
the shop's written notes and named photo treatments. It never invents aperture,
sensor size, wattage, or any other measurement absent from the catalogue.

When staff signed-in replaces the catalogue with a revenue dashboard. Its tools read
six metrics, split them by supported dimensions, draft a report, and trace
missing rows to the failed pipeline stage.

## Why this uses WebMCP

A hosted MCP server can query a warehouse. It cannot know which product is open,
which controls moved, or whether the report on the page has human approval.
SuperWeb keeps those facts in the page.

- Imperative tools call the same store setters as buttons and filters.
- Reads go through the same "/api/*" endpoints as React components.
- Tool groups register and unregister as the visible surface changes.
- "build_deck" reads the report currently on the page and refuses until a person
  presses **Approve for export**.

This abridged excerpt shows the important part of "search_products": the tool
moves the same catalogue state as the visible controls, then reads the resulting
page through the products API.

"ts
// src/mcp/tools/catalog.ts
name: "search_products",
inputSchema: {
  type: "object",
  properties: {
    query: { type: "string" },
    category: enumOrText(facets?.categories, "Limit to one category."),
    brand: enumOrText(facets?.brands, "Limit to one brand."),
    limit: { type: "number", minimum: 1, maximum: CATALOG_PAGE_SIZE },
  },
  required: [],
},
annotations: { readOnlyHint: false, untrustedContentHint: true },
execute: async (args) => {
  if (typeof args.query === "string") setCatalogSearch(args.query);
  if (typeof args.category === "string")
    setCatalogCategory(args.category === "" ? null : args.category);
  if (typeof args.brand === "string")
    setCatalogBrand(args.brand === "" ? null : args.brand);

  const state = getState();
  const found = await readProducts(pageQuery(state));
  // The full handler reports the same count and products now shown on the page.
},
"

For example, an agent can call it with "{"query":"camera","limit":3}". The
catalogue search box and grid move before the tool reports those results.

The catalogue search also demonstrates declarative WebMCP. Chrome turns the
existing form into "search_catalog_form" from its HTML attributes:

"tsx
<form
  toolname="search_catalog_form"
  tooldescription="Search the Kestrel Supply Co. trade catalogue by keyword and narrow it to one category."
  toolautosubmit=""
  onSubmit={onSubmit}
>
  <input name="q" required toolparamdescription="Free text matched against product name, product code and brand." />
  <select name="category" toolparamdescription="Limit to one category." />
</form>
"

The browser fills the real controls and runs the form's submit handler. The
handler returns a count, then points the agent to "search_products" for supplier
copy because declarative tools cannot declare "untrustedContentHint".

## Run it locally

Requirements:

- Node.js from [.nvmrc](.nvmrc)
- A browser with "document.modelContext", such as ChatGPT's in-app browser or
  Chrome with WebMCP enabled

"bash
npm install
npm run dev
"

Vite serves the React app and loads "api/*.ts" through
"vite-api-plugin.ts", so one process runs the local application at
"http://localhost:5173".

Clear the site's session cookie before rehearsing the surface swap. A saved
staff session opens directly on the dashboard.

## Demo prompts

Start at the product catalogue and ask:

> I need a camera under $300 before delivery for outdoor Grade 12 photos. Use
> the tools on this Kestrel page to find no more than three options. Compare
> only facts the page provides. When I choose one, get its Kestrel preview
> recipe and check whether the current promotion claims hold up.

Choose a camera, then ask for one of its named looks. The tool returns a text
recipe. No image crosses WebMCP. Any image edit happens in the caller's own
image model and must be described as an illustrative treatment, not a hardware
test.

Sign in as Maya and ask:

> Draft the November 2023 net revenue report by country. Publish only figures
> the pipeline supports, and explain anything you refuse.

Four countries receive figures. France, Germany, Italy, and the Netherlands do
not. The report appears on the page as an unapproved agent draft. Ask for a deck
before approval and "build_deck" refuses. Press **Approve for export** and call
it again to receive the slide outline.

Switch to Tom'dashboard and ask:

> Trace the lineage behind Germany's missing revenue.

The answer now includes the check name, row counts, and the failed silver stage.
The audience changes the depth of the answer, not whether the question may be
asked.

## Architecture

"text
Contoso parquet source
        |
        v
etl/  -> data/gold/*.parquet + data/meta/*.json
        |
        v
api/  -> read-only query, trust, lineage, product, and run endpoints
        |
        v
React store <-> visible UI
        ^
        |
src/mcp/ WebMCP tools
"

"shared/metrics.ts" defines metrics and dimensions once. The API uses it to
compose SQL, and the tool layer uses it to build schema enums.

## Verification

"bash
npm run verify
npm run dev
npm run verify:webmcp
npm run eval
"

"npm run verify" type-checks and builds the app. The three WebMCP probes launch
Chrome and inspect registration, the report flow, and the conditional preview
tool. "npm run eval" runs 20 fixed tool scenarios through
"document.modelContext".

The evaluation covers tool behavior with fixed arguments. It does not measure
whether a model chooses the right tool or recovers from an ambiguous prompt.

The product tool counts documented in [src/mcp/README.md](src/mcp/README.md)
exclude the temporary "webmcp_probe" in "src/mcp/register.ts". Remove that probe
before the final deployment.

## Known limits

- The "build_deck" tool returns a slide outline, not a ".pptx" file.
- The staff switcher is a demo session, not an authentication system.
- The pipeline records scoped quality checks for "net_revenue", country, and
  channel. Other slices can return "unchecked".
- WebMCP tool results are text in the tested Chrome build. The page returns a
  photo recipe, not image bytes.

## Documentation

| File | Purpose |
| --- | --- |
| [SUBMISSION.md](SUBMISSION.md) | Copy-ready Devpost story and verified project facts |
| [src/mcp/README.md](src/mcp/README.md) | Tool inventory, registration rules, and the recipe for adding a tool |
| [etl/README.md](etl/README.md) | Source data, transformations, planted FX gap, and rebuild steps |
| [docs/open-questions.md](docs/open-questions.md) | Behavior measured against the current WebMCP implementation |
| [docs/adr/](docs/adr/) | Decisions that are surprising in the code and costly to reverse |
| [CLAUDE.md](CLAUDE.md) | Working rules and project glossary for coding agents |

## License and data

SuperWeb is MIT licensed. The dashboard shell and UI components adapt
[satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin); its MIT
license remains at [vendor/shadcn-admin/LICENSE](vendor/shadcn-admin/LICENSE).

The sample business data comes from Microsoft's MIT-licensed Contoso Data
Generator V2 and is presented as the fictional Kestrel Supply Co. No Microsoft
involvement is implied.
