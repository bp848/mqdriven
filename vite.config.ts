import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    base: command === "build" ? "./" : "/",
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode),
    },
    plugins: [react()],
  };
});
