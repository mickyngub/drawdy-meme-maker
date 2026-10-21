import { defineConfig } from "vite";
import { drawdyExtension } from "./vite-plugin-drawdy";

export default defineConfig({
    appType: "custom",
    server: {
        port: 5191,
        strictPort: true,
    },
    plugins: [drawdyExtension()],
});
