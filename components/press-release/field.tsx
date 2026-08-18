"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  className?: string;
  /**
   * Render prop: menerima id yang sudah di-generate dan harus diteruskan ke
   * kontrol (Input/Textarea/SelectTrigger/FileDropzone) agar Label (htmlFor)
   * terhubung dengan benar.
   */
  children: (id: string) => React.ReactNode;
}

export function Field({
  label,
  required,
  hint,
  className,
  children,
}: FieldProps) {
  const id = React.useId();

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} className="text-foreground">
        <span>
          {label}
          {required ? (
            <span aria-hidden="true" className="text-destructive">
              {" "}*
            </span>
          ) : null}
        </span>
      </Label>
      {children(id)}
      {hint ? (
        <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
