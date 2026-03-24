"use client";

import { useEffect, useState } from "react";
import { CheckIcon, Loader2Icon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  { id: "modern-minimal", name: "Modern Minimal", primary: "#3b82f6", background: "#ffffff", foreground: "#333333", muted: "#f9fafb", accent: "#e0f2fe" },
  { id: "violet-bloom", name: "Violet Bloom", primary: "#7033ff", background: "#fdfdfd", foreground: "#000000", muted: "#f5f5f5", accent: "#e2ebff" },
  { id: "t3-chat", name: "T3 Chat", primary: "#a84370", background: "#faf5fa", foreground: "#501854", muted: "#f6e5f3", accent: "#f1c4e6" },
  { id: "twitter", name: "Twitter", primary: "#1e9df1", background: "#ffffff", foreground: "#0f1419", muted: "#E5E5E6", accent: "#E3ECF6" },
  { id: "mocha-mousse", name: "Mocha Mousse", primary: "#A37764", background: "#F1F0E5", foreground: "#56453F", muted: "#E4C7B8", accent: "#E4C7B8" },
  { id: "bubblegum", name: "Bubblegum", primary: "#d04f99", background: "#f6e6ee", foreground: "#5b5b5b", muted: "#b2e1eb", accent: "#fbe2a7" },
  { id: "amethyst-haze", name: "Amethyst Haze", primary: "#8a79ab", background: "#f8f7fa", foreground: "#3d3c4f", muted: "#dcd9e3", accent: "#e6a5b8" },
  { id: "notebook", name: "Notebook", primary: "#606060", background: "#f9f9f9", foreground: "#3a3a3a", muted: "#e3e3e3", accent: "#f3eac8" },
  { id: "doom-64", name: "Doom 64", primary: "#b71c1c", background: "#cccccc", foreground: "#1f1f1f", muted: "#b8b8b8", accent: "#4682b4" },
  { id: "catppuccin", name: "Catppuccin", primary: "#8839ef", background: "#eff1f5", foreground: "#4c4f69", muted: "#dce0e8", accent: "#04a5e5" },
  { id: "graphite", name: "Graphite", primary: "#606060", background: "#f0f0f0", foreground: "#333333", muted: "#d9d9d9", accent: "#c0c0c0" },
  { id: "perpetuity", name: "Perpetuity", primary: "#06858e", background: "#e8f0f0", foreground: "#0a4a55", muted: "#e0eaea", accent: "#c9e5e7" },
  { id: "kodama-grove", name: "Kodama Grove", primary: "#8d9d4f", background: "#e4d7b0", foreground: "#5c4b3e", muted: "#decea0", accent: "#dbc894" },
  { id: "cosmic-night", name: "Cosmic Night", primary: "#6e56cf", background: "#f5f5ff", foreground: "#2a2a4a", muted: "#f0f0fa", accent: "#d8e6ff" },
  { id: "tangerine", name: "Tangerine", primary: "#e05d38", background: "#e8ebed", foreground: "#333333", muted: "#f9fafb", accent: "#d6e4f0" },
  { id: "quantum-rose", name: "Quantum Rose", primary: "#e6067a", background: "#fff0f8", foreground: "#91185c", muted: "#ffe3f2", accent: "#ffc1e3" },
  { id: "nature", name: "Nature", primary: "#2e7d32", background: "#f8f5f0", foreground: "#3e2723", muted: "#f0e9e0", accent: "#c8e6c9" },
  { id: "bold-tech", name: "Bold Tech", primary: "#8b5cf6", background: "#ffffff", foreground: "#312e81", muted: "#f5f3ff", accent: "#dbeafe" },
  { id: "elegant-luxury", name: "Elegant Luxury", primary: "#9b2c2c", background: "#faf7f5", foreground: "#1a1a1a", muted: "#f0ebe8", accent: "#fef3c7" },
  { id: "amber-minimal", name: "Amber Minimal", primary: "#f59e0b", background: "#ffffff", foreground: "#262626", muted: "#f9fafb", accent: "#fffbeb" },
  { id: "supabase", name: "Supabase", primary: "#72e3ad", background: "#fcfcfc", foreground: "#171717", muted: "#ededed", accent: "#ededed" },
  { id: "neo-brutalism", name: "Neo Brutalism", primary: "#ff3333", background: "#ffffff", foreground: "#000000", muted: "#f0f0f0", accent: "#0066ff" },
  { id: "solar-dusk", name: "Solar Dusk", primary: "#B45309", background: "#FDFBF7", foreground: "#4A3B33", muted: "#F1E9DA", accent: "#f2daba" },
  { id: "claymorphism", name: "Claymorphism", primary: "#6366f1", background: "#e7e5e4", foreground: "#1e293b", muted: "#e7e5e4", accent: "#f3e5f5" },
  { id: "cyberpunk", name: "Cyberpunk", primary: "#ff00c8", background: "#f8f9fa", foreground: "#0c0c1d", muted: "#f0f0ff", accent: "#00ffcc" },
  { id: "pastel-dreams", name: "Pastel Dreams", primary: "#a78bfa", background: "#f7f3f9", foreground: "#374151", muted: "#f3e8ff", accent: "#f3e5f5" },
  { id: "clean-slate", name: "Clean Slate", primary: "#6366f1", background: "#f8fafc", foreground: "#1e293b", muted: "#f3f4f6", accent: "#e0e7ff" },
  { id: "caffeine", name: "Caffeine", primary: "#644a40", background: "#f9f9f9", foreground: "#202020", muted: "#efefef", accent: "#e8e8e8" },
  { id: "ocean-breeze", name: "Ocean Breeze", primary: "#22c55e", background: "#f0f8ff", foreground: "#374151", muted: "#f3f4f6", accent: "#d1fae5" },
  { id: "retro-arcade", name: "Retro Arcade", primary: "#d33682", background: "#fdf6e3", foreground: "#073642", muted: "#93a1a1", accent: "#cb4b16" },
  { id: "midnight-bloom", name: "Midnight Bloom", primary: "#6c5ce7", background: "#f9f9f9", foreground: "#333333", muted: "#c9c4b5", accent: "#8b9467" },
  { id: "candyland", name: "Candyland", primary: "#ffc0cb", background: "#f7f9fa", foreground: "#333333", muted: "#ddd9c4", accent: "#ffff00" },
  { id: "northern-lights", name: "Northern Lights", primary: "#34a85a", background: "#f9f9fa", foreground: "#333333", muted: "#ddd9c4", accent: "#66d9ef" },
  { id: "vintage-paper", name: "Vintage Paper", primary: "#a67c52", background: "#f5f1e6", foreground: "#4a3f35", muted: "#ece5d8", accent: "#d4c8aa" },
  { id: "sunset-horizon", name: "Sunset Horizon", primary: "#ff7e5f", background: "#fff9f5", foreground: "#3d3436", muted: "#fff0eb", accent: "#feb47b" },
  { id: "starry-night", name: "Starry Night", primary: "#3a5ba0", background: "#f5f7fa", foreground: "#1a2238", muted: "#e5e5df", accent: "#6ea3c1" },
  { id: "claude", name: "Claude", primary: "#c96442", background: "#faf9f5", foreground: "#3d3929", muted: "#ede9de", accent: "#e9e6dc" },
  { id: "vercel", name: "Vercel", primary: "oklch(0 0 0)", background: "oklch(0.99 0 0)", foreground: "oklch(0 0 0)", muted: "oklch(0.97 0 0)", accent: "oklch(0.94 0 0)" },
  { id: "darkmatter", name: "Darkmatter", primary: "#d87943", background: "#ffffff", foreground: "#111827", muted: "#f3f4f6", accent: "#eeeeee" },
  { id: "mono", name: "Mono", primary: "#737373", background: "#ffffff", foreground: "#0a0a0a", muted: "#f5f5f5", accent: "#f5f5f5" },
  { id: "soft-pop", name: "Soft Pop", primary: "#4f46e5", background: "#f7f9f3", foreground: "#000000", muted: "#f0f0f0", accent: "#f59e0b" },
  { id: "sage-garden", name: "Sage Garden", primary: "#7c9082", background: "#f8f7f4", foreground: "#1a1f2e", muted: "#e8e6e1", accent: "#bfc9bb" },
];

export function BlogThemeSelector() {
  const [selectedTheme, setSelectedTheme] = useState("default");
  const [originalTheme, setOriginalTheme] = useState("default");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");

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

  const filtered = search
    ? themePreviews.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()),
      )
    : themePreviews;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Blog Theme</Label>
        <p className="text-muted-foreground text-sm">
          Choose a color theme for your public blog page.
        </p>
      </div>

      <div className="relative">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          placeholder="Search themes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filtered.map((theme) => (
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
