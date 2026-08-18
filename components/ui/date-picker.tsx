"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { CalendarDays } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

const DISPLAY_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
})

/** "2026-08-14" -> Date lokal (tanpa geser timezone). */
function parseIso(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

/** Date lokal -> "2026-08-14". */
function toIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

interface DatePickerProps {
  id?: string
  /** Nilai ISO "YYYY-MM-DD" (kontrak yang sama dengan input type="date"). */
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

/**
 * Date picker premium berbasis Radix Popover + Calendar custom.
 * Mempertahankan kontrak string ISO agar drop-in menggantikan <input type="date">.
 * Input tersembunyi menjaga validasi form native (required).
 */
function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Pilih tanggal",
  required,
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const selected = React.useMemo(() => (value ? parseIso(value) : null), [value])

  // Saat tanggal kosong, validasi required gagal -> buka popover agar pengguna memilih.
  function handleInvalid(event: React.FormEvent<HTMLInputElement>) {
    event.preventDefault()
    setOpen(true)
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <input
        type="text"
        tabIndex={-1}
        aria-hidden="true"
        required={required}
        value={value}
        onChange={() => {}}
        onInvalid={handleInvalid}
        className="pointer-events-none absolute opacity-0 size-0"
      />
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            "group/date relative flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-all duration-200 outline-none select-none md:text-sm",
            "hover:border-forest/40 hover:bg-accent/50",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "data-[state=open]:border-ring data-[state=open]:ring-3 data-[state=open]:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/date:text-forest" />
          <span
            className={cn(
              "flex-1 truncate text-left",
              selected ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {selected ? DISPLAY_FORMATTER.format(selected) : placeholder}
          </span>
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className={cn(
            "z-50 rounded-xl border border-border/60 bg-popover text-popover-foreground shadow-xl shadow-forest/10 ring-1 ring-foreground/5",
            "origin-(--radix-popover-content-transform-origin)",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          <Calendar
            key={value || "empty"}
            selected={selected}
            onSelect={(date) => {
              onChange(toIso(date))
              setOpen(false)
            }}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export { DatePicker }
