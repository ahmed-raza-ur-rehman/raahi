/**
 * What you see while a screen is on its way.
 *
 * Raahi is used on slow connections and cheap phones, where an empty screen
 * reads as "it broke". A skeleton that appears instantly tells the truth:
 * something is happening. It needs no data of its own, so it can always render.
 */
export default function AppLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      {/* Announced to a screen reader; invisible on screen. */}
      <span className="sr-only">Loading · لوڈ ہو رہا ہے</span>

      <div className="animate-pulse">
        <div className="h-5 w-32 rounded-full bg-[var(--surface-2)]" />
        <div className="mt-2 h-3 w-48 rounded-full bg-[var(--surface-2)]" />

        <div className="mt-4 h-24 rounded-2xl bg-[var(--surface-2)]" />

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-[74px] rounded-2xl bg-[var(--surface-2)]" />
          ))}
        </div>
        <div className="mt-2.5 grid gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-12 rounded-2xl bg-[var(--surface-2)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
