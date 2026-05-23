import { z } from "zod";
import { sharedEnvSchema } from "./shared-env";

export const frontendEnvSchema = sharedEnvSchema;

export const getFrontendEnv = () => {
	const result = frontendEnvSchema.safeParse({});

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
