import { defineConfig } from "drizzle-kit";
import { ENVIRONMENT } from "@/config/env";

const databaseUrls = {
	development: ENVIRONMENT.DATABASE_URL_DEV,
	production: ENVIRONMENT.DATABASE_URL,
	test: ENVIRONMENT.DATABASE_URL_TEST,
} satisfies Record<typeof ENVIRONMENT.NODE_ENV, string>;

export const dbConnectionString = databaseUrls[ENVIRONMENT.NODE_ENV];

export const drizzleConfig = defineConfig({
	casing: "snake_case",
	dbCredentials: {
		url: dbConnectionString,
	},
	dialect: "postgresql",
	out: "./src/migrations",
	schema: "./src/schema",
});

export default drizzleConfig;
