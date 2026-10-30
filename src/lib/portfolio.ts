import { isNotNull, isNull, sum } from "drizzle-orm";
import { db } from "@/db";
import { positions, type Position } from "@/db/schema";
import { grossPnl, STARTING_CASH } from "./strategy";

// Cash and equity are derived from positions, so there is no balance to keep in sync.
// Opening a position spends its notional + entry fee; closing returns notional + P&L - exit fee.
export async function loadPortfolio() {
  const [[closed], open] = await Promise.all([
    db.select({ pnl: sum(positions.pnl).mapWith(Number) }).from(positions).where(isNotNull(positions.closedAt)),
    db.select().from(positions).where(isNull(positions.closedAt)),
  ]);
  const realized = closed.pnl ?? 0;
  const cash =
    STARTING_CASH + realized - open.reduce((s, p) => s + p.qty * p.entryPrice + p.entryFee, 0);
  return { realized, cash, open };
}

export function unrealized(p: Position, price: number) {
  return grossPnl(p.side, p.qty, p.entryPrice, price) - p.entryFee;
}

export function equityOf(cash: number, open: Position[], prices: Record<string, number>) {
  return open.reduce(
    (s, p) => s + p.qty * p.entryPrice + p.entryFee + unrealized(p, prices[p.symbol] ?? p.entryPrice),
    cash,
  );
}
