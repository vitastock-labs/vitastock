import { z } from "zod";
import { sharedEnvSchema } from "./shared-env";

export const frontendEnvSchema = sharedEnvSchema.extend({
	MODE: sharedEnvSchema.shape.NODE_ENV,
});

export const getFrontendEnv = () => {
	// NOTE - Due to Vite's build process, we can't use process.env.NODE_ENV directly, so we use import.meta.env.
	const result = frontendEnvSchema.safeParse(import.meta.env);

	if (!result.success) {
		const missingKeys = Object.keys(z.flattenError(result.error).fieldErrors);

		const errorMessage = `Missing required environment variable(s):\n → ${missingKeys.join("\n → ")}`;

		const error = new Error(errorMessage, { cause: z.flattenError(result.error).fieldErrors });

		error.stack = "";

		console.error(error);

		throw error;
	}

	return result.data;
};

declare global {
	// eslint-disable-next-line ts-eslint/consistent-type-definitions, ts-eslint/no-empty-object-type
	interface ImportMetaEnv extends Record<string, string> {}

	// eslint-disable-next-line ts-eslint/consistent-type-definitions
	interface ImportMeta {
		readonly env: ImportMetaEnv;
	}
}
