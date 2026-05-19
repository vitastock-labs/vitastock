import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
	nitro: {
		serverEntry: "./src/server.ts",
	},
	plugins: [nitro()],
	resolve: {
		tsconfigPaths: true,
	},
});
