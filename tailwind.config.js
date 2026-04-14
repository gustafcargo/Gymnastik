/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          0: "#F8FAFB",
          1: "#FFFFFF",
          2: "#F1F4F8",
          3: "#E4E9F0",
        },
        floor: {
          light: "#E9C79A",
          DEFAULT: "#D9B382",
          dark: "#B9945F",
        },
        grid: "#C9B896",
        accent: {
          DEFAULT: "#2563EB",
          soft: "#DBEAFE",
          ink: "#0B3FA8",
        },
        redskap: {
          barr: "#F4A261",
          trampett: "#E76F51",
          bom: "#2A9D8F",
          ringar: "#8338EC",
          matta: "#A8DADC",
          golv: "#B5E48C",
          tjock: "#8ECAE6",
          hopp: "#FFB703",
          rack: "#9D4EDD",
          bygel: "#F08080",
          plint: "#CDB4DB",
          mini: "#FB8500",
          tumbling: "#80ED99",
          air: "#90E0EF",
          land: "#FFD6A5",
          bock: "#BDE0FE",
          skum: "#CAFFBF",
        },
      },
      fontFamily: {
        sans: [
          "InterVariable",
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        xs: "0 1px 2px rgba(15, 23, 42, 0.06)",
        selected:
          "0 0 0 2px #2563EB, 0 10px 30px -10px rgba(37, 99, 235, 0.45)",
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.96)", opacity: "0" },
          "60%": { transform: "scale(1.02)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        pop: "pop 180ms cubic-bezier(0.2, 0.9, 0.3, 1.3)",
      },
    },
  },
  plugins: [],
};
