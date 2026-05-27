import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
	nitro: {
		rolldownConfig: {
			external: ["@bull-board/api", "@bull-board/hono", "bullmq", "ioredis", "redis"],
		},
		serverEntry: "./src/server.ts",
		traceDeps: ["@bull-board/api*", "@bull-board/hono*", "bullmq*", "ioredis*", "redis*"],
	},
	plugins: [nitro()],
	resolve: {
		tsconfigPaths: true,
	},
});
