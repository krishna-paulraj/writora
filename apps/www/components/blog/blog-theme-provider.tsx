"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { themePresets } from "./theme-presets";

interface BlogThemeProviderProps {
  themeId: string;
  children: React.ReactNode;
}

function extractFontFamily(fontFamilyValue: string): string | null {
  if (!fontFamilyValue) return null;
  const firstFont = fontFamilyValue.split(",")[0].trim();
  const cleanFont = firstFont.replace(/['"]/g, "");
  const systemFonts = [
    "ui-sans-serif", "ui-serif", "ui-monospace", "system-ui",
    "sans-serif", "serif", "monospace", "cursive", "fantasy",
  ];
  if (systemFonts.includes(cleanFont.toLowerCase())) return null;
  return cleanFont;
}

function loadGoogleFont(family: string) {
  const weights = ["400", "500", "600", "700"];
  const encodedFamily = encodeURIComponent(family);
  const weightsParam = weights.join(";");
  const href = `https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@${weightsParam}&display=swap`;

  const existing = document.querySelector(`link[href="${href}"]`);
  if (existing) return;

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const preset = themePresets[themeId] || themePresets["default"];
  const mode = mounted && resolvedTheme === "dark" ? "dark" : "light";
  const vars = preset[mode];
  const fonts = preset.font;

  useEffect(() => {
    const root = document.documentElement;
    const appliedKeys: string[] = [];

    // Quote multi-word font names for valid CSS
    const q = (name: string) => (name.includes(" ") ? `"${name}"` : name);
    const sansValue = `${q(fonts.sans)}, ui-sans-serif, system-ui, sans-serif`;
    const serifValue = `${q(fonts.serif)}, ui-serif, Georgia, serif`;
    const monoValue = `${q(fonts.mono)}, ui-monospace, monospace`;

    // 1. Load Google Fonts via <link> tags
    for (const fontName of [fonts.sans, fonts.serif, fonts.mono]) {
      const family = extractFontFamily(fontName);
      if (family) loadGoogleFont(family);
    }

    // 2. Apply theme COLOR variables on :root
    for (const [key, value] of Object.entries(vars)) {
      if (typeof value === "string" && value.trim()) {
        root.style.setProperty(key, value);
        appliedKeys.push(key);
      }
    }

    // 3. Inject a <style> tag that uses @layer to override Tailwind's layers
    // Tailwind v4 uses @layer theme > @layer base > @layer utilities
    // We inject rules into the SAME layers to override them
    const styleId = "blog-theme-font-overrides";
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = `
      @layer theme {
        :root, :host {
          --default-font-family: ${sansValue};
          --default-mono-font-family: ${monoValue};
          --font-sans: ${sansValue};
          --font-serif: ${serifValue};
          --font-mono: ${monoValue};
          --font-text: ${sansValue};
          --font-display: ${serifValue};
          --text-family: ${sansValue};
          --display-family: ${serifValue};
        }
      }
      @layer base {
        html, :host {
          font-family: ${sansValue};
        }
        code, kbd, samp, pre {
          font-family: ${monoValue};
        }
      }
      @layer utilities {
        body, .font-text {
          font-family: ${sansValue};
        }
        h1, h2, .font-display {
          font-family: ${serifValue};
        }
        .font-sans {
          font-family: ${sansValue};
        }
        .font-serif {
          font-family: ${serifValue};
        }
        .font-mono {
          font-family: ${monoValue};
        }
      }
    `;

    return () => {
      for (const key of appliedKeys) {
        root.style.removeProperty(key);
      }
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, [themeId, vars, fonts, mode]);

  return <>{children}</>;
}
