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
	BREVO_API_KEY: z.string(),
	BULL_BOARD_PASSWORD: z.string().min(8),
	BULL_BOARD_USERNAME: z.string().min(3),
	DATABASE_URL: z.string(),
	DATABASE_URL_DEV: z
		.literal([
			"postgresql://postgres:postgres@localhost:5433/vitastock",
			"postgresql://postgres:postgres@localhost:5434/vitastock_test",
			"postgresql://postgres:postgres@vitastock-postgres-db:5432/vitastock",
			"postgresql://postgres:postgres@vitastock-postgres-test-db:5432/vitastock_test",
		])
		.default("postgresql://postgres:postgres@localhost:5433/vitastock"),
	DATABASE_URL_STAGING: z.string(),
	DB_MIGRATING: stringBoolean.default(false),
	DB_SEEDING: stringBoolean.default(false),
	EMAIL_APP_PASSWORD: z.string(),
	EMAIL_APP_PASSWORD_DEV: z.literal("YWdGtMC5WuvXFExr9P").default("YWdGtMC5WuvXFExr9P"),
	EMAIL_USER: z.email(),
	EMAIL_USER_DEV: z
		.literal("emilio.connelly70@ethereal.email")
		.default("emilio.connelly70@ethereal.email"),
	GOOGLE_AUTH_API_KEY: z.string(),
	GOOGLE_AUTH_REFRESH_TOKEN: z.string(),
	GOOGLE_CLIENT_ID: z.string(),
	GOOGLE_CLIENT_SECRET: z.string(),
	LOG_LEVEL: z.literal(["debug", "info", "warn", "error", "fatal", "silent"]).default("info"),
	PORT: z.coerce.number().default(8000),
	PROCESS_TYPE: z.literal(["api", "worker"]).default("api"),
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

export const databaseEnvSchema = backendEnvSchema.pick({
	DATABASE_URL: true,
	DATABASE_URL_DEV: true,
	DATABASE_URL_STAGING: true,
	DB_MIGRATING: true,
	DB_SEEDING: true,
	NODE_ENV: true,
});

export const databaseSeedEnvSchema = databaseEnvSchema.extend({
	SEED_PASSWORD: backendEnvSchema.shape.SEED_PASSWORD,
});

export const serviceKeepAliveEnvSchema = backendEnvSchema.pick({
	BREVO_API_KEY: true,
	REDIS_CACHE_URL: true,
	REDIS_QUEUE_URL: true,
});

const packageJson = findUpSync("pnpm-workspace.yaml", { cwd: import.meta.dirname });

const monorepoRoot = packageJson ? path.dirname(packageJson) : null;

const backendEnvFilePath = monorepoRoot ? path.resolve(monorepoRoot, "apps/backend/.env") : null;

backendEnvFilePath && existsSync(backendEnvFilePath) && process.loadEnvFile(backendEnvFilePath);

const parseEnvironment = <Schema extends z.ZodType>(schema: Schema): z.infer<Schema> => {
	// eslint-disable-next-line node/no-process-env
	const result = schema.safeParse(process.env);

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

export const getBackendEnv = () => parseEnvironment(backendEnvSchema);

export const getDatabaseEnv = () => parseEnvironment(databaseEnvSchema);

export const getDatabaseSeedEnv = () => parseEnvironment(databaseSeedEnvSchema);

export const getServiceKeepAliveEnv = () => parseEnvironment(serviceKeepAliveEnvSchema);
