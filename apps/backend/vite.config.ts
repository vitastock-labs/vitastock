import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
	nitro: {
		rolldownConfig: {
			external: [/^bull-board/, /^@bull-board/],
		},
		serverEntry: "./src/server.ts",
	},
	plugins: [nitro()],
	resolve: {
		tsconfigPaths: true,
	},
});
