"use client";

import { useTheme } from "next-themes";
import { useEffect, useSyncExternalStore } from "react";
import { themes } from "@/lib/themes-config";

// A subscription that never fires: with server snapshot false and client
// snapshot true, useSyncExternalStore yields a hydration-safe "mounted" flag
// without the classic setState-in-effect pattern.
const emptySubscribe = () => () => {};

interface BlogThemeProviderProps {
  themeId: string;
  children: React.ReactNode;
}

function extractFontFamily(fontFamilyValue: string): string | null {
  if (!fontFamilyValue) return null;
  const firstFont = fontFamilyValue.split(",")[0].trim();
  const cleanFont = firstFont.replace(/['"]/g, "");
  const systemFonts = [
    "ui-sans-serif",
    "ui-serif",
    "ui-monospace",
    "system-ui",
    "sans-serif",
    "serif",
    "monospace",
    "cursive",
    "fantasy",
    "courier new",
  ];
  if (systemFonts.includes(cleanFont.toLowerCase())) return null;
  return cleanFont;
}

function loadGoogleFont(family: string) {
  const weights = ["400", "500", "600", "700"];
  const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weights.join(";")}&display=swap`;
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

export function BlogThemeProvider({
  themeId,
  children,
}: BlogThemeProviderProps) {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!themeId || themeId === "default") return;

    const root = document.documentElement;
    const mode = mounted && resolvedTheme === "dark" ? "dark" : "light";
    const themeValue = `${themeId}-${mode}`;

    root.setAttribute("data-theme", themeValue);

    const config = themes.find((t) => t.name === themeId);
    if (config) {
      const family = extractFontFamily(config.fontSans);
      if (family) loadGoogleFont(family);
    }

    return () => {
      root.removeAttribute("data-theme");
    };
  }, [themeId, resolvedTheme, mounted]);

  return <>{children}</>;
}
