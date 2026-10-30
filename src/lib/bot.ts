import { and, eq, isNull } from "drizzle-orm";
import YahooFinance from "yahoo-finance2";
import { db } from "@/db";
import { decisions, equitySnapshots, positions, type Position } from "@/db/schema";
import type { Candle } from "./indicators";
import { equityOf, loadPortfolio } from "./portfolio";
import {
  analyse,
  FEE_RATE,
  findExit,
  grossPnl,
  positionSize,
  stops,
  SYMBOLS,
  type Analysis,
} from "./strategy";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const CANDLE_MS = 15 * 60_000;

async function fetchCandles(symbol: string) {
  const res = await yf.chart(symbol, {
    period1: new Date(Date.now() - 5 * 86_400_000),
    interval: "15m",
  });
  const candles: Candle[] = res.quotes.flatMap((q) =>
    q.open != null && q.high != null && q.low != null && q.close != null
      ? [{ date: q.date, open: q.open, high: q.high, low: q.low, close: q.close }]
      : [],
  );
  if (candles.length === 0) throw new Error(`no candles for ${symbol}`);
  return candles;
}

async function closePosition(p: Position, price: number, reason: string) {
  const exitFee = p.qty * price * FEE_RATE;
  const pnl = grossPnl(p.side, p.qty, p.entryPrice, price) - p.entryFee - exitFee;
  const closed = await db
    .update(positions)
    .set({ exitPrice: price, exitFee, pnl, closedAt: new Date(), exitReason: reason })
    .where(and(eq(positions.id, p.id), isNull(positions.closedAt)))
    .returning({ id: positions.id });
  if (closed.length === 0) return "déjà clôturée par un autre tick";
  return `clôture ${p.side} @ ${price.toFixed(2)} (${reason}), PnL ${pnl.toFixed(2)} $`;
}

async function tickSymbol(symbol: string): Promise<{ price: number; actions: string[] }> {
  const candles = await fetchCandles(symbol);
  const price = candles[candles.length - 1].close;
  const now = Date.now();
  const analysis: Analysis | null = analyse(
    candles.filter((c) => c.date.getTime() + CANDLE_MS <= now),
  );
  const actions: string[] = [];

  const [open] = await db
    .select()
    .from(positions)
    .where(and(eq(positions.symbol, symbol), isNull(positions.closedAt)));

  let isOpen = Boolean(open);
  if (open) {
    const exit = findExit(
      open.side,
      open.stopLoss,
      open.takeProfit,
      candles.filter((c) => c.date >= open.openedAt),
    );
    if (exit) {
      actions.push(await closePosition(open, exit.price, exit.reason));
      isOpen = false;
    } else if (analysis && analysis.trend !== open.side) {
      actions.push(await closePosition(open, price, "retournement de tendance"));
      isOpen = false;
    }
  }

  if (!isOpen && analysis?.signal) {
    const { cash, open: allOpen } = await loadPortfolio();
    const equity = equityOf(cash, allOpen, { [symbol]: price });
    const qty = positionSize(equity, cash, price, analysis.atr);
    if (qty * price >= 10) {
      const side = analysis.signal;
      const inserted = await db
        .insert(positions)
        .values({
          symbol,
          side,
          qty,
          entryPrice: price,
          ...stops(side, price, analysis.atr),
          entryFee: qty * price * FEE_RATE,
          entryReason: `EMA20 ${side === "long" ? ">" : "<"} EMA50, RSI ${analysis.rsi.toFixed(1)}`,
        })
        // The partial unique index rejects a second open position if two ticks overlap.
        .onConflictDoNothing()
        .returning({ id: positions.id });
      if (inserted.length > 0) {
        actions.push(`ouverture ${side} ${qty.toPrecision(4)} @ ${price.toFixed(2)}`);
        isOpen = true;
      }
    } else {
      actions.push("signal ignoré : cash insuffisant");
    }
  }

  await db.insert(decisions).values({
    symbol,
    price,
    ema20: analysis?.ema20,
    ema50: analysis?.ema50,
    rsi: analysis?.rsi,
    atr: analysis?.atr,
    signal: analysis?.signal ?? null,
    action: actions.join(" · ") || (isOpen ? "position conservée" : "aucun signal"),
  });
  return { price, actions };
}

// One bot cycle: manage exits, take entries, record equity. Called every 15 min by the cron.
export async function runTick() {
  const prices: Record<string, number> = {};
  const report: Record<string, string[] | string> = {};
  for (const symbol of SYMBOLS) {
    try {
      const r = await tickSymbol(symbol);
      prices[symbol] = r.price;
      report[symbol] = r.actions;
    } catch (e) {
      report[symbol] = `erreur : ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  const { cash, open } = await loadPortfolio();
  // Skip the snapshot if a price is missing: valuing at entry would draw a false flat line.
  if (open.every((p) => p.symbol in prices)) {
    await db.insert(equitySnapshots).values({ equity: equityOf(cash, open, prices), cash });
  }
  return report;
}
