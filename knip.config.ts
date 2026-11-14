import { zayne } from "@zayne-labs/knip-config";

export default zayne({
	extend: {
		ignoreExportsUsedInFile: true,
		workspaces: {
			"apps/backend": {
				ignoreDependencies: ["@zayne-labs/tsconfig!"],
				ignoreIssues: {
					"src/app/auth/services/utils/hash.ts": ["exports"],
					"src/lib/logger/appLogger.ts": ["types"],
					"src/lib/utils/random.ts": ["exports"],
				},
				// == Maintenance scripts run through package scripts, test fixtures are only imported by tests,
				// == and oauth2 is a WIP module not yet wired into active routes
				project: [
					"**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}!",
					"!scripts/**!",
					"!src/test/**!",
					"!src/lib/oauth2/**",
				],
			},

			"apps/frontend": {
				entry: [
					// == Loaded by name by the `@monicon/vite` plugin, not imported
					"monicon.config.ts",
					// == Linked from `index.html` as stylesheets, not imported
					"tailwind.css!",
					"src/preloader.css!",
					"src/assets/css/fonts.css!",
				],

				// == Vendored UI primitives keep their full compound-part surface, used or not
				ignoreIssues: {
					"src/components/animated/**": ["exports", "types"],
					"src/components/common/Image.tsx": ["exports"],
					"src/components/ui/**": ["exports", "types"],
					"src/lib/api/callBackendApi/apiSchema.ts": ["exports"],
					"src/lib/api/callBackendApi/plugins/utils/session.ts": ["exports"],
					"src/lib/react-query/queryOptions.ts": ["types"],
				},

				// == Exclude generated icon output, build-only icon generator, legacy icons, and unused alternative radix tooltip
				project: ["**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx,css}!", "!.monicon/**", "!monicon-config/**"],
			},

			"packages/transactional": {
				// == Email templates are entry points rendered by email transport and the preview server
				entry: ["emails/*.tsx"],
				// == `@react-email/ui` is resolved by Knip's react-email plugin, not imported directly
				ignoreDependencies: ["tailwindcss", "@react-email/ui"],
				ignoreIssues: {
					"emails/**": ["duplicates"],
					"src/components/**": ["exports"],
					"src/layouts/**": ["exports"],
				},
			},
		},
	},
});
