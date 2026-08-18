"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const DAY_NAMES = ["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"] as const

const MONTH_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
})

export interface CalendarProps {
  /** Tanggal terpilih (waktu diabaikan). */
  selected?: Date | null
  onSelect?: (date: Date) => void
  className?: string
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * Kalender bulanan ringan tanpa dependency eksternal.
 * Sel di-render sebagai <button type="button"> agar aman dipakai di dalam <form>.
 */
function Calendar({ selected, onSelect, className }: CalendarProps) {
  const today = React.useMemo(() => startOfDay(new Date()), [])
  const [viewDate, setViewDate] = React.useState<Date>(() =>
    selected ? startOfDay(selected) : startOfDay(new Date()),
  )

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  // Indeks hari (0 = Senin) dari tanggal 1 bulan ini.
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: Array<Date | null> = [
    ...Array.from({ length: firstDayOffset }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => new Date(year, month, index + 1),
    ),
  ]

  function shiftMonth(delta: number) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  return (
    <div className={cn("w-64 p-3", className)}>
      <div className="flex items-center justify-between pb-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Bulan sebelumnya"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-semibold capitalize">
          {MONTH_FORMATTER.format(viewDate)}
        </span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Bulan berikutnya"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {DAY_NAMES.map((day) => (
          <span
            key={day}
            className="flex size-8 items-center justify-center text-[0.7rem] font-medium text-muted-foreground"
          >
            {day}
          </span>
        ))}

        {cells.map((date, index) =>
          date === null ? (
            <span key={`blank-${index}`} className="size-8" />
          ) : (
            <CalendarDay
              key={date.toISOString()}
              date={date}
              isSelected={selected ? isSameDay(date, selected) : false}
              isToday={isSameDay(date, today)}
              onSelect={onSelect}
            />
          ),
        )}
      </div>
    </div>
  )
}

interface CalendarDayProps {
  date: Date
  isSelected: boolean
  isToday: boolean
  onSelect?: (date: Date) => void
}

function CalendarDay({ date, isSelected, isToday, onSelect }: CalendarDayProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(date)}
      aria-pressed={isSelected}
      aria-label={new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(date)}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-sm transition-all duration-150 outline-none",
        "hover:bg-accent hover:scale-110 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring/50",
        isToday && !isSelected && "font-semibold text-forest ring-1 ring-forest/30",
        isSelected &&
          "bg-primary font-semibold text-primary-foreground shadow-sm shadow-forest/30 scale-105 hover:bg-primary hover:text-primary-foreground",
      )}
    >
      {date.getDate()}
    </button>
  )
}

export { Calendar }
