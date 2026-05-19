import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	dts: true,
	entry: ["src/**/*.ts"],
	fixedExtension: false,
	format: ["esm"],
	platform: "node",
	sourcemap: true,
	target: "esnext",
});
