import { useEffect, useState } from "react";

export type Async<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

/**
 * Run a fetch when its dependencies change, and ignore any response that
 * arrives after a newer one has been requested.
 */
export function useAsync<T>(
  run: () => Promise<T>,
  deps: readonly unknown[],
): Async<T> {
  const [state, setState] = useState<Async<T>>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let current = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    run().then(
      (data) => current && setState({ data, error: null, loading: false }),
      (error: unknown) =>
        current &&
        setState({
          data: null,
          error: error instanceof Error ? error.message : String(error),
          loading: false,
        }),
    );
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
