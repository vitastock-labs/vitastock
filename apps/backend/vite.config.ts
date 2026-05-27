import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
	nitro: {
		rolldownConfig: {
			external: ["@bull-board/api", "@bull-board/hono"],
		},
		serverEntry: "./src/server.ts",
		traceDeps: ["@bull-board/api*", "@bull-board/hono*"],
	},
	plugins: [nitro()],
	resolve: {
		tsconfigPaths: true,
	},
});
