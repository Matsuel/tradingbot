import { sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const positions = pgTable(
  "positions",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    side: text("side", { enum: ["long", "short"] }).notNull(),
    qty: doublePrecision("qty").notNull(),
    entryPrice: doublePrecision("entry_price").notNull(),
    stopLoss: doublePrecision("stop_loss").notNull(),
    takeProfit: doublePrecision("take_profit").notNull(),
    entryFee: doublePrecision("entry_fee").notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    entryReason: text("entry_reason").notNull(),
    exitPrice: doublePrecision("exit_price"),
    exitFee: doublePrecision("exit_fee"),
    pnl: doublePrecision("pnl"), // net of both fees
    closedAt: timestamp("closed_at", { withTimezone: true }),
    exitReason: text("exit_reason"),
  },
  (t) => [
    // At most one open position per symbol, even if two ticks overlap.
    uniqueIndex("one_open_position_per_symbol").on(t.symbol).where(sql`${t.closedAt} is null`),
  ],
);

export const equitySnapshots = pgTable(
  "equity_snapshots",
  {
    id: serial("id").primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    equity: doublePrecision("equity").notNull(),
    cash: doublePrecision("cash").notNull(),
  },
  (t) => [index("equity_snapshots_at").on(t.at)],
);

// One row per symbol per tick: what the bot saw and what it did.
export const decisions = pgTable(
  "decisions",
  {
    id: serial("id").primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    symbol: text("symbol").notNull(),
    price: doublePrecision("price").notNull(),
    ema20: doublePrecision("ema20"),
    ema50: doublePrecision("ema50"),
    rsi: doublePrecision("rsi"),
    atr: doublePrecision("atr"),
    signal: text("signal"),
    action: text("action").notNull(),
  },
  (t) => [index("decisions_at").on(t.at)],
);

export type Position = typeof positions.$inferSelect;
