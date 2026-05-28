"use client";

import { SiteHeader } from "@/components/site-header";
import { KeywordPicker } from "@/components/keyword-picker";

export default function KeywordsPage() {
  return (
    <>
      <SiteHeader title="Keyword Research" />
      <div className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
          <div className="mb-6 space-y-1">
            <h2 className="text-2xl font-semibold">Keyword research</h2>
            <p className="text-muted-foreground text-sm">
              Find keywords with search volume and difficulty, and save the ones
              worth targeting.
            </p>
          </div>
          <KeywordPicker />
        </div>
      </div>
    </>
  );
}
