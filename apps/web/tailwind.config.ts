import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        spexor: {
          ink: "#0f172a",
          mist: "#eff6ff",
          sand: "#f8f4ea",
          teal: "#0f766e",
          rust: "#b45309"
        }
      },
      boxShadow: {
        floaty: "0 24px 70px -40px rgba(15, 23, 42, 0.45)"
      }
    }
  },
  plugins: []
} satisfies Config;
