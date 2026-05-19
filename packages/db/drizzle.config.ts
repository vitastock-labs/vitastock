import { defineConfig } from "drizzle-kit";
import { ENVIRONMENT } from "@/config/env";

export const dbConnectionString =
	ENVIRONMENT.NODE_ENV === "development" ? ENVIRONMENT.DATABASE_URL_DEV : ENVIRONMENT.DATABASE_URL;

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
