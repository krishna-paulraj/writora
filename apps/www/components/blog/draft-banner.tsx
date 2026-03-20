"use client";

import { EyeOffIcon } from "lucide-react";

export function DraftBanner() {
  return (
    <div className="bg-primary/10 text-primary sticky top-0 z-40 flex items-center justify-center gap-2 px-4 py-2 text-center text-sm font-medium backdrop-blur-sm">
      <EyeOffIcon className="size-3.5" />
      Draft Preview — Only you can see this
    </div>
  );
}
