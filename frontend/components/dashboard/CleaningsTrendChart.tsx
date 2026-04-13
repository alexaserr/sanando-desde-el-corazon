"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { MonthlyCount } from "@/hooks/use-dashboard-stats";

interface Props {
  data: MonthlyCount[];
}

const MONTH_NAMES: Record<string, string> = {
  "01": "Ene",
  "02": "Feb",
  "03": "Mar",
  "04": "Abr",
  "05": "May",
  "06": "Jun",
  "07": "Jul",
  "08": "Ago",
  "09": "Sep",
  "10": "Oct",
  "11": "Nov",
  "12": "Dic",
};

function formatMonth(month: string): string {
  const parts = month.split("-");
  if (parts.length === 2) {
    return `${MONTH_NAMES[parts[1]] ?? parts[1]} ${parts[0].slice(2)}`;
  }
  return month;
}

export default function CleaningsTrendChart({ data }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    label: formatMonth(d.month),
  }));

  return (
    <div className="rounded-lg bg-[#FAF7F5] shadow-[0_2px_8px_rgba(44,34,32,0.06)] p-6">
      <h3 className="font-display font-semibold text-[#2C2220] mb-4">
        Limpiezas por Mes
      </h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#D4A592"
              opacity={0.3}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "#4A3628", fontFamily: "Lato", fontSize: 12 }}
              axisLine={{ stroke: "#D4A592" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#4A3628", fontFamily: "Lato", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#2C2220",
                color: "#FAF7F5",
                borderRadius: 4,
                border: "none",
                fontFamily: "Lato",
                fontSize: 13,
              }}
              itemStyle={{ color: "#FAF7F5" }}
              labelStyle={{ color: "#FAF7F5", fontWeight: 600 }}
              formatter={(value) => [`${value} limpiezas`, "Total"]}
            />
            <Bar
              dataKey="count"
              fill="#4A3628"
              radius={[4, 4, 0, 0]}
              barSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
