/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx,mdx}",
    "./components/**/*.{js,jsx,ts,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-heebo)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f0fdf6",
          100: "#dcfce9",
          200: "#bbf7d3",
          300: "#86efb3",
          400: "#4ade8b",
          500: "#22c56b",
          600: "#16a356",
          700: "#158045",
          800: "#16653a",
          900: "#145331",
        },
        ink: {
          DEFAULT: "#0f2a23",
          soft: "#3f5a52",
        },
      },
      boxShadow: {
        card: "0 10px 30px -12px rgba(16, 65, 50, 0.18)",
      },
    },
  },
  plugins: [],
};
