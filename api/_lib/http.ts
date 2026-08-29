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

export function fail(message: string, status = 400, detail?: string): Response {
  return json(detail ? { error: message, detail } : { error: message }, status);
}

export function params(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}
