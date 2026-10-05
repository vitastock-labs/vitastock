import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	deps: {
		alwaysBundle: ["@vitastock/**"],
	},
	dts: {
		eager: true,
	},
	entry: ["./src/server.ts", "./src/worker.ts"],
	fixedExtension: false,
	format: ["esm"],
	platform: "node",
	target: "esnext",
	treeshake: true,
});
