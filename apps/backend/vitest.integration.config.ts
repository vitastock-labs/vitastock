import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		environment: "node",
		fileParallelism: false,
		include: ["src/**/*.integration.test.ts"],
	},
});
