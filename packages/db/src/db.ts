import { consola } from "consola";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { dbConnectionString, drizzleConfig } from "../drizzle.config";
import { ENVIRONMENT } from "./config/env";
import * as schema from "./schema";

const connectionPool = new Pool({
	connectionString: dbConnectionString,
	max: ENVIRONMENT.DB_MIGRATING || ENVIRONMENT.DB_SEEDING ? 1 : undefined,
});

connectionPool.on("error", (error) => {
	consola.error("Unexpected PostgreSQL pool error", error);
});

export const db = drizzle({
	casing: drizzleConfig.casing,
	client: connectionPool,
	logger: ENVIRONMENT.NODE_ENV === "development",
	schema,
});

export const initializeDatabaseConnection = async () => {
	const client = await connectionPool.connect();

	client.release();
};

export const closeDatabaseConnection = async () => {
	await connectionPool.end();
};
