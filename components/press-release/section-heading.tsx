import * as React from "react";

interface SectionHeadingProps {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeading({
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
  className,
}: SectionHeadingProps) {
  return (
    <div className={`flex items-start gap-4 ${className ?? ""}`}>
      <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-forest/10 text-forest ring-1 ring-forest/10">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
          {eyebrow}
        </p>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
