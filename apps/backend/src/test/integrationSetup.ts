import { db } from "@vitastock/db";
import { afterAll } from "vitest";

// == Each integration test file gets its own module scope, so close its connection pool once it finishes
afterAll(async () => {
	await db.$client.end();
});
