"use client";

import { useState } from "react";
import { CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface SubscribeCardProps {
  username: string;
  authorName: string;
  compact?: boolean;
}

export function SubscribeCard({
  username,
  authorName,
  compact = false,
}: SubscribeCardProps) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setState("loading");
    setError("");
    try {
      const res = await fetch(
        `${API_URL}/subscribers/${encodeURIComponent(username)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message || "Couldn't subscribe. Try again.");
        setState("error");
        return;
      }
      setState("sent");
    } catch {
      setError("Couldn't subscribe. Try again.");
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <div
        className={`bg-card text-card-foreground flex items-start gap-3 rounded-lg border p-${compact ? "4" : "6"}`}
      >
        <CheckCircle2Icon className="text-primary mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-medium">Check your inbox</p>
          <p className="text-muted-foreground text-sm">
            We sent a confirmation link to <strong>{email}</strong>. Click it to
            finish subscribing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-card text-card-foreground rounded-lg border p-${compact ? "4" : "6"}`}
    >
      <h3 className={`font-semibold ${compact ? "text-base" : "text-lg"}`}>
        Subscribe to {authorName}
      </h3>
      <p className="text-muted-foreground mt-1 text-sm">
        New posts delivered to your inbox. No spam, unsubscribe anytime.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="flex-1"
        />
        <Button type="submit" disabled={state === "loading"}>
          {state === "loading" ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            "Subscribe"
          )}
        </Button>
      </form>
      {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
    </div>
  );
}
