"use client";

import * as React from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle2, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  id?: string;
  name?: string;
  value: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  required?: boolean;
  className?: string;
}

function SelectedFilePreview({ file }: { file: File }) {
  const reduce = useReducedMotion();
  const [previewUrl] = React.useState(() => URL.createObjectURL(file));

  React.useEffect(
    () => () => URL.revokeObjectURL(previewUrl),
    [previewUrl],
  );

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className="flex w-full flex-col items-center gap-2"
    >
      <div className="relative h-40 w-full">
        <Image
          src={previewUrl}
          alt="Pratinjau foto kegiatan"
          fill
          unoptimized
          sizes="160px"
          className="rounded-lg object-contain shadow-sm"
        />
      </div>
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-forest">
        <CheckCircle2 className="size-3.5" />
        {file.name}
      </span>
    </motion.div>
  );
}

export function FileDropzone({
  id,
  name,
  value,
  onChange,
  accept = "image/jpeg,image/png",
  required,
  className,
}: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const reduce = useReducedMotion();

  function syncInputFiles(file: File | null) {
    if (!inputRef.current) return;
    if (file) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      inputRef.current.files = transfer.files;
    } else {
      inputRef.current.value = "";
    }
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    onChange(file);
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    if (!file) return;
    syncInputFiles(file);
    onChange(file);
  }

  function handleRemove(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    syncInputFiles(null);
    onChange(null);
  }

  return (
    <div className={cn("relative", className)}>
      <motion.label
        htmlFor={id}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        animate={reduce ? undefined : { scale: isDragging ? 1.015 : 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={cn(
          "flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-card/50 px-4 py-6 text-center transition-colors duration-200 hover:border-forest hover:bg-accent has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-forest/30",
          isDragging && "border-forest bg-accent ring-2 ring-forest/20",
        )}
        >
        <AnimatePresence mode="wait" initial={false}>
          {value ? (
            <SelectedFilePreview
              key={`${value.name}-${value.lastModified}-${value.size}`}
              file={value}
            />
          ) : (
            <motion.div
              key="empty"
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex flex-col items-center gap-2"
            >
              <motion.span
                animate={reduce ? undefined : { y: [0, -5, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="inline-flex"
              >
                <UploadCloud className="size-7 text-forest/70" />
              </motion.span>
              <span className="text-sm font-medium text-foreground/80">
                Klik atau seret foto ke sini
              </span>
              <span className="text-xs text-muted-foreground">JPG / PNG</span>
            </motion.div>
          )}
        </AnimatePresence>
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="file"
          accept={accept}
          required={required}
          onChange={handleInputChange}
          className="sr-only"
        />
      </motion.label>

      <AnimatePresence>
        {value ? (
          <motion.button
            key="remove"
            type="button"
            onClick={handleRemove}
            aria-label="Hapus foto"
            initial={reduce ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 500, damping: 26 }}
            className="absolute right-2 top-2 z-10 inline-flex size-7 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground"
          >
            <X className="size-4" />
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
