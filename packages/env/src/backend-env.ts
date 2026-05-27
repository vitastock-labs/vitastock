import { existsSync } from "node:fs";
import path from "node:path";
import { consola } from "consola";
import { findUpSync } from "find-up-simple";
import { z } from "zod";
import { sharedEnvSchema } from "./shared-env";
import { evaluateString } from "./utils/common";

const stringBoolean = z.stringbool({ falsy: ["false"], truthy: ["true"] });

export const backendEnvSchema = z.object({
	...sharedEnvSchema.shape,
	ACCESS_JWT_EXPIRES_IN: z.string().transform((value) => evaluateString<number>(value)),
	ACCESS_SECRET: z.string(),
	DATABASE_URL: z.string(),
	DATABASE_URL_DEV: z
		.literal([
			"postgresql://postgres:postgres@localhost:5433/vitastock",
			"postgresql://postgres:postgres@vitastock-postgres-db:5432/vitastock",
		])
		.default("postgresql://postgres:postgres@localhost:5433/vitastock"),
	DB_MIGRATING: stringBoolean.default(false),
	DB_SEEDING: stringBoolean.default(false),
	EMAIL_APP_PASSWORD: z.string(),
	EMAIL_APP_PASSWORD_DEV: z.literal("YWdGtMC5WuvXFExr9P").default("YWdGtMC5WuvXFExr9P"),
	EMAIL_USER: z.email(),
	EMAIL_USER_DEV: z
		.literal("emilio.connelly70@ethereal.email")
		.default("emilio.connelly70@ethereal.email"),
	LOG_LEVEL: z.literal(["debug", "info", "warn", "error", "fatal", "silent"]).default("info"),
	NODE_ENV: z.literal(["development", "production"]).default("development"),
	PORT: z.coerce.number().default(8000),
	REDIS_CACHE_URL: z.url(),
	REDIS_CACHE_URL_DEV: z
		.literal(["redis://localhost:6381", "redis://vitastock-redis-cache:6379"])
		.default("redis://localhost:6381"),
	REDIS_QUEUE_URL: z.url(),
	REDIS_QUEUE_URL_DEV: z
		.literal(["redis://localhost:6382", "redis://vitastock-redis-queue:6379"])
		.default("redis://localhost:6382"),
	REFRESH_JWT_EXPIRES_IN: z.string().transform((value) => evaluateString<number>(value)),
	REFRESH_SECRET: z.string(),
	SEED_PASSWORD: z.string(),
});

const packageJson = findUpSync("pnpm-workspace.yaml", { cwd: import.meta.dirname });

const monorepoRoot = packageJson ? path.dirname(packageJson) : null;

const backendEnvFilePath = monorepoRoot ? path.resolve(monorepoRoot, "apps/backend/.env") : null;

backendEnvFilePath && existsSync(backendEnvFilePath) && process.loadEnvFile(backendEnvFilePath);

export const getBackendEnv = () => {
	// eslint-disable-next-line node/no-process-env
	const result = backendEnvSchema.safeParse(process.env);

	if (!result.success) {
		const missingKeys = Object.keys(z.flattenError(result.error).fieldErrors);

		const errorMessage = `Missing required environment variable(s):\n → ${missingKeys.join("\n → ")}`;

		const error = new Error(errorMessage, { cause: z.flattenError(result.error).fieldErrors });

		error.stack = "";

		consola.error(error);

		throw error;
	}

	return result.data;
};
