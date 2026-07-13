/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Fraunces"', "serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      colors: {
        paper: "#F6F5F1",
        ink: "#1B1F27",
        line: "#DBD8CF",
        navy: "#1E3A5F",
        seal: "#A6402F",
        muted: "#6B6F76",
      },
    },
  },
  plugins: [],
};
