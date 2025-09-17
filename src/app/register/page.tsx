"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      toast.error("Please complete all fields");
      return;
    }
    if (form.password !== form.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    const { error } = await authClient.signUp.email({
      email: form.email,
      name: form.name,
      password: form.password,
    });
    setLoading(false);
    if (error?.code) {
      const map: Record<string, string> = { USER_ALREADY_EXISTS: "Email already registered" };
      toast.error(map[error.code] || "Registration failed");
      return;
    }
    toast.success("Account created! Please login.");
    router.push("/login?registered=true");
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-6">
        <h1 className="text-xl font-semibold mb-1">Create account</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Already have an account? <Link href="/login" className="text-emerald-600 hover:underline">Sign in</Link>
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm" htmlFor="name">Name</label>
            <input
              id="name"
              className="w-full px-3 py-2 rounded-md border bg-background"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            />
          </div>
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
          <div className="space-y-2">
            <label className="text-sm" htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              type="password"
              autoComplete="off"
              className="w-full px-3 py-2 rounded-md border bg-background"
              value={form.confirm}
              onChange={(e) => setForm((s) => ({ ...s, confirm: e.target.value }))}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-70"
          >
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}