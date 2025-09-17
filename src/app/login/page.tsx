"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", rememberMe: true });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error("Please enter email and password");
      return;
    }
    setLoading(true);
    const { error } = await authClient.signIn.email({
      email: form.email,
      password: form.password,
      rememberMe: form.rememberMe,
      callbackURL: "/account",
    });
    setLoading(false);
    if (error?.code) {
      toast.error("Invalid email or password. Please register first if you don't have an account.");
      return;
    }
    router.push("/account");
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-6">
        <h1 className="text-xl font-semibold mb-1">Login</h1>
        <p className="text-sm text-muted-foreground mb-6">
          New here? <Link href="/register" className="text-emerald-600 hover:underline">Create an account</Link>
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="w-full px-3 py-2 rounded-md border bg-background"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="off"
              className="w-full px-3 py-2 rounded-md border bg-background"
              value={form.password}
              onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.rememberMe}
              onChange={(e) => setForm((s) => ({ ...s, rememberMe: e.target.checked }))}
            />
            Remember me
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-70"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}