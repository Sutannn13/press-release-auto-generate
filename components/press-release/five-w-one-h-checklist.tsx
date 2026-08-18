import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";
import type { ChecklistItem } from "@/lib/prompt";
import { cn } from "@/lib/utils";

export function FiveWOneHChecklist({ items }: { items: ChecklistItem[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const Icon = item.status === "complete" ? CheckCircle2 : item.status === "warning" ? AlertTriangle : CircleDashed;
        return (
          <div
            key={item.key}
            className={cn(
              "rounded-xl border p-3 text-sm",
              item.status === "complete" ? "border-forest/25 bg-forest/5" : "border-amber-300/60 bg-amber-50/60",
            )}
          >
            <div className="flex items-center gap-2 font-semibold">
              <Icon className={cn("size-4", item.status === "complete" ? "text-forest" : "text-amber-700")} />
              {item.label}
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground" title={item.detail}>{item.detail}</p>
          </div>
        );
      })}
    </div>
  );
}
