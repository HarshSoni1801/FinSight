import typography from "@tailwindcss/typography";
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",  // ← add this
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        sans: ["Inter", "sans-serif"],
      },
      colors: {
        bg: "#0a0a0f",
        surface: "#12121a",
        border: "#1e1e2e",
        accent: "#00ff9d",
        accentDim: "#00cc7d",
        muted: "#4a4a6a",
        text: "#e2e2f0",
        textDim: "#8888aa",
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0, transform: 'translateY(6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.25s ease-out',
      }
    },
  },
  plugins: [typography],
};