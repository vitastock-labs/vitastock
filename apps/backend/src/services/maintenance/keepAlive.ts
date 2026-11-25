import { BrevoClient } from "@getbrevo/brevo";

const keepBrevoAlive = async (apiKey: string) => {
	const brevo = new BrevoClient({ apiKey });

	await brevo.account.getAccount();
};

type RedisKeepAliveClient = {
	ping: () => Promise<unknown>;
};

const keepRedisAlive = async (redisClient: RedisKeepAliveClient) => {
	await redisClient.ping();
};

export const keepServicesAlive = async (options: {
	brevoApiKey: string;
	redisClients: RedisKeepAliveClient[];
}) => {
	const { brevoApiKey, redisClients } = options;

	await Promise.all([
		keepBrevoAlive(brevoApiKey),
		...redisClients.map((redisClient) => keepRedisAlive(redisClient)),
	]);
};
