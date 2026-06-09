import { AsyncLocalStorage } from "node:async_hooks";
import type { Context } from "hono";
import type { HonoAppBindings } from "@/lib/types/common";

type RequestContext = {
	honoCtx: Context<HonoAppBindings>;
};

const store = new AsyncLocalStorage<RequestContext>();

export const requestContext = {
	get: () => {
		const context = store.getStore();

		if (!context) {
			throw new ReferenceError("Accessed outside of the run context.");
		}

		return context;
	},
	run: <TResult>(context: RequestContext, fn: () => TResult) => store.run(context, fn),
};
