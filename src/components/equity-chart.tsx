"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const config = { equity: { label: "Valeur", color: "var(--chart-1)" } } satisfies ChartConfig;

export function EquityChart({ data, start }: { data: { at: string; equity: number }[]; start: number }) {
  if (data.length < 2) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Pas encore assez de ticks pour tracer la courbe.</p>;
  }
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <AreaChart data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="at"
          tickLine={false}
          axisLine={false}
          minTickGap={48}
          tickFormatter={(v) => new Date(v).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        />
        <YAxis domain={["auto", "auto"]} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => `${Math.round(v)} $`} />
        <ReferenceLine y={start} strokeDasharray="4 4" stroke="var(--muted-foreground)" />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, p) => new Date(p[0]?.payload.at).toLocaleString("fr-FR")}
              formatter={(v) => `${Number(v).toFixed(2)} $`}
            />
          }
        />
        <Area dataKey="equity" type="monotone" stroke="var(--color-equity)" fill="var(--color-equity)" fillOpacity={0.15} />
      </AreaChart>
    </ChartContainer>
  );
}
