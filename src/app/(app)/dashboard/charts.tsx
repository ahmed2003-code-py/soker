"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

type نقطة = { الشهر: string; مبيعات: number; تحصيلات: number; مصروفات: number };

const تنسيق = (n: number) => n.toLocaleString("en-US");

export function رسوم_اللوحة({ السلسلة }: { السلسلة: نقطة[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card-soft p-5">
        <h3 className="mb-4 font-semibold">المبيعات الشهرية (آخر 12 شهراً)</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={السلسلة}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="الشهر" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={تنسيق} width={70} />
            <Tooltip formatter={(v: number) => تنسيق(v)} />
            <Bar dataKey="مبيعات" fill="#2563EB" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card-soft p-5">
        <h3 className="mb-4 font-semibold">التحصيلات الشهرية</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={السلسلة}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="الشهر" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={تنسيق} width={70} />
            <Tooltip formatter={(v: number) => تنسيق(v)} />
            <Bar dataKey="تحصيلات" fill="#16A34A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card-soft p-5">
        <h3 className="mb-4 font-semibold">المصروفات الشهرية</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={السلسلة}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="الشهر" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={تنسيق} width={70} />
            <Tooltip formatter={(v: number) => تنسيق(v)} />
            <Bar dataKey="مصروفات" fill="#DC2626" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card-soft p-5">
        <h3 className="mb-4 font-semibold">الإيرادات مقابل المصروفات</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={السلسلة}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="الشهر" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={تنسيق} width={70} />
            <Tooltip formatter={(v: number) => تنسيق(v)} />
            <Legend />
            <Line type="monotone" dataKey="تحصيلات" name="إيرادات" stroke="#16A34A" strokeWidth={2} />
            <Line type="monotone" dataKey="مصروفات" name="مصروفات" stroke="#DC2626" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
