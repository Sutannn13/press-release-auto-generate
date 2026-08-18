import type { QuoteInput } from "@/lib/prompt";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { Field } from "./field";

interface QuoteFieldsetProps {
  index: number;
  canRemove: boolean;
  quote: QuoteInput;
  onChange: (field: Exclude<keyof QuoteInput, "id">, value: string) => void;
  onRemove: () => void;
}

export function QuoteFieldset({
  index,
  canRemove,
  quote,
  onChange,
  onRemove,
}: QuoteFieldsetProps) {
  return (
    <Card className="bg-muted/40 border-border">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-forest/10 text-xs font-bold text-forest">
              {index + 1}
            </span>
            Kutipan {index + 1}
          </span>
          {canRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 />
              Hapus
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nama narasumber" required>
            {(id) => (
              <Input
                id={id}
                required
                value={quote.nama}
                onChange={(event) => onChange("nama", event.target.value)}
                placeholder="H. Sholahudin Al Ayubi"
              />
            )}
          </Field>

          <Field label="Jabatan" required>
            {(id) => (
              <Input
                id={id}
                required
                value={quote.jabatan}
                onChange={(event) => onChange("jabatan", event.target.value)}
                placeholder="Kasi Bimas Islam"
              />
            )}
          </Field>

          <Field label="Isi kutipan" required className="md:col-span-2">
            {(id) => (
              <Textarea
                id={id}
                required
                rows={4}
                value={quote.isi}
                onChange={(event) => onChange("isi", event.target.value)}
                placeholder="Tuliskan ucapan narasumber tanpa menambahkan atribusi."
              />
            )}
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}
