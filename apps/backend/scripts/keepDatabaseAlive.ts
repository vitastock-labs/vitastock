import "@colors/colors";
import { keepDatabaseAlive } from "@vitastock/db/keepAlive";
import { getDatabaseKeepAliveEnv } from "@vitastock/env/backend";
import { consola } from "consola";

const environment = getDatabaseKeepAliveEnv();

try {
	await Promise.all([
		keepDatabaseAlive(environment.DATABASE_URL),
		keepDatabaseAlive(environment.DATABASE_URL_STAGING),
	]);

	// eslint-disable-next-line unicorn/no-nonstandard-builtin-properties
	consola.success("Database keepalive completed successfully!".green.italic);
} catch (error) {
	consola.error(new Error("Database keepalive failed", { cause: error }));
	process.exitCode = 1;
}
