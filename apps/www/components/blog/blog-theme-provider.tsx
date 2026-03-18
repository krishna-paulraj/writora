"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { themePresets } from "./theme-presets";

interface BlogThemeProviderProps {
  themeId: string;
  children: React.ReactNode;
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

  // Load Google Fonts and apply theme vars to <body>
  useEffect(() => {
    if (themeId === "default" || Object.keys(vars).length === 0) return;

    // Load fonts
    const fontFamilies = [fonts.sans, fonts.serif, fonts.mono]
      .filter(Boolean)
      .map((f) => f.replace(/ /g, "+"))
      .map((f) => `family=${f}:wght@300;400;500;600;700`)
      .join("&");

    const linkId = "blog-theme-fonts";
    let link = document.getElementById(linkId) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?${fontFamilies}&display=swap`;

    // Apply CSS variables to <body> so navbar inherits them too
    const body = document.body;
    const entries = Object.entries(vars);
    for (const [key, value] of entries) {
      body.style.setProperty(key, value);
    }
    body.style.setProperty("--font-blog-sans", `"${fonts.sans}", ui-sans-serif, system-ui, sans-serif`);
    body.style.setProperty("--font-blog-serif", `"${fonts.serif}", ui-serif, Georgia, serif`);
    body.style.setProperty("--font-blog-mono", `"${fonts.mono}", ui-monospace, monospace`);
    body.style.setProperty("--display-family", `"${fonts.serif}", ui-serif, Georgia, serif`);
    body.style.setProperty("--text-family", `"${fonts.sans}", ui-sans-serif, system-ui, sans-serif`);
    body.style.setProperty("--font-display", `"${fonts.serif}", ui-serif, Georgia, serif`);
    body.style.setProperty("--font-text", `"${fonts.sans}", ui-sans-serif, system-ui, sans-serif`);

    return () => {
      // Cleanup: remove all applied properties on unmount
      for (const [key] of entries) {
        body.style.removeProperty(key);
      }
      body.style.removeProperty("--font-blog-sans");
      body.style.removeProperty("--font-blog-serif");
      body.style.removeProperty("--font-blog-mono");
      body.style.removeProperty("--display-family");
      body.style.removeProperty("--text-family");
      body.style.removeProperty("--font-display");
      body.style.removeProperty("--font-text");
    };
  }, [themeId, vars, fonts, mode]);

  return <>{children}</>;
}
