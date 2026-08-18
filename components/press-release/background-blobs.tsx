"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Latar dekoratif halus: grid tipis + beberapa blob radial-gradient yang melayang
 * lambat. Ditaruh fixed di belakang seluruh halaman. Dimatikan oleh prefers-reduced-motion.
 */
export function BackgroundBlobs() {
  const reduce = useReducedMotion();

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent 78%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent 78%)",
        }}
      />

      <motion.div
        className="absolute -left-32 -top-40 h-[34rem] w-[34rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, color-mix(in srgb, var(--forest) 32%, transparent), transparent 70%)",
        }}
        animate={
          reduce ? undefined : { y: [0, -22, 0], x: [0, 12, 0] }
        }
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="absolute -bottom-40 -right-24 h-[30rem] w-[30rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, color-mix(in srgb, var(--gold) 20%, transparent), transparent 70%)",
        }}
        animate={
          reduce ? undefined : { y: [0, 20, 0], x: [0, -10, 0] }
        }
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="absolute right-1/4 top-1/3 h-[24rem] w-[24rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, color-mix(in srgb, var(--forest-light) 24%, transparent), transparent 70%)",
        }}
        animate={
          reduce ? undefined : { y: [0, 16, 0], scale: [1, 1.05, 1] }
        }
        transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
