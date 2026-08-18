"use client";

import { Fragment } from "react";
import { motion, useReducedMotion } from "motion/react";

const STEPS = ["Isi data 5W1H", "Review & edit", "Download DOCX"];

export function Stepper() {
  const reduce = useReducedMotion();

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {STEPS.map((step, index) => (
        <Fragment key={step}>
          <motion.li
            className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 shadow-sm backdrop-blur-sm transition-colors duration-200 hover:border-forest/30 hover:bg-accent/60"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.35,
              ease: "easeOut",
              delay: reduce ? 0 : 0.1 + index * 0.08,
            }}
          >
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold">
              {index + 1}
            </span>
            <span className="text-sm font-medium text-foreground/80">
              {step}
            </span>
          </motion.li>
          {index < STEPS.length - 1 ? (
            <motion.span
              aria-hidden
              className="hidden h-px w-6 shrink-0 origin-left bg-border sm:block"
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{
                duration: 0.4,
                ease: "easeOut",
                delay: reduce ? 0 : 0.3 + index * 0.08,
              }}
            />
          ) : null}
        </Fragment>
      ))}
    </ol>
  );
}
