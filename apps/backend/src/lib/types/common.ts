import type {
	SessionMembershipType,
	SessionUserType,
	SessionWorkspaceType,
} from "@vitastock/db/schema/auth";
import type { PinoLogger } from "hono-pino";

export type HonoAppBindings = {
	Variables: {
		currentMembership: SessionMembershipType;
		currentUser: SessionUserType;
		currentWorkspace: SessionWorkspaceType;
		logger: PinoLogger | undefined;
		requestId: string;
		requestStartedAt: number;
	};
};
