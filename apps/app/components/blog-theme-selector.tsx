"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon, Loader2Icon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sortedThemes } from "@/lib/themes-config";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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

  const filtered = useMemo(() => {
    if (!search) return sortedThemes;
    const q = search.toLowerCase();
    return sortedThemes.filter((t) => t.title.toLowerCase().includes(q));
  }, [search]);

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
        {filtered.map((theme) => {
          const isDefault = theme.name === "default";
          const previewAttr = isDefault ? undefined : `${theme.name}-light`;
          return (
            <button
              key={theme.name}
              onClick={() => {
                setSelectedTheme(theme.name);
                setSaved(false);
              }}
              className={cn(
                "relative flex flex-col gap-2 rounded-lg border-2 p-3 transition-all hover:shadow-sm",
                selectedTheme === theme.name
                  ? "border-primary ring-primary/20 ring-2"
                  : "border-border hover:border-foreground/20",
              )}
            >
              {selectedTheme === theme.name && (
                <div className="bg-primary text-primary-foreground absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full">
                  <CheckIcon className="size-3" />
                </div>
              )}
              <div
                data-theme={previewAttr}
                className="bg-background flex h-14 w-full overflow-hidden rounded"
              >
                <div className="bg-primary h-full w-1/3" />
                <div className="flex h-full w-2/3 flex-col justify-end gap-0.5 p-1.5">
                  <div className="bg-foreground/80 h-1.5 w-3/4 rounded-sm" />
                  <div className="bg-muted h-1 w-full rounded-sm" />
                  <div className="bg-accent h-1 w-2/3 rounded-sm" />
                </div>
              </div>
              <span className="text-xs font-medium">{theme.title}</span>
            </button>
          );
        })}
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
