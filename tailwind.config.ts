import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Soker white design system tokens
        border: "#E5E7EB",
        input: "#E5E7EB",
        ring: "#2563EB",
        background: "#FFFFFF",
        appgray: "#F8FAFC",
        foreground: "#0F172A",
        primary: {
          DEFAULT: "#1F3864", // navy
          blue: "#2563EB",
          foreground: "#FFFFFF",
        },
        success: { DEFAULT: "#16A34A", soft: "#DCFCE7" }, // income green
        danger: { DEFAULT: "#DC2626", soft: "#FEE2E2" }, // expense / overdue red
        warning: { DEFAULT: "#D97706", soft: "#FEF3C7" }, // amber
        muted: { DEFAULT: "#F1F5F9", foreground: "#64748B" },
        card: { DEFAULT: "#FFFFFF", foreground: "#0F172A" },
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(16 24 40 / 0.04), 0 1px 3px 0 rgb(16 24 40 / 0.06)",
        card: "0 1px 3px 0 rgb(16 24 40 / 0.06), 0 4px 12px -2px rgb(16 24 40 / 0.05)",
      },
      fontFamily: {
        sans: ["var(--font-cairo)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
