import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	dts: true,
	entry: ["src/**/*.ts"],
	format: ["esm"],
	platform: "neutral",
	sourcemap: true,
	target: "esnext",
});
