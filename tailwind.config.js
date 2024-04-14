/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,ts,jsx,tsx}"],
  safelist: ["btn-info", "btn-success", "btn-warning", "btn-error"],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["night", "dark", "business", "dim"],
  },
}
