import type { SelectUserType } from "@vitastock/db/schema/auth";
import type { SelectWorkspaceType } from "@vitastock/db/schema/workspace";
import type { PinoLogger } from "hono-pino";

export type HonoAppBindings = {
	Variables: {
		currentUser: SelectUserType;
		currentWorkspace: SelectWorkspaceType;
		logger: PinoLogger;
		requestId: string;
	};
};
