"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Status = "pending" | "confirmed" | "invalid";

export default function ConfirmSubscriptionPage() {
  const params = useParams();
  const token = params.token as string;
  const username = params.username as string;
  const [status, setStatus] = useState<Status>("pending");
  const [authorName, setAuthorName] = useState(username);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_URL}/subscribers/confirm?token=${encodeURIComponent(token)}`,
        );
        if (cancelled) return;
        if (!res.ok) {
          setStatus("invalid");
          return;
        }
        const data = await res.json();
        if (data.authorName) setAuthorName(data.authorName);
        setStatus("confirmed");
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
            {status === "pending" && "Confirming…"}
            {status === "confirmed" && "You're subscribed"}
            {status === "invalid" && "This link is invalid"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {status === "pending" && "Just a moment."}
            {status === "confirmed" &&
              `You'll receive new posts from ${authorName} in your inbox.`}
            {status === "invalid" &&
              "This confirmation link is invalid or has already been used."}
          </p>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/${username}`}>Read {authorName}&apos;s blog</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
