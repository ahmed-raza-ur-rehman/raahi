/**
 * The one place that reads the wall clock. Everything that needs "today" defaults to `clockNow()`, so tests
 * can pin time with `setClock(() => new Date("2026-10-11T06:00:00Z"))` and stay valid forever.
 */
let override: (() => Date) | undefined;

export function clockNow(): Date {
  return override ? override() : new Date();
}

export function setClock(fn: (() => Date) | undefined): void {
  override = fn;
}
