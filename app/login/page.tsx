"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = login(email, password);
    if (!result.ok) {
      setError(result.message);
      setIsLoading(false);
      return;
    }

    router.replace("/today");
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-env(safe-area-inset-top))] w-full max-w-md flex-col justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
      <p className="mb-8 text-center text-3xl font-semibold text-[var(--foreground)]">FitPlan</p>

      <section className="w-full rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
        <h1 className="text-center text-3xl font-bold text-[var(--foreground)]">Welcome back</h1>
        <p className="mt-2 text-center text-sm text-[var(--muted)]">Log in to continue</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--muted)]">Email</span>
            <input
              autoFocus
              type="text"
              className={[
                "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-blue-500",
                error ? "ring-1 ring-rose-400" : "",
              ].join(" ")}
              placeholder=""
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--muted)]">Password</span>
            <input
              type="password"
              className={[
                "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-blue-500",
                error ? "ring-1 ring-rose-400" : "",
              ].join(" ")}
              placeholder=""
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
          >
            {isLoading ? "Entrando..." : "Login"}
          </button>
        </form>
      </section>
    </div>
  );
}
