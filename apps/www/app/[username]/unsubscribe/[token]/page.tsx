"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Status = "pending" | "done" | "invalid";

export default function UnsubscribePage() {
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
          `${API_URL}/subscribers/unsubscribe?token=${encodeURIComponent(token)}`,
        );
        if (cancelled) return;
        if (!res.ok) {
          setStatus("invalid");
          return;
        }
        const data = await res.json();
        if (data.authorName) setAuthorName(data.authorName);
        setStatus("done");
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
            {status === "pending" && "Unsubscribing…"}
            {status === "done" && "Unsubscribed"}
            {status === "invalid" && "Invalid link"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {status === "pending" && "Just a moment."}
            {status === "done" &&
              `You won't receive any more emails from ${authorName}.`}
            {status === "invalid" &&
              "This unsubscribe link is invalid. You may already be unsubscribed."}
          </p>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/${username}`}>Back to {authorName}&apos;s blog</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
