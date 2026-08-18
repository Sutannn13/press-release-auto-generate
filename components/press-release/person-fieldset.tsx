import type { PersonInput } from "@/lib/prompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { Field } from "./field";

export function PersonFieldset({
  person,
  index,
  onChange,
  onRemove,
}: {
  person: PersonInput;
  index: number;
  onChange: (field: "nama" | "jabatan" | "peran", value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold">Pihak {index + 1}</span>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-destructive"><Trash2 /> Hapus</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Nama" required>{(id) => <Input id={id} required value={person.nama} onChange={(event) => onChange("nama", event.target.value)} />}</Field>
        <Field label="Jabatan" required>{(id) => <Input id={id} required value={person.jabatan} onChange={(event) => onChange("jabatan", event.target.value)} />}</Field>
        <Field label="Peran dalam kegiatan" required>{(id) => <Input id={id} required value={person.peran} onChange={(event) => onChange("peran", event.target.value)} placeholder="Membuka acara / memberi sambutan" />}</Field>
      </div>
    </div>
  );
}
