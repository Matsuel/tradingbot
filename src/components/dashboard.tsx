import { desc, gte, isNotNull, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import { decisions, equitySnapshots, positions } from "@/db/schema";
import { EquityChart } from "@/components/equity-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { equityOf, loadPortfolio, unrealized } from "@/lib/portfolio";
import { STARTING_CASH } from "@/lib/strategy";

const usd = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "USD" });
const signed = (n: number) => `${n >= 0 ? "+" : ""}${usd(n)}`;
const date = (d: Date) => d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
const pnlClass = (n: number) => (n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400");

function SideBadge({ side }: { side: string }) {
  return <Badge variant={side === "long" ? "secondary" : "destructive"}>{side}</Badge>;
}

export async function Dashboard() {
  await connection();
  const [{ cash, open }, latest, snapshots, closed, journal, [stats]] = await Promise.all([
    loadPortfolio(),
    // Last price seen by the bot for each symbol.
    db
      .selectDistinctOn([decisions.symbol], { symbol: decisions.symbol, price: decisions.price, at: decisions.at })
      .from(decisions)
      .orderBy(decisions.symbol, desc(decisions.at)),
    db.select({ at: equitySnapshots.at, equity: equitySnapshots.equity }).from(equitySnapshots).where(gte(equitySnapshots.at, sql`now() - interval '7 days'`)).orderBy(equitySnapshots.at),
    db.select().from(positions).where(isNotNull(positions.closedAt)).orderBy(desc(positions.closedAt)).limit(100),
    db.select().from(decisions).orderBy(desc(decisions.at)).limit(40),
    db
      .select({
        trades: sql<number>`count(*)`.mapWith(Number),
        wins: sql<number>`count(*) filter (where ${positions.pnl} > 0)`.mapWith(Number),
      })
      .from(positions)
      .where(isNotNull(positions.closedAt)),
  ]);

  const prices = Object.fromEntries(latest.map((l) => [l.symbol, l.price]));
  const equity = equityOf(cash, open, prices);
  const total = equity - STARTING_CASH;
  const lastTick = latest.reduce<Date | null>((m, l) => (!m || l.at > m ? l.at : m), null);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Dernier tick : {lastTick ? date(lastTick) : "jamais"}
        {latest.map((l) => ` · ${l.symbol} ${usd(l.price)}`).join("")}
      </p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Valeur du portefeuille</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{usd(equity)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>PnL total</CardDescription>
            <CardTitle className={`text-2xl tabular-nums ${pnlClass(total)}`}>
              {signed(total)} ({((total / STARTING_CASH) * 100).toFixed(2)} %)
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Cash disponible</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{usd(cash)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Taux de réussite</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {stats.trades ? `${((stats.wins / stats.trades) * 100).toFixed(0)} %` : "—"}
              <span className="ml-2 text-sm font-normal text-muted-foreground">{stats.trades} trades</span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Évolution (7 jours)</CardTitle>
          <CardDescription>Ligne pointillée : capital de départ</CardDescription>
        </CardHeader>
        <CardContent>
          <EquityChart data={snapshots.map((s) => ({ at: s.at.toISOString(), equity: s.equity }))} start={STARTING_CASH} />
        </CardContent>
      </Card>

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Positions ouvertes ({open.length})</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          <Card>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbole</TableHead>
                    <TableHead>Sens</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="text-right">Entrée</TableHead>
                    <TableHead className="text-right">Stop-loss</TableHead>
                    <TableHead className="text-right">Take-profit</TableHead>
                    <TableHead className="text-right">PnL latent</TableHead>
                    <TableHead>Ouverte</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {open.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">Aucune position ouverte</TableCell>
                    </TableRow>
                  )}
                  {open.map((p) => {
                    const u = unrealized(p, prices[p.symbol] ?? p.entryPrice);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.symbol}</TableCell>
                        <TableCell><SideBadge side={p.side} /></TableCell>
                        <TableCell className="text-right tabular-nums">{p.qty.toPrecision(4)}</TableCell>
                        <TableCell className="text-right tabular-nums">{usd(p.entryPrice)}</TableCell>
                        <TableCell className="text-right tabular-nums">{usd(p.stopLoss)}</TableCell>
                        <TableCell className="text-right tabular-nums">{usd(p.takeProfit)}</TableCell>
                        <TableCell className={`text-right tabular-nums ${pnlClass(u)}`}>{signed(u)}</TableCell>
                        <TableCell>{date(p.openedAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbole</TableHead>
                    <TableHead>Sens</TableHead>
                    <TableHead className="text-right">Entrée</TableHead>
                    <TableHead className="text-right">Sortie</TableHead>
                    <TableHead className="text-right">PnL net</TableHead>
                    <TableHead>Raison sortie</TableHead>
                    <TableHead>Ouverte</TableHead>
                    <TableHead>Clôturée</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closed.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">Aucun trade clôturé</TableCell>
                    </TableRow>
                  )}
                  {closed.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.symbol}</TableCell>
                      <TableCell><SideBadge side={p.side} /></TableCell>
                      <TableCell className="text-right tabular-nums">{usd(p.entryPrice)}</TableCell>
                      <TableCell className="text-right tabular-nums">{usd(p.exitPrice!)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${pnlClass(p.pnl!)}`}>{signed(p.pnl!)}</TableCell>
                      <TableCell>{p.exitReason}</TableCell>
                      <TableCell>{date(p.openedAt)}</TableCell>
                      <TableCell>{date(p.closedAt!)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="journal">
          <Card>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Symbole</TableHead>
                    <TableHead className="text-right">Prix</TableHead>
                    <TableHead className="text-right">EMA20 / EMA50</TableHead>
                    <TableHead className="text-right">RSI</TableHead>
                    <TableHead>Signal</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {journal.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{date(d.at)}</TableCell>
                      <TableCell className="font-medium">{d.symbol}</TableCell>
                      <TableCell className="text-right tabular-nums">{usd(d.price)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.ema20 != null && d.ema50 != null ? `${d.ema20.toFixed(0)} / ${d.ema50.toFixed(0)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{d.rsi?.toFixed(1) ?? "—"}</TableCell>
                      <TableCell>{d.signal ? <SideBadge side={d.signal} /> : "—"}</TableCell>
                      <TableCell className="whitespace-normal">{d.action}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
