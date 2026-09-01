import type { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { secureHeaders } from "hono/secure-headers";
import { inventoryAlertQueue } from "@/app/inventory/services/alertQueue";
import { ENVIRONMENT } from "@/config/env";
import { bullBoardSecureHeadersOptions } from "@/config/secureHeadersOptions";
import type { HonoAppBindings } from "@/lib/types/common";
import { emailQueue } from "../emailQueue";

const BULL_BOARD_BASE_PATH = "/admin/queues" as const;

export const mountBullBoard = async (app: Hono<HonoAppBindings>) => {
	const [{ createBullBoard }, { BullMQAdapter }, { HonoAdapter }, { serveStatic }] = await Promise.all([
		import("@bull-board/api"),
		import("@bull-board/api/bullMQAdapter"),
		import("@bull-board/hono"),
		import("@hono/node-server/serve-static"),
	]);

	const queuesServerAdapter = new HonoAdapter(serveStatic).setBasePath(BULL_BOARD_BASE_PATH);

	createBullBoard({
		queues: [new BullMQAdapter(emailQueue), new BullMQAdapter(inventoryAlertQueue)],
		serverAdapter: queuesServerAdapter,
	});

	const bullBoardAuthMiddleware = basicAuth({
		realm: "VitaStock Queue Administration",
		verifyUser: (username, password) => {
			return (
				username === ENVIRONMENT.BULL_BOARD_USERNAME && password === ENVIRONMENT.BULL_BOARD_PASSWORD
			);
		},
	});

	app.use(BULL_BOARD_BASE_PATH, secureHeaders(bullBoardSecureHeadersOptions), bullBoardAuthMiddleware);
	app.use(
		`${BULL_BOARD_BASE_PATH}/*`,
		secureHeaders(bullBoardSecureHeadersOptions),
		bullBoardAuthMiddleware
	);

	app.route(BULL_BOARD_BASE_PATH, queuesServerAdapter.registerPlugin());
};
