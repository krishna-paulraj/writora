"use client";

import { useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function ViewTracker({ blogId }: { blogId: string }) {
  useEffect(() => {
    fetch(`${API_URL}/analytics/track/${blogId}`, {
      method: "POST",
    }).catch(() => {});
  }, [blogId]);

  return null;
}
