import throttleFunction from "throttleit";

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  waitMs: number | undefined,
): T {
  return waitMs != null ? throttleFunction(fn, waitMs) : fn;
}
