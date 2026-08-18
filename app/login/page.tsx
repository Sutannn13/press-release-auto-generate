"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle } from "@/components/ui/alert";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Login gagal.");
      router.replace("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-border bg-card/90 p-7 shadow-xl backdrop-blur-sm">
        <div className="mb-7 flex items-start gap-3">
          <span className="rounded-xl bg-forest/10 p-2.5 text-forest"><LockKeyhole /></span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">Akses internal</p>
            <h1 className="mt-1 font-display text-2xl font-semibold">Press Release Kemenag Depok</h1>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password bersama</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
          />
        </div>
        {error ? <Alert variant="destructive" className="mt-5"><AlertTitle>{error}</AlertTitle></Alert> : null}
        <Button type="submit" disabled={loading} className="mt-6 h-11 w-full bg-forest text-primary-foreground">
          {loading ? <><Loader2 className="animate-spin" /> Memeriksa...</> : "Masuk"}
        </Button>
      </form>
    </main>
  );
}
