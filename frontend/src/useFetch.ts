import { useEffect, useState } from "react";
import { ApiError } from "./api";

/** Discriminated fetch lifecycle used to drive StateBlock. */
export type FetchState<T> =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; error: string }
  | { status: "ready"; data: T };

/**
 * Run an async API call once on mount and expose a loading/empty/error/ready
 * state. `isEmpty` defaults to "an empty array" so list endpoints render the
 * empty state automatically.
 */
export function useFetch<T>(
  fn: () => Promise<T>,
  isEmpty: (data: T) => boolean = (d) => Array.isArray(d) && d.length === 0,
): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    fn()
      .then((data) => {
        if (!alive) return;
        setState(isEmpty(data) ? { status: "empty" } : { status: "ready", data });
      })
      .catch((err) => {
        if (!alive) return;
        const msg =
          err instanceof ApiError
            ? err.message
            : "Could not reach the backend. Is it running?";
        setState({ status: "error", error: msg });
      });
    return () => {
      alive = false;
    };
    // fn is expected to be a stable per-screen closure; fetch once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
