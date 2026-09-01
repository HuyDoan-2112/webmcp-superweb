# WebMCP hackathon demo video

Working title: **I asked AI to pick a camera. It gave me homework.**

Target length: **2 minutes 40 seconds**

One-line pitch: A Grade 12 student lets ChatGPT use a store's live WebMCP tools to shortlist a camera, then uses a page-owned preview recipe with ChatGPT Images to simulate the chosen look on their own photo.

## The call

Use the camera story. It gives the demo a human problem, a visible result, and a reason for the agent to work with both a website and an image.

Change one part of the original idea: compare ChatGPT without the Kestrel page to the same ChatGPT with the page open. Do not compare Claude with Amazon. The same-model test makes the point cleaner: the model did not change; the website did.

Shopping by itself is not enough. OpenAI already showcases a WebMCP grocery store, and it also showcases a WebMCP photo editor. The distinct idea here is the handoff between page-owned camera data and a user-owned photo. The preview must be the centre of the story, not a final flourish.

There is one hard recording gate. The live catalogue has price, colour, weight, category, and product identity. It does not have sensor, lens, aperture, or image-character data. Add an honest Kestrel preview recipe for three demo cameras before filming. Do not let the model invent camera specifications.

## The first 60 seconds

This is the complete story cut. Keep the screen movement fast and the delivery dry.

| Time | Picture | Spoken line | Edit note |
| --- | --- | --- | --- |
| 0:00-0:04 | Face camera. Hold up one painfully ordinary phone photo. | "Tomorrow is my last first day of school. I want one good photo before Grade 12 turns into a group project with consequences." | Start on the face, no logo card. Cut on "consequences." |
| 0:04-0:09 | ChatGPT, before opening Kestrel. Show a real answer about megapixels, sensor size, and aperture. | "I asked AI which camera to buy. It gave me megapixels, sensor sizes, aperture, and a research plan." | Highlight three bits of jargon with quick boxes. |
| 0:09-0:13 | Fast scroll through a dense camera grid. | "I asked for a camera. It assigned homework." | Stop the music for half a beat after "homework." |
| 0:13-0:18 | Put the original school photo beside the generic advice. | "I do not need a camera thesis. I need to know if this looks cinematic or like school CCTV." | This is the main joke. Do not add slang on top of it. |
| 0:18-0:22 | Plain message bubble: "Try Kestrel in the ChatGPT browser." | "Then my friend sends me this." | Use an unbranded message bubble. One notification sound. |
| 0:22-0:28 | Open Kestrel. Briefly reveal the live tool drawer and the camera category. | "This is Kestrel. Same model. The page is the upgrade." | Let the real interface carry this shot. No fake terminal. |
| 0:28-0:35 | Type the prepared shopping prompt. | "I give it my budget, my country, and the look I want. It asks two questions that actually matter." | Speed up typing, then return to real time for the answer. |
| 0:35-0:42 | ChatGPT asks about portraits versus groups and compact versus interchangeable lens. Answer in one line. | "Both. Compact preferred, but I can carry one lens if the result is better." | Keep the answer visible long enough to read. |
| 0:42-0:50 | Tool calls search the catalogue and compare no more than three products. The page filters from the live catalogue to the shortlist. | "It searches the listings on this page, compares the options, and changes the page with me." | Show the page and tool activity together. Avoid a full-screen chat shot. |
| 0:50-0:56 | Open the chosen camera. Upload the school photo in ChatGPT. The page exposes the camera preview recipe. | "Then I upload my photo. Kestrel supplies a labelled preview recipe for the camera." | Jump over image generation time, but do not fake the request or result. |
| 0:56-1:01 | Original and generated preview side by side. | "Okay. That one makes Grade 12 look intentional." | Hold for a beat. Add labels in the editor, not inside the generated image. |

## The technical cut

| Time | Picture | Spoken line | What the shot proves |
| --- | --- | --- | --- |
| 1:01-1:10 | Kestrel page on the left, live tool drawer on the right. | "Here is what happened. I did not teach the model this store, and I did not automate a pile of clicks. The page registered its own tools." | WebMCP is part of the product, not a narration trick. |
| 1:10-1:23 | Show `search_catalog_form` in the drawer, then the form markup and `document.modelContext.registerTool`. | "The search form is declarative HTML. The richer tools use JavaScript, with schemas built from the live catalogue." | Both WebMCP registration styles are present. |
| 1:23-1:38 | Select a camera and show `get_camera_preview_recipe` appear. Return to the catalogue and show it disappear. | "When a supported camera is selected, the page adds one preview tool. Leave the product and it goes away, so the model only sees actions that make sense now." | Registration follows page state. This shot requires the new tool. |
| 1:38-1:51 | Let ChatGPT filter or open a product while the visible interface updates. | "The tool calls use the same store and API as the interface. The agent and the person stay on one page, in one state." | The agent does not operate a hidden copy of the application. |
| 1:51-2:08 | Diagram with three boxes: Kestrel tool result, ChatGPT, ChatGPT Images. Keep the uploaded photo on the ChatGPT-to-Images side. | "The photo never travels through WebMCP. Kestrel returns structured product data and a transparent simulation recipe. ChatGPT Images handles the edit as a separate step. Multimodal WebMCP input and output are still open work in the spec." | The architecture is technically honest. |
| 2:08-2:21 | Staff sign-in. The public tool list is replaced by the internal dashboard list. | "Tools follow context, not just the domain. Sign in as staff and the public shopping set is replaced with dashboard tools instead of leaving the model a junk drawer of irrelevant actions." | One origin can expose different tools for different surfaces. |
| 2:21-2:31 | Quick report shot showing a verified section and a blocked section. Then return to the camera preview. | "The same pattern can filter a catalogue, prepare a report, or stop an unsafe number before it is published." | The implementation is broader than one scripted shopping path. |
| 2:31-2:40 | Face camera, then end card with live URL and repository. | "The model did not become smarter. The handoff did. I got a camera choice, a preview, and one less excuse to miss first period." | End on the outcome, then show the project links. |

Estimated narration is about 300 words. Read it at a relaxed 120 to 130 words per minute and let the silent UI beats do some work.

## Prompts to record

### Baseline prompt

Use the same ChatGPT model before opening Kestrel:

> I need a camera under $300 for my final first day of high school. I want natural colour and some background separation. What should I buy?

Record the real answer. Do not manufacture a deliberately bad response. Freeze on the part that asks the viewer to research products, prices, stock, or retailer listings. If the answer is genuinely useful, say so. The limitation is that it cannot reliably operate Kestrel's current catalogue or keep the page in sync yet.

### WebMCP shopping prompt

Use this after opening the Kestrel page in ChatGPT's built-in browser:

> I'm in Canada and need a camera under $300 before delivery for outdoor Grade 12 photos. I want natural colour and some background separation. Use the tools on this Kestrel page to find no more than three options. Ask at most two questions you still need. Compare only facts the page actually provides. When I choose one, get its Kestrel preview recipe.

Prepared answer to the two useful questions:

> Mostly portraits, but there will be group photos too. Compact is better, but I can carry one lens if the result is meaningfully better.

If ChatGPT asks about facts already present in the prompt, rerun the take. Do not claim Kestrel knows the user's country, language, or preferences. The current session only knows the signed-in user's role and audience. Put reproducibility ahead of a magical-looking profile claim.

### Image edit prompt

Send this only after the agent has returned the selected camera's preview recipe:

> Edit the uploaded school photo using only the visual adjustments in the Kestrel preview recipe. Preserve the person's identity, face, expression, pose, clothing, background geometry, framing, and any real objects. Change only the depth of field, colour response, contrast, highlight rolloff, grain or noise, and sharpness named in the recipe. Do not add people, props, text, logos, or new scenery. Return one image. Treat this as an illustrative look simulation, not a physical camera test.

Reject the take if the face, clothes, school, or composition changes. One stable preview is stronger than three inconsistent ones.

## The minimum feature to add before filming

Do not build a camera simulator. Add one small, explicit read tool.

Tool name:

```text
get_camera_preview_recipe
```

Register it only when all three conditions are true:

- The public catalogue surface is active.
- `selectedProductKey` points to a camera product.
- Kestrel has an authored preview profile for that product family.

Keep three profiles in code for the three hero products. Put them beside the catalogue tools in `src/mcp/tools/catalog.ts`; there is no reason to add a database table for a hackathon demo. Add one `ToolGroup` in `src/mcp/register.ts` and reuse the existing abort-based lifecycle in `src/mcp/adapter.ts`.

Suggested output shape:

```json
{
  "product": {
    "productKey": 123,
    "name": "A. Datum Full Frame Digital Camera X300",
    "productCode": "0401098"
  },
  "profile": {
    "version": "kestrel-demo-1",
    "basis": "Kestrel-authored illustrative profile",
    "depthOfField": "moderate subject separation",
    "colour": "neutral with gently warm skin tones",
    "contrast": "medium-low",
    "highlightRolloff": "soft",
    "grain": "very low",
    "sharpness": "natural"
  },
  "limitations": [
    "This is a visual simulation, not a prediction from measured hardware data.",
    "Lighting, lens choice, distance, and camera settings can change a real result."
  ]
}
```

The word "recipe" matters. Do not call these manufacturer specifications, measurements, or a guaranteed camera effect. The source catalogue does not support those claims.

The clean architecture is:

```text
Kestrel page
  -> WebMCP returns product facts and a look recipe
  -> ChatGPT chooses and explains
  -> ChatGPT Images edits the user's uploaded photo
```

WebMCP does not carry the photo. That is not a weakness to hide. It is a useful boundary to explain because multimodal tool input and output remain open questions in the current WebMCP work.

## What to show from the current build

The live site already gives you strong proof shots:

- The full catalogue has 885 products; the camera category has 130.
- A public product page currently shows 12 registered tools, including the declarative `search_catalog_form`.
- Staff sign-in replaces the public set with 8 internal tools.
- The report can show verified sections, a degraded Online section, and four blocked country sections caused by missing exchange rates.
- `src/mcp/register.ts` already swaps public, internal, report, and diagnostic groups from page state.
- `src/mcp/adapter.ts` already uses `AbortController` to remove a tool group cleanly.

Avoid speaking the public and internal tool counts. The new preview tool will change the public count, and report or diagnostic state can change the internal count. Let the drawer show the live number.

## Recording order

Record the risky material first. Everything else can be cut around it.

1. Run the complete WebMCP shopping transcript with GPT-5.6 Sol or GPT-5.6 Terra.
2. Generate the photo preview and confirm that identity and composition stay stable.
3. Record the selected-camera tool appearing and disappearing.
4. Record the staff sign-in tool swap.
5. Record the baseline prompt with the same model.
6. Record the face-camera lines.
7. Capture code and diagram inserts last.

As of August 31, 2026, the official site-tools guide says WebMCP is disabled for GPT-5.6 Luna. Do not record the demo with Luna. Use Sol or Terra and verify the tool drawer before every take.

## Edit direction

Borrow the useful part of the Cluely launch grammar: a concrete social problem in the first seconds, fast pattern changes, and a product action that resolves the tension. Do not borrow the fake-date premise, the controversy, or their footage.

Use the Linear side of the reference for the product shots: calm motion, crisp crops, and enough time to understand each state change. The comedy should come from the situation, not spinning captions.

Keep these three jokes and cut any extras:

- "Grade 12 turns into a group project with consequences."
- "I asked for a camera. It assigned homework."
- "Cinematic or like school CCTV."

Visual rules:

- Use real screen recordings for every product claim and tool call.
- Put exact labels, prices, tool names, and disclaimers in the editor as normal text overlays.
- Use sentence-case captions with no more than seven words on screen at once.
- Use one accent colour sampled from Kestrel. Do not redesign the existing product identity.
- Use cuts and simple scale moves. Skip template transitions, fake chat bubbles beyond the one friend message, and fake terminal output.
- Keep the cursor visible for meaningful actions, then hide it for held product shots.
- Use original or properly licensed music. The Devpost rules do not give a pass for copyrighted music or third-party promo footage.

For the school photo, use a staged photo of yourself or a consenting adult. Hide the real school name, timetable, student ID, street signs, and location metadata. The character can be in Grade 12 without publishing a minor's real identity or school.

## Title, thumbnail, and description

Recommended title:

> I asked AI to pick a camera. It gave me homework. | WebMCP demo

Thumbnail:

- Left: the ordinary source photo.
- Right: the simulated camera look.
- Short text: **AI, TRY THE CAMERA**
- Small Kestrel tool-drawer crop in the corner.

Do not put Claude, Amazon, Linear, or Cluely logos in the thumbnail. They are references for the edit, not part of the product.

Short video description:

> SuperWeb lets a live website register structured tools for ChatGPT. In this demo, Kestrel's catalogue helps a student shortlist a camera and provides a transparent preview recipe for ChatGPT Images. The page, the person, and the agent stay in the same visible workflow.

Put the live URL, public repository, and licence directly below that paragraph.

## Claims to keep honest

| Claim | Use it? | Reason |
| --- | --- | --- |
| "ChatGPT searched Kestrel's live catalogue through WebMCP." | Yes | The current public tools support catalogue search, filtering, product detail, and comparison. |
| "The page changed with the agent's actions." | Yes | The tools call the same store setters used by the visible interface. |
| "WebMCP sent my photo to the page." | No | Current WebMCP tool results are text-based; multimodal input and output remain open work. |
| "Kestrel knew I was in Canada and preferred English." | No | Those facts are not in the current site session. Put them in the prompt or set the visible controls. |
| "This is what the physical camera will produce." | No | The catalogue has no measured optical data. Call it an illustrative simulation. |
| "The site exposes every tool all the time." | No | The project deliberately swaps tool groups with page and session state. |
| "Luna ran the WebMCP tools." | No | The current official guide says Luna has WebMCP disabled. Use Sol or Terra. |

## Go or no-go check

Film the camera version only if all of these pass in one uninterrupted rehearsal:

- The site tools are discovered in ChatGPT's built-in browser.
- The shopping prompt returns no more than three page-backed options.
- Choosing a supported camera exposes the preview-recipe tool.
- Leaving that camera removes the tool.
- The recipe contains a visible simulation disclaimer.
- The image edit preserves identity, clothing, framing, and the school scene.
- The visible page and the agent agree on the selected product.

If any of those fail the day before submission, use the existing internal revenue-report flow as the main demo. It is already complete, has dynamic tools, and contains a clear trust failure that the agent handles correctly. A working, less cinematic demo will score better than a generated preview that only succeeds in the edit.

## Submission facts

- The challenge deadline is September 3, 2026 at 1:00 p.m. PT.
- The public demo video must include audio and stay under three minutes. Judges are not required to watch past three minutes.
- The submission needs a working live URL and a public repository with an open-source licence.
- The video must show the project functioning and explain how it uses WebMCP.
- Do not edit the submitted project during judging. Fork it if development needs to continue.

## Research notes

- [OpenAI WebMCP challenge](https://openai.com/webmcp-challenge/)
- [Official Devpost rules](https://webmcp.devpost.com/rules)
- [WebMCP explainer and API examples](https://github.com/webmachinelearning/webmcp)
- [ChatGPT site-tools guide](https://learn.chatgpt.com/docs/webmcp)
- [Webroom WebMCP photo editor showcase](https://developers.openai.com/showcase/webroom)
- [Verdant Market WebMCP store showcase](https://developers.openai.com/showcase/verdant-market)
- [GPT Image 2 model page](https://developers.openai.com/api/docs/models/gpt-image-2)
- [ChatGPT image input guide](https://help.openai.com/en/articles/8400551-image-inputs-for-chatgpt-faq/)
- [Cluely launch film](https://vimeo.com/1220550552)
