import { describe, expect, test } from "bun:test";
import { ema, rsi } from "./indicators";
import { analyse, findExit, grossPnl, positionSize, stops } from "./strategy";

const candle = (close: number, i: number, spread = 1) => ({
  date: new Date(i * 900_000),
  open: close,
  high: close + spread,
  low: close - spread,
  close,
});

describe("indicators", () => {
  test("ema of a constant series is the constant", () => {
    expect(ema([5, 5, 5, 5, 5], 3).slice(2)).toEqual([5, 5, 5]);
  });

  test("rsi is 100 on a strictly rising series", () => {
    const r = rsi(Array.from({ length: 30 }, (_, i) => i), 14);
    expect(r[29]).toBe(100);
  });
});

describe("strategy", () => {
  test("uptrend gives long trend, overbought RSI blocks entry", () => {
    const a = analyse(Array.from({ length: 80 }, (_, i) => candle(100 + i, i)))!;
    expect(a.trend).toBe("long");
    expect(a.signal).toBeNull(); // RSI 100 > 70
  });

  test("choppy uptrend gives a long entry", () => {
    const closes = Array.from({ length: 80 }, (_, i) => 100 + i * 0.5 + (i % 2 ? -2 : 2));
    const a = analyse(closes.map((c, i) => candle(c, i)))!;
    expect(a.signal).toBe("long");
  });

  test("not enough candles gives null", () => {
    expect(analyse([candle(1, 0)])).toBeNull();
  });

  test("stops are mirrored for shorts", () => {
    expect(stops("long", 100, 5)).toEqual({ stopLoss: 90, takeProfit: 115 });
    expect(stops("short", 100, 5)).toEqual({ stopLoss: 110, takeProfit: 85 });
  });

  test("size risks 1% of equity, capped at 25% notional", () => {
    // risk: 100 / (2*10) = 5 units; cap: 2500 / 1000 = 2.5 units
    expect(positionSize(10_000, 10_000, 1000, 10)).toBe(2.5);
    // risk: 100 / (2*100) = 0.5 units (500 notional, under cap)
    expect(positionSize(10_000, 10_000, 1000, 100)).toBe(0.5);
  });

  test("findExit prefers stop-loss when both are hit in one candle", () => {
    const wide = { date: new Date(0), open: 100, high: 120, low: 80, close: 100 };
    expect(findExit("long", 90, 115, [wide])?.reason).toBe("stop-loss");
    expect(findExit("short", 110, 85, [candle(84, 0, 0)])?.reason).toBe("take-profit");
    expect(findExit("long", 90, 115, [candle(100, 0)])).toBeNull();
  });

  test("short profits when price falls", () => {
    expect(grossPnl("short", 2, 100, 90)).toBe(20);
    expect(grossPnl("long", 2, 100, 90)).toBe(-20);
  });
});
