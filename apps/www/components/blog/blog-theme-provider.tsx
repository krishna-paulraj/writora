"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
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
  const scopeRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const preset = themePresets[themeId] || themePresets["default"];
  const mode = mounted && resolvedTheme === "dark" ? "dark" : "light";
  const vars = preset[mode];
  const fonts = preset.font;

  useEffect(() => {
    // Target the .blog-scope element so font vars override the next/font defaults
    const scope = scopeRef.current?.closest(".blog-scope") as HTMLElement | null;
    const body = document.body;
    const appliedOnBody: string[] = [];
    const appliedOnScope: string[] = [];

    // Load Google Fonts
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

    // Apply color/theme CSS variables on body
    const entries = Object.entries(vars);
    for (const [key, value] of entries) {
      body.style.setProperty(key, value);
      appliedOnBody.push(key);
    }

    // Apply font CSS variables on the blog-scope element (overrides next/font class vars)
    const target = scope || body;
    const fontVars: Record<string, string> = {
      "--font-blog-sans": `"${fonts.sans}", ui-sans-serif, system-ui, sans-serif`,
      "--font-blog-serif": `"${fonts.serif}", ui-serif, Georgia, serif`,
      "--font-blog-mono": `"${fonts.mono}", ui-monospace, monospace`,
    };

    for (const [key, value] of Object.entries(fontVars)) {
      target.style.setProperty(key, value);
      appliedOnScope.push(key);
    }

    // Also set aliases on body for global CSS that uses these
    body.style.setProperty("--display-family", `"${fonts.serif}", ui-serif, Georgia, serif`);
    body.style.setProperty("--text-family", `"${fonts.sans}", ui-sans-serif, system-ui, sans-serif`);
    body.style.setProperty("--font-display", `"${fonts.serif}", ui-serif, Georgia, serif`);
    body.style.setProperty("--font-text", `"${fonts.sans}", ui-sans-serif, system-ui, sans-serif`);
    appliedOnBody.push("--display-family", "--text-family", "--font-display", "--font-text");

    return () => {
      for (const key of appliedOnBody) {
        body.style.removeProperty(key);
      }
      for (const key of appliedOnScope) {
        target.style.removeProperty(key);
      }
    };
  }, [themeId, vars, fonts, mode]);

  return <div ref={scopeRef}>{children}</div>;
}
