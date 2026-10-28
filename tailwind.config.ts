import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      // Apple Human Interface palette: system blue accent, near-black text.
      colors: {
        brand: {
          50: "#eef5ff",
          100: "#d9e9ff",
          500: "#0a84ff",
          600: "#007aff",
          700: "#1d1d1f",
          800: "#000000",
          900: "#000000",
        },
        blue: {
          50: "#eef5ff",
          100: "#d9e9ff",
          200: "#b3d4ff",
          300: "#80b9ff",
          400: "#4d9dff",
          500: "#0a84ff",
          600: "#007aff",
          700: "#0062cc",
          800: "#004c9e",
          900: "#003670",
        },
        apple: {
          bg: "#f5f5f7",
          fill: "#e8e8ed",
          separator: "#d2d2d7",
          label: "#1d1d1f",
          secondary: "#6e6e73",
          tertiary: "#86868b",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro Display"',
          "Inter",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
        mono: ['"SF Mono"', "ui-monospace", "Menlo", '"JetBrains Mono"', "monospace"],
      },
      boxShadow: {
        apple: "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)",
        "apple-lg": "0 2px 6px rgba(0,0,0,0.06), 0 12px 40px rgba(0,0,0,0.12)",
      },
    },
  },
  plugins: [forms],
};

export default config;
