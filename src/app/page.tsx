import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Dashboard } from "@/components/dashboard";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Bot de trading BTC / ETH</h1>
        <p className="text-sm text-muted-foreground">
          Paper trading · 10 000 $ fictifs · stratégie EMA 20/50 + RSI 14, bougies 15 min · tick toutes les 15 min
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement…</p>}>
        <Dashboard />
      </Suspense>
      <AutoRefresh />
    </main>
  );
}
