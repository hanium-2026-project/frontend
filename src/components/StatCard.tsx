import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: "neutral" | "good" | "warn" | "bad";
}

export function StatCard({ label, value, icon: Icon, tone = "neutral" }: StatCardProps) {
  return (
    <section className={`stat-card stat-${tone}`}>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
      <Icon aria-hidden="true" size={22} />
    </section>
  );
}
