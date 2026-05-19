import { emailQueue } from "../emailQueue";

export const createBullBoardSetup = async () => {
	const [{ createBullBoard }, { BullMQAdapter }, { HonoAdapter }, { serveStatic }] = await Promise.all([
		import("@bull-board/api"),
		import("@bull-board/api/bullMQAdapter"),
		import("@bull-board/hono"),
		import("@hono/node-server/serve-static"),
	]);

	const baseQueuesPath = "/api/v1/queues" as const;

	const queuesServerAdapter = new HonoAdapter(serveStatic).setBasePath(baseQueuesPath);

	createBullBoard({
		queues: [new BullMQAdapter(emailQueue)],
		serverAdapter: queuesServerAdapter,
	});

	return {
		baseQueuesPath,
		queuesServerAdapter,
	};
};
