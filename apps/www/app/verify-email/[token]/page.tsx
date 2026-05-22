"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

type Status = "pending" | "verified" | "invalid" | "expired";

export default function VerifyEmailPage() {
  const params = useParams();
  const token = params.token as string;
  const [status, setStatus] = useState<Status>("pending");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        if (res.ok) {
          setStatus("verified");
        } else {
          const data = await res.json().catch(() => ({}));
          const msg = (data.message || "").toLowerCase();
          setStatus(msg.includes("expired") ? "expired" : "invalid");
        }
      } catch {
        if (!cancelled) setStatus("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-semibold">
            {status === "pending" && "Verifying your email..."}
            {status === "verified" && "Email verified"}
            {status === "invalid" && "Invalid link"}
            {status === "expired" && "Link expired"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {status === "pending" && "Just a moment."}
            {status === "verified" &&
              "You're all set. You can now use every feature on Writora."}
            {status === "invalid" &&
              "This verification link isn't valid. Try requesting a new one from your dashboard."}
            {status === "expired" &&
              "This link is older than 24 hours. Request a new one from your dashboard."}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {status === "verified" && (
            <Button asChild className="w-full">
              <a href={APP_URL}>Go to dashboard</a>
            </Button>
          )}
          {(status === "invalid" || status === "expired") && (
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
