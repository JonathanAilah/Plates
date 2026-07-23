// Side options for a dish. Stored in dishes.sides as a JSON array of
// { name, price } — the price is added to the meal total when the buyer
// picks that side. Older dishes stored a plain comma-separated string of
// names; parseSides reads both, treating legacy names as free ($0) sides.

export interface SideOption {
  name: string;
  price: number;
}

export function parseSides(raw: string | null | undefined): SideOption[] {
  if (!raw || !raw.trim()) return [];
  const t = raw.trim();
  if (t.startsWith('[')) {
    try {
      const arr = JSON.parse(t);
      if (Array.isArray(arr)) {
        return arr
          .map((s: any) => ({
            name: String(s?.name ?? '').trim(),
            price: Math.max(0, Number(s?.price) || 0),
          }))
          .filter((s) => s.name);
      }
    } catch {
      // fall through to the legacy format
    }
  }
  return t.split(',').map((s) => s.trim()).filter(Boolean).map((name) => ({ name, price: 0 }));
}

export function sidePriceFor(raw: string | null | undefined, sideName: string | null | undefined): number {
  if (!sideName) return 0;
  const side = parseSides(raw).find((s) => s.name === sideName);
  return side ? side.price : 0;
}
