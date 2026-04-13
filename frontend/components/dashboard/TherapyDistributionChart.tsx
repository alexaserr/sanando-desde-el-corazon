"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { TherapyDistribution } from "@/hooks/use-dashboard-stats";

const COLORS = ["#C4704A", "#D4A592", "#4A3628", "#B7BFB3", "#A0522D"];

interface Props {
  data: TherapyDistribution[];
}

export default function TherapyDistributionChart({ data }: Props) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="rounded-lg bg-[#FAF7F5] shadow-[0_2px_8px_rgba(44,34,32,0.06)] p-6">
      <h3 className="font-display font-semibold text-[#2C2220] mb-4">
        Distribución por Tipo de Terapia
      </h3>
      <div className="h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="therapy_type"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={110}
              paddingAngle={3}
              stroke="none"
            >
              {data.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
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
              formatter={(value, name) => [
                `${value} (${total > 0 ? ((Number(value) / total) * 100).toFixed(1) : 0}%)`,
                String(name),
              ]}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              iconSize={8}
              formatter={(value: string) => (
                <span
                  style={{
                    color: "#4A3628",
                    fontFamily: "Lato",
                    fontSize: 12,
                  }}
                >
                  {value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
