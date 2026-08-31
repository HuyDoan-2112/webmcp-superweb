// Small shared helpers so each endpoint stays about one idea.

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // The gold parquet only changes when the ETL reruns.
      "cache-control": "public, max-age=60, s-maxage=300",
    },
  });
}

/**
 * For endpoints whose body is shaped by the session.
 *
 * The audience decides the depth of an answer, so the body varies per request
 * while the URL does not. A shared cache keyed on the URL alone would hand one
 * audience's answer to another, which is the one way this app could leak the
 * technical detail it deliberately withholds. Those endpoints are cheap and
 * read committed JSON, so not caching them costs nothing worth having.
 */
export function privateJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      vary: "cookie",
    },
  });
}

export function fail(message: string, status = 400, detail?: string): Response {
  return json(detail ? { error: message, detail } : { error: message }, status);
}

export function params(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}
