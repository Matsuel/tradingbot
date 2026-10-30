import { atr, ema, rsi, type Candle } from "./indicators";

export const SYMBOLS = ["BTC-USD", "ETH-USD"] as const;
export const STARTING_CASH = 10_000;
export const FEE_RATE = 0.001; // 0.1% per order
export const RISK_PER_TRADE = 0.01; // 1% of equity lost if stop-loss hits
export const MAX_POSITION_SHARE = 0.25; // notional cap per position
export const SL_ATR = 2;
export const TP_ATR = 3;

export type Side = "long" | "short";

export type Analysis = {
  ema20: number;
  ema50: number;
  rsi: number;
  atr: number;
  trend: Side; // EMA20 vs EMA50, used to exit on reversal
  signal: Side | null; // entry signal: trend confirmed by RSI filter
};

// Analyse closed candles only (the in-progress candle would repaint the signal).
export function analyse(closed: Candle[]): Analysis | null {
  const closes = closed.map((c) => c.close);
  const last = closed.length - 1;
  const a = {
    ema20: ema(closes, 20)[last],
    ema50: ema(closes, 50)[last],
    rsi: rsi(closes, 14)[last],
    atr: atr(closed, 14)[last],
  };
  if (Object.values(a).some((v) => !Number.isFinite(v))) return null;

  const trend: Side = a.ema20 > a.ema50 ? "long" : "short";
  let signal: Side | null = null;
  if (trend === "long" && a.rsi < 70) signal = "long";
  if (trend === "short" && a.rsi > 30) signal = "short";
  return { ...a, trend, signal };
}

export function stops(side: Side, entry: number, atrValue: number) {
  const dir = side === "long" ? 1 : -1;
  return {
    stopLoss: entry - dir * SL_ATR * atrValue,
    takeProfit: entry + dir * TP_ATR * atrValue,
  };
}

// Quantity risking RISK_PER_TRADE of equity at the stop, capped by notional share and cash.
export function positionSize(equity: number, cash: number, price: number, atrValue: number) {
  const byRisk = (equity * RISK_PER_TRADE) / (SL_ATR * atrValue);
  const byCap = (equity * MAX_POSITION_SHARE) / price;
  const byCash = cash / (price * (1 + FEE_RATE));
  return Math.max(0, Math.min(byRisk, byCap, byCash));
}

// First stop hit in candles after entry. Both in one candle: assume the stop-loss (conservative).
export function findExit(
  side: Side,
  stopLoss: number,
  takeProfit: number,
  candles: Candle[],
): { price: number; reason: "stop-loss" | "take-profit"; date: Date } | null {
  for (const c of candles) {
    const slHit = side === "long" ? c.low <= stopLoss : c.high >= stopLoss;
    const tpHit = side === "long" ? c.high >= takeProfit : c.low <= takeProfit;
    if (slHit) return { price: stopLoss, reason: "stop-loss", date: c.date };
    if (tpHit) return { price: takeProfit, reason: "take-profit", date: c.date };
  }
  return null;
}

// Gross P&L of a position at `price`, before fees.
export function grossPnl(side: Side, qty: number, entry: number, price: number) {
  return (side === "long" ? 1 : -1) * (price - entry) * qty;
}
