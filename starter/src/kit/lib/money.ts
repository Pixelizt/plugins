// Money display (pure). Currency and locale always come from client.yaml, never from here. No online payments
// (D3): these only format prices for display and for emails. Kit code: do not edit in a client project.

/** Decimal places the currency uses: USD 2, JPY 0, KWD 3. */
export function minorDigits(currency: string): number {
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/** A price in major units (12.5) as text: "$12.50". */
export function formatPrice(amount: number, currency: string, locale = "en"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}

/** An amount in the currency's minor unit (1250 cents) as text: "$12.50". */
export function formatMinor(minor: number, currency: string, locale = "en"): string {
  return formatPrice(minor / 10 ** minorDigits(currency), currency, locale);
}
