import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface HBarDatum {
  name: string;
  value: number;
  color?: string;
}

interface HBarChartProps {
  data: HBarDatum[];
  /** Height in px; defaults scale with row count. */
  height?: number;
  /** Formats the axis ticks + tooltip value (e.g. formatCroreShort). */
  format?: (v: number) => string;
  /** Width reserved for the category (Y-axis) labels. */
  labelWidth?: number;
  color?: string;
}

/**
 * Horizontal bar chart (recharts) with a light, executive look. Bars are keyed
 * by category on the Y-axis so long department / area names stay readable.
 */
export default function HBarChart({
  data,
  height,
  format = (v) => v.toLocaleString("en-IN"),
  labelWidth = 150,
  color = "#7c5cfa",
}: HBarChartProps) {
  const h = height ?? Math.max(140, data.length * 38 + 16);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 56, bottom: 4, left: 4 }}
        barCategoryGap={6}
      >
        <XAxis
          type="number"
          tickFormatter={format}
          tick={{ fontSize: 11, fill: "hsl(240 4% 45%)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={labelWidth}
          tick={{ fontSize: 11, fill: "hsl(240 5% 30%)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "hsl(240 9% 96%)" }}
          formatter={(v: number) => [format(v), "Owed"]}
          contentStyle={{
            borderRadius: 10,
            border: "1px solid hsl(240 5% 90%)",
            fontSize: 12,
            boxShadow: "0 8px 24px -12px rgba(16,24,40,0.25)",
          }}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
