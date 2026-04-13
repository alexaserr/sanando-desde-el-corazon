"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { TopClient } from "@/hooks/use-dashboard-stats";

const COLORS = ["#C4704A", "#D4A592", "#4A3628", "#B7BFB3"];

interface Props {
  data: TopClient[];
}

export default function TopClientsChart({ data }: Props) {
  return (
    <div className="rounded-lg bg-[#FAF7F5] shadow-[0_2px_8px_rgba(44,34,32,0.06)] p-6">
      <h3 className="font-display font-semibold text-[#2C2220] mb-4">
        Pacientes Mas Recurrentes
      </h3>
      <div className="h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
          >
            <XAxis
              type="number"
              tick={{ fill: "#4A3628", fontFamily: "Lato", fontSize: 12 }}
              axisLine={{ stroke: "#D4A592" }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
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
              cursor={{ fill: "rgba(196,112,74,0.08)" }}
              formatter={(value) => [`${value} sesiones`, "Total"]}
            />
            <Bar dataKey="session_count" radius={[0, 4, 4, 0]} barSize={20}>
              {data.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
