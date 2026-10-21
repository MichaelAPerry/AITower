/** Number formats for the Foreman's status lines. */
export const fmtKw = (kw: number): string => `${Math.ceil(kw).toLocaleString("en-US")} kW`;
export const fmtUsd = (n: number): string => (n >= 1e6 ? `$${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 2).replace(/0$/, "")}M` : `$${Math.round(n / 1000)}k`);
