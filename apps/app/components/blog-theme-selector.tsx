"use client";

import { useEffect, useState } from "react";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ThemePreview {
  id: string;
  name: string;
  primary: string;
  background: string;
  foreground: string;
  muted: string;
  accent: string;
}

const themePreviews: ThemePreview[] = [
  { id: "default", name: "Default", primary: "oklch(0.92 0.04 86.47)", background: "oklch(1 0 0)", foreground: "oklch(0.145 0 0)", muted: "oklch(0.97 0 0)", accent: "oklch(0.97 0 0)" },
  { id: "marshmallow", name: "Marshmallow", primary: "oklch(0.72 0.12 340)", background: "oklch(0.98 0.005 340)", foreground: "oklch(0.25 0.02 340)", muted: "oklch(0.95 0.008 340)", accent: "oklch(0.94 0.015 340)" },
  { id: "art-deco", name: "Art Deco", primary: "oklch(0.60 0.12 55)", background: "oklch(0.96 0.01 75)", foreground: "oklch(0.22 0.02 55)", muted: "oklch(0.93 0.012 75)", accent: "oklch(0.92 0.02 75)" },
  { id: "vs-code", name: "VS Code", primary: "oklch(0.55 0.20 250)", background: "oklch(0.97 0.003 250)", foreground: "oklch(0.20 0.02 250)", muted: "oklch(0.94 0.005 250)", accent: "oklch(0.93 0.01 250)" },
  { id: "spotify", name: "Spotify", primary: "oklch(0.65 0.20 150)", background: "oklch(0.97 0.008 155)", foreground: "oklch(0.18 0.02 155)", muted: "oklch(0.94 0.01 155)", accent: "oklch(0.93 0.015 155)" },
  { id: "summer", name: "Summer", primary: "oklch(0.72 0.15 55)", background: "oklch(0.97 0.012 80)", foreground: "oklch(0.22 0.02 55)", muted: "oklch(0.94 0.015 80)", accent: "oklch(0.93 0.02 80)" },
  { id: "material-design", name: "Material Design", primary: "oklch(0.50 0.18 280)", background: "oklch(0.97 0.005 280)", foreground: "oklch(0.20 0.02 280)", muted: "oklch(0.94 0.008 280)", accent: "oklch(0.93 0.012 280)" },
  { id: "marvel", name: "Marvel", primary: "oklch(0.55 0.24 25)", background: "oklch(0.97 0.005 25)", foreground: "oklch(0.18 0.02 25)", muted: "oklch(0.94 0.008 25)", accent: "oklch(0.93 0.015 25)" },
  { id: "valorant", name: "Valorant", primary: "oklch(0.58 0.25 18)", background: "oklch(0.96 0.005 15)", foreground: "oklch(0.18 0.015 15)", muted: "oklch(0.93 0.006 15)", accent: "oklch(0.92 0.012 15)" },
  { id: "ghibli-studio", name: "Ghibli Studio", primary: "oklch(0.60 0.12 155)", background: "oklch(0.96 0.015 95)", foreground: "oklch(0.25 0.03 95)", muted: "oklch(0.93 0.018 95)", accent: "oklch(0.91 0.025 95)" },
  { id: "modern-minimal", name: "Modern Minimal", primary: "oklch(0.55 0.18 250)", background: "oklch(0.98 0 0)", foreground: "oklch(0.15 0 0)", muted: "oklch(0.95 0 0)", accent: "oklch(0.94 0 0)" },
  { id: "nature", name: "Nature", primary: "oklch(0.52 0.14 140)", background: "oklch(0.96 0.012 140)", foreground: "oklch(0.22 0.03 140)", muted: "oklch(0.93 0.015 140)", accent: "oklch(0.91 0.02 140)" },
  { id: "elegant-luxury", name: "Elegant Luxury", primary: "oklch(0.45 0.08 40)", background: "oklch(0.96 0.008 50)", foreground: "oklch(0.20 0.02 40)", muted: "oklch(0.93 0.01 50)", accent: "oklch(0.91 0.015 50)" },
  { id: "neo-brutalism", name: "Neo Brutalism", primary: "oklch(0.75 0.18 90)", background: "oklch(0.95 0.03 90)", foreground: "oklch(0.15 0.02 270)", muted: "oklch(0.92 0.025 90)", accent: "oklch(0.60 0.22 270)" },
  { id: "pastel-dreams", name: "Pastel Dreams", primary: "oklch(0.68 0.12 310)", background: "oklch(0.97 0.01 310)", foreground: "oklch(0.25 0.02 310)", muted: "oklch(0.94 0.012 310)", accent: "oklch(0.92 0.018 310)" },
  { id: "clean-slate", name: "Clean Slate", primary: "oklch(0.42 0.015 260)", background: "oklch(0.98 0 0)", foreground: "oklch(0.18 0.005 260)", muted: "oklch(0.95 0.003 260)", accent: "oklch(0.94 0.004 260)" },
  { id: "midnight-bloom", name: "Midnight Bloom", primary: "oklch(0.55 0.22 290)", background: "oklch(0.96 0.01 290)", foreground: "oklch(0.22 0.025 290)", muted: "oklch(0.93 0.012 290)", accent: "oklch(0.92 0.018 290)" },
  { id: "sunset-horizon", name: "Sunset Horizon", primary: "oklch(0.65 0.20 30)", background: "oklch(0.97 0.01 40)", foreground: "oklch(0.22 0.02 30)", muted: "oklch(0.94 0.012 40)", accent: "oklch(0.92 0.02 40)" },
  { id: "claude", name: "Claude", primary: "oklch(0.55 0.15 35)", background: "oklch(0.97 0.008 55)", foreground: "oklch(0.22 0.02 55)", muted: "oklch(0.94 0.01 55)", accent: "oklch(0.92 0.015 55)" },
];

export function BlogThemeSelector() {
  const [selectedTheme, setSelectedTheme] = useState("default");
  const [originalTheme, setOriginalTheme] = useState("default");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/auth/me`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setSelectedTheme(data.blogTheme || "default");
        setOriginalTheme(data.blogTheme || "default");
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ blogTheme: selectedTheme }),
      });
      if (res.ok) {
        setOriginalTheme(selectedTheme);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Blog Theme</Label>
        <p className="text-muted-foreground text-sm">
          Choose a color theme for your public blog page.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {themePreviews.map((theme) => (
          <button
            key={theme.id}
            onClick={() => {
              setSelectedTheme(theme.id);
              setSaved(false);
            }}
            className={cn(
              "relative flex flex-col gap-2 rounded-lg border-2 p-3 transition-all hover:shadow-sm",
              selectedTheme === theme.id
                ? "border-primary ring-primary/20 ring-2"
                : "border-border hover:border-foreground/20",
            )}
          >
            {selectedTheme === theme.id && (
              <div className="bg-primary text-primary-foreground absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full">
                <CheckIcon className="size-3" />
              </div>
            )}
            <div
              className="flex h-14 w-full overflow-hidden rounded"
              style={{ background: theme.background }}
            >
              <div
                className="h-full w-1/3"
                style={{ background: theme.primary }}
              />
              <div className="flex h-full w-2/3 flex-col justify-end gap-0.5 p-1.5">
                <div
                  className="h-1.5 w-3/4 rounded-sm"
                  style={{ background: theme.foreground, opacity: 0.8 }}
                />
                <div
                  className="h-1 w-full rounded-sm"
                  style={{ background: theme.muted }}
                />
                <div
                  className="h-1 w-2/3 rounded-sm"
                  style={{ background: theme.accent }}
                />
              </div>
            </div>
            <span className="text-xs font-medium">{theme.name}</span>
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || selectedTheme === originalTheme}
          className="max-sm:w-full"
        >
          {saving ? (
            <>
              <Loader2Icon className="mr-2 size-4 animate-spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <CheckIcon className="mr-2 size-4" />
              Saved
            </>
          ) : (
            "Save Theme"
          )}
        </Button>
      </div>
    </div>
  );
}
