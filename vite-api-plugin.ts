// Serves api/*.ts during `npm run dev`, in process.
//
// In production Vercel runs these files as serverless functions. Locally that
// normally means a second terminal running `vercel dev`, which is one more
// thing to be broken on the day. This loads the same handler modules through
// Vite instead, so `npm run dev` alone is the whole application.
//
// Dev only. It is never part of the build.

import type { Connect, Plugin, ViteDevServer } from "vite";
import type { ServerResponse } from "node:http";

type Handler = (request: Request) => Promise<Response> | Response;

function toRequest(req: Connect.IncomingMessage): Request {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  return new Request(url, { method: req.method ?? "GET", headers });
}

async function send(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function apiPlugin(): Plugin {
  return {
    name: "superweb-api",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? "").split("?")[0];
        if (!path.startsWith("/api/")) return next();

        const name = path.slice("/api/".length).replace(/\/+$/, "");
        if (!name || name.startsWith("_") || !/^[a-z0-9-]+$/i.test(name)) {
          return send(res, new Response("Not found", { status: 404 }));
        }

        try {
          const module = (await server.ssrLoadModule(`/api/${name}.ts`)) as {
            default?: Handler;
          };
          if (typeof module.default !== "function") {
            return send(res, new Response("Not found", { status: 404 }));
          }
          await send(res, await module.default(toRequest(req)));
        } catch (error) {
          server.config.logger.error(`[api] ${path} failed`, { error: error as Error });
          await send(
            res,
            new Response(
              JSON.stringify({
                error: "Handler threw",
                detail: error instanceof Error ? error.message : String(error),
              }),
              { status: 500, headers: { "content-type": "application/json" } },
            ),
          );
        }
      });
    },
  };
}
