import { Client } from "pg";

export const keepDatabaseAlive = async (connectionString: string) => {
	const client = new Client({ connectionString });

	await client.connect();

	try {
		await client.query("select 1");
	} finally {
		await client.end();
	}
};
