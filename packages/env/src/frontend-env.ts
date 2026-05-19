import { z } from "zod";
import { sharedEnvSchema } from "./shared-env";

export const frontendEnvSchema = sharedEnvSchema;

export const getFrontendEnv = () => {
	// eslint-disable-next-line node/no-process-env
	const result = frontendEnvSchema.safeParse(process.env);

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
