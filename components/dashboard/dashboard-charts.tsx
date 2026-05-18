"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type LeadStatusDatum = { status: string; label: string; count: number };
export type LeadDayDatum = { date: string; count: number };
export type SupplyTypeDatum = { type: string; label: string; count: number; fill: string };

const barConfig = {
  count: { label: "Leads", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const lineBarConfig = {
  count: { label: "New leads", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const pieConfig = {
  caretaker: { label: "Caretaker", color: "hsl(var(--chart-3))" },
  nurse: { label: "Nurse", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;

export function DashboardCharts({
  leadStatus,
  leadsByDay,
  supplyByType,
}: {
  leadStatus: LeadStatusDatum[];
  leadsByDay: LeadDayDatum[];
  supplyByType: SupplyTypeDatum[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border-border/80 bg-card">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Leads by status</CardTitle>
          <CardDescription>All non-deleted leads in the pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={barConfig} className="aspect-auto h-[320px] w-full">
            <BarChart data={leadStatus} margin={{ left: 24, right: 16, top: 8, bottom: 48 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 11 }}
              />
              <YAxis allowDecimals={false} width={32} className="text-xs fill-muted-foreground" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="var(--color-count)" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Supply mix</CardTitle>
          <CardDescription>Caretakers vs nurses on file</CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-[260px] justify-center">
          {supplyByType.length === 0 ? (
            <p className="self-center text-center text-sm text-muted-foreground">
              No supply profiles yet — add caretakers or nurses to see the mix.
            </p>
          ) : (
            <ChartContainer
              config={pieConfig}
              className="mx-auto h-[280px] w-full max-w-[340px]"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={supplyByType}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="45%"
                  innerRadius={56}
                  outerRadius={88}
                  paddingAngle={3}
                >
                  {supplyByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value) => {
                    const entry = supplyByType.find((s) => s.label === value);
                    return `${value}${entry ? ` (${entry.count})` : ""}`;
                  }}
                />
              </PieChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card lg:col-span-2">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Leads created (last 14 days)</CardTitle>
          <CardDescription>Count of new lead records per day</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={lineBarConfig} className="aspect-auto h-[260px] w-full">
            <BarChart data={leadsByDay} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                width={28}
                className="text-xs fill-muted-foreground"
                domain={[0, "auto"]}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="count"
                radius={[4, 4, 0, 0]}
                fill="var(--color-count)"
                minPointSize={3}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
