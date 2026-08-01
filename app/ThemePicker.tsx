"use client";

import { useEffect, useState } from "react";
import {
  applyBgEffectColor,
  applyBgEffectIntensity,
  applyBgEffectSize,
  applyBgPattern,
  applyFrostedGlass,
  BG_PATTERNS,
} from "./themeEffects";

type ThemeColors = {
  bg: string;
  fg: string;
  panel: string;
  border: string;
  red: string;
};

type BackgroundSettings = {
  pattern: string;
  effectColor: string;
  intensity: number;
  size: number;
  frosted: boolean;
};

type StoredTheme = {
  name: string;
  colors: ThemeColors;
  background: BackgroundSettings;
};

// Exact presets from cashmoney-mint/src/themes.js.
const themes: Record<string, ThemeColors> = {
  dark: { bg: "#282c34", fg: "#9cdef2", panel: "#111111", border: "#355a66", red: "#e06c75" },
  light: { bg: "#f0ebe3", fg: "#5a5248", panel: "#faf6f0", border: "#d4cdc2", red: "#c47d5a" },
  midnight: { bg: "#0d1117", fg: "#c9d1d9", panel: "#161b22", border: "#30363d", red: "#f85149" },
  paper: { bg: "#faf8f5", fg: "#3b3836", panel: "#ffffff", border: "#d5d0c8", red: "#c5ac4a" },
  cyberpunk: { bg: "#0a0a0f", fg: "#0ff0fc", panel: "#12101a", border: "#9b30ff", red: "#e040fb" },
  retrowave: { bg: "#1a1a2e", fg: "#e94560", panel: "#16213e", border: "#533483", red: "#e94560" },
  forest: { bg: "#1b2a1b", fg: "#a8d5a2", panel: "#142414", border: "#3d6b3d", red: "#7cb871" },
  ocean: { bg: "#0b1a2c", fg: "#64d2ff", panel: "#091422", border: "#1e5074", red: "#4facfe" },
  ume: { bg: "#2b1b2e", fg: "#f5c2e7", panel: "#1e1420", border: "#6c4675", red: "#f5a0c0" },
  copper: { bg: "#1c1410", fg: "#e8c39e", panel: "#140f0a", border: "#7a5533", red: "#d4764e" },
  terminal: { bg: "#000000", fg: "#00ff41", panel: "#0a0a0a", border: "#003b00", red: "#00ff41" },
  organs: { bg: "#0a0406", fg: "#efe1c8", panel: "#15080a", border: "#3a1519", red: "#c83240" },
  lavender: { bg: "#f3eef8", fg: "#3d3551", panel: "#faf7ff", border: "#cec3de", red: "#9b6dcc" },
  gpt: { bg: "#212121", fg: "#ececec", panel: "#171717", border: "#424242", red: "#949494" },
  claude: { bg: "#262624", fg: "#f5f4f0", panel: "#30302e", border: "#4a4a47", red: "#c6613f" },
  cute: { bg: "#fff0f5", fg: "#d4608a", panel: "#fff8fa", border: "#f0c0d0", red: "#ff6b9d" },
};

const storageKey = "limited-exchange-theme-v1";
const defaultBackground: BackgroundSettings = {
  pattern: "none",
  effectColor: "",
  intensity: 1,
  size: 1,
  frosted: false,
};

const themeDefaults: Record<string, Partial<BackgroundSettings>> = {
  light: { pattern: "dots" },
  midnight: { pattern: "rain", effectColor: "#ffffff", intensity: 0.5 },
  paper: { pattern: "dots" },
  cyberpunk: { pattern: "synapse" },
  retrowave: { pattern: "embers" },
  forest: { pattern: "petals" },
  ocean: { pattern: "constellations" },
  terminal: { pattern: "perlin-flow", intensity: 0.8 },
  organs: { pattern: "rain", effectColor: "#451616", intensity: 0.65 },
  ume: { pattern: "petals", effectColor: "#f5a0c0" },
  lavender: { frosted: true },
  cute: { pattern: "sparkles", effectColor: "#ff8cb8" },
};

function displayName(name: string) {
  if (name === "dark") return "original";
  if (name === "gpt") return "GPT";
  return name;
}

function applyColors(colors: ThemeColors) {
  const style = document.documentElement.style;
  Object.entries(colors).forEach(([key, value]) => style.setProperty(`--${key}`, value));
}

function applyBackground(settings: BackgroundSettings) {
  applyBgEffectColor(settings.effectColor);
  applyBgEffectIntensity(settings.intensity);
  applyBgEffectSize(settings.size);
  applyFrostedGlass(settings.frosted);
  applyBgPattern(settings.pattern);
}

function saveTheme(name: string, colors: ThemeColors, background: BackgroundSettings) {
  localStorage.setItem(storageKey, JSON.stringify({ name, colors, background } satisfies StoredTheme));
}

export default function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [tab, setTab] = useState<"themes" | "customize">("themes");
  const [activeName, setActiveName] = useState("dark");
  const [colors, setColors] = useState<ThemeColors>(themes.dark);
  const [draft, setDraft] = useState<ThemeColors>(themes.dark);
  const [background, setBackground] = useState<BackgroundSettings>(defaultBackground);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) {
        applyColors(themes.dark);
        applyBackground(defaultBackground);
        return;
      }
      const parsed = JSON.parse(saved) as StoredTheme;
      if (!parsed.colors || !parsed.background) return;
      setActiveName(parsed.name || "custom");
      setColors(parsed.colors);
      setDraft(parsed.colors);
      setBackground(parsed.background);
      applyColors(parsed.colors);
      applyBackground(parsed.background);
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function pickTheme(name: string) {
    const nextColors = themes[name];
    const nextBackground = {
      ...defaultBackground,
      ...themeDefaults[name],
    };
    setActiveName(name);
    setColors(nextColors);
    setDraft(nextColors);
    setBackground(nextBackground);
    applyColors(nextColors);
    applyBackground(nextBackground);
    saveTheme(name, nextColors, nextBackground);
  }

  function applyCustomTheme() {
    setActiveName("custom");
    setColors(draft);
    applyColors(draft);
    saveTheme("custom", draft, background);
  }

  function changeBackground(next: BackgroundSettings) {
    setBackground(next);
    applyBackground(next);
    saveTheme(activeName, colors, next);
  }

  return (
    <>
      <button
        className="theme-launcher"
        type="button"
        onClick={() => { setOpen(true); setMinimized(false); }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span aria-hidden="true">◉</span> Theme
      </button>

      {open && (
        <section className={`theme-window${minimized ? " minimized" : ""}`} role="dialog" aria-label="Theme picker">
          <header className="theme-window-title">
            <strong>◉ Theme</strong>
            <div>
              <button type="button" onClick={() => setMinimized((value) => !value)} aria-label={minimized ? "Restore theme window" : "Minimize theme window"}>
                {minimized ? "□" : "−"}
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close theme window">×</button>
            </div>
          </header>

          {!minimized && (
            <>
              <div className="theme-tabs" role="tablist" aria-label="Theme options">
                <button type="button" role="tab" aria-selected={tab === "themes"} className={tab === "themes" ? "active" : ""} onClick={() => setTab("themes")}>◉ Themes</button>
                <button type="button" role="tab" aria-selected={tab === "customize"} className={tab === "customize" ? "active" : ""} onClick={() => setTab("customize")}>⌕ Customize</button>
              </div>

              <div className="theme-window-body">
                {tab === "themes" ? (
                  <div className="theme-group">
                    <h3>Default Themes</h3>
                    <div className="theme-presets">
                      {Object.entries(themes).map(([name, palette]) => (
                        <button
                          key={name}
                          type="button"
                          className={activeName === name ? "selected" : ""}
                          onClick={() => pickTheme(name)}
                          style={{ background: palette.bg, color: palette.fg, borderColor: activeName === name ? colors.red : palette.border }}
                          aria-label={`Use ${displayName(name)} theme`}
                        >
                          <span className="palette-dots" aria-hidden="true">
                            {[palette.bg, palette.panel, palette.fg, palette.red].map((color, index) => (
                              <i key={`${color}-${index}`} style={{ background: color }} />
                            ))}
                          </span>
                          <span>{displayName(name)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="theme-group">
                    <h3>Colors</h3>
                    <div className="color-controls">
                      {([
                        ["bg", "Background"],
                        ["fg", "Text"],
                        ["panel", "Panel"],
                        ["border", "Border"],
                        ["red", "Accent"],
                      ] as const).map(([field, label]) => (
                        <label key={field}>
                          <span>{label}</span>
                          <input type="color" value={draft[field]} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} />
                        </label>
                      ))}
                    </div>
                    <button className="apply-theme" type="button" onClick={applyCustomTheme}>Apply Custom Theme</button>

                    <h3 className="background-heading">Background</h3>
                    <div className="background-controls">
                      <label>
                        <span>Animation</span>
                        <select value={background.pattern} onChange={(event) => changeBackground({ ...background, pattern: event.target.value })}>
                          {BG_PATTERNS.map((pattern: string) => <option key={pattern} value={pattern}>{pattern}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>Effect color</span>
                        <input type="color" value={background.effectColor || colors.fg} onChange={(event) => changeBackground({ ...background, effectColor: event.target.value })} />
                      </label>
                      <label>
                        <span>Intensity</span>
                        <input type="range" min="0" max="100" value={Math.round(background.intensity * 100)} onChange={(event) => changeBackground({ ...background, intensity: Number(event.target.value) / 100 })} />
                      </label>
                      <label>
                        <span>Size</span>
                        <input type="range" min="30" max="250" value={Math.round(background.size * 100)} onChange={(event) => changeBackground({ ...background, size: Number(event.target.value) / 100 })} />
                      </label>
                      <label>
                        <span>Frosted glass</span>
                        <input type="checkbox" checked={background.frosted} onChange={(event) => changeBackground({ ...background, frosted: event.target.checked })} />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}
