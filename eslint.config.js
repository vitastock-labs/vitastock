import { zayne } from "@zayne-labs/eslint-config";

export default zayne(
	{
		ignores: [
			".next/**",
			"eslint.config.js",
			"apps/frontend/next-env.d.ts",
			"apps/frontend/.monicon/**",
			"packages/db/src/migrations/**/*",
			"packages/transactional/**",
		],
		type: "app-strict",
		comments: {
			overrides: {
				"eslint-comments/require-description": "off",
			},
		},
		node: {
			security: true,
		},
		react: {
			nextjs: {
				overrides: {
					"nextjs/no-html-link-for-pages": ["error", "apps/frontend"],
				},
			},
		},
		tailwindcssBetter: {
			settings: { entryPoint: "apps/frontend/tailwind.css" },
		},
		tanstack: {
			query: true,
		},
		typescript: {
			tsconfigPath: ["packages/*/tsconfig.json", "apps/*/tsconfig.json"],
		},
	},
	{
		files: ["apps/frontend/**/*.ts"],
		rules: { "node/no-process-env": "off" },
	},
	{
		files: ["apps/backend/testing.ts"],
		rules: { "unicorn/no-empty-file": "off" },
	},
	{
		files: ["apps/backend/src/**/*"],
		rules: { "security/detect-object-injection": "off" },
	}
).overrides({
	"zayne/node/security/recommended": (config) => ({
		...config,
		files: ["apps/backend/src/**/*.ts"],
	}),
});
