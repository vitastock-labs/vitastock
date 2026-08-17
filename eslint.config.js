import { zayne } from "@zayne-labs/eslint-config";

export default zayne(
	{
		ignores: ["eslint.config.js", "apps/frontend/.monicon/**", "packages/db/src/migrations/**/*"],
		type: "app-strict",
		comments: {
			overrides: {
				"eslint-comments/require-description": "off",
			},
		},
		node: {
			security: true,
		},
		react: true,
		tailwindcssBetter: {
			settings: { entryPoint: "apps/frontend/tailwind.css" },
		},
		tanstack: {
			query: true,
		},
		typescript: {
			tsconfigPath: ["**/tsconfig.json"],
		},
	},
	// {
	// 	files: ["apps/frontend/src/pages/**/*.ts", "apps/frontend/src/pages/**/*.tsx"],
	// 	rules: {
	// 		"@stylistic/padding-line-between-statements": [
	// 			"error",
	// 			{ blankLine: "always", next: "*", prev: ["const", "let"] },
	// 			{ blankLine: "always", next: "*", prev: ["expression", "return", "throw"] },
	// 		],
	// 	},
	// },
	{
		files: [
			"apps/backend/**/*.{ts,tsx}",
			"apps/frontend/src/pages/**/*.{ts,tsx}",
			"packages/**/*.{ts,tsx}",
		],
		rules: {
			"no-restricted-syntax": [
				"error",
				{
					selector:
						'IfStatement[consequent.type!="BlockStatement"]:not([consequent.type="ReturnStatement"][consequent.argument=null]):not([consequent.type="BreakStatement"]):not([consequent.type="ContinueStatement"])',
					message:
						"Only an empty return, break, or continue guard may use an unbraced if statement. Wrap every other if body in braces.",
				},
			],
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
