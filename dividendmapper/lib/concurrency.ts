// Order-preserving concurrency limiter. Runs an array of async thunks with at
// most `limit` in flight at once, returning results in the original order.
//
// Used by the scoring cron to bound how many FMP requests fire simultaneously:
// FMP's per-minute quota is generous (~750/min on Premium) but it enforces a
// separate burst/concurrency guard that surfaces (misleadingly) as an
// "Invalid API KEY" body. Firing one ticker's ~17 endpoints all at once via a
// naked Promise.all trips that guard; capping concurrency smooths the burst.
//
// On the first thunk rejection: workers stop pulling new tasks and the error is
// rethrown (matching Promise.all semantics) without leaving unhandled rejections.

export async function runWithConcurrency<T>(
  thunks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results = new Array<T>(thunks.length);
  let next = 0;
  let firstError: unknown = null;

  async function worker(): Promise<void> {
    while (next < thunks.length && firstError === null) {
      const i = next++;
      try {
        results[i] = await thunks[i]();
      } catch (err) {
        if (firstError === null) firstError = err;
        return;
      }
    }
  }

  const workerCount = Math.max(1, Math.min(limit, thunks.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (firstError !== null) throw firstError;
  return results;
}
