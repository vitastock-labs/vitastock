import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	dts: true,
	entry: ["src/index.ts"],
	format: ["esm"],
	ignoreWatch: [".turbo"],
	platform: "neutral",
	target: "esnext",
	treeshake: true,
	tsconfig: "tsconfig.json",
});
