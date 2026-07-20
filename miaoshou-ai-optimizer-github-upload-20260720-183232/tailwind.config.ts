import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172027",
        cloud: "#f6f7f9",
        line: "#d8dee6",
        accent: "#0f766e"
      }
    }
  },
  plugins: []
};

export default config;
