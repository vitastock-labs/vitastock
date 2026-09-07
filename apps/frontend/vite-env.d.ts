/* eslint-disable ts-eslint/consistent-type-definitions */
/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly NODE_ENV: "development" | "production" | "staging";
	readonly VITE_POSTHOG_HOST?: string;
	readonly VITE_POSTHOG_KEY?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
