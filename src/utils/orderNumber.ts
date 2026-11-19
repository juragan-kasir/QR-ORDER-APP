// Order label on the diner's order list.
//
// BE (W3-6, 2026-11-19) numbers orders per outlet per business day:
//   ORD-<storeId>-<YYMMDD>-<seq>   e.g. ORD-12-261119-0001
// Cutting the first 10 characters would leave "ORD-12-261" for every order
// of that outlet, so show the daily sequence: the same number the cashier
// queue card shows ("#0001"). Older numbers keep the first 10 characters.
const DAILY_COUNTER_NUMBER = /^[A-Z]+-\d+-\d{6}-(\d{4,})$/;

export function orderListLabel(orderNumber: string | undefined, id: string): string {
  const raw = orderNumber || String(id ?? "");
  const daily = DAILY_COUNTER_NUMBER.exec(raw);
  if (daily) return daily[1];
  return raw.slice(0, 10).toUpperCase();
}
