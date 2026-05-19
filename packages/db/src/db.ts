import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { dbConnectionString, drizzleConfig } from "../drizzle.config";
import { ENVIRONMENT } from "./config/env";
import * as schema from "./schema";

const connectionPool = new Pool({
	connectionString: dbConnectionString,
	max: ENVIRONMENT.DB_MIGRATING || ENVIRONMENT.DB_SEEDING ? 1 : undefined,
});

export const db = drizzle({
	casing: drizzleConfig.casing,
	client: connectionPool,
	logger: true,
	schema,
});
