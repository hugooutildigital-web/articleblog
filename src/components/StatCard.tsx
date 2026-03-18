import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  accent?: boolean;
}

const StatCard = ({ label, value, icon: Icon, accent }: StatCardProps) => (
  <div className="bg-card border border-border rounded-lg p-5 flex items-center gap-4 transition-colors hover:bg-surface-hover">
    <div className={`p-3 rounded-md ${accent ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="font-mono text-2xl font-medium text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  </div>
);

export default StatCard;
