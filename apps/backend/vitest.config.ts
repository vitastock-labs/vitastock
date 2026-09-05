import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		environment: "node",
		exclude: ["src/**/*.integration.test.ts"],
		include: ["src/**/*.test.ts"],
	},
});
