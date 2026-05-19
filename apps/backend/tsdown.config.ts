import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	deps: {
		alwaysBundle: ["@vitastock/**"],
	},
	dts: true,
	entry: "./src/server.ts",
	fixedExtension: false,
	format: ["esm"],
	platform: "node",
	target: "esnext",
	treeshake: true,
});
