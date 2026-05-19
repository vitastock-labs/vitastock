import type { NotFoundHandler } from "hono";
import { AppError } from "@/lib/utils";

const notFoundHandler: NotFoundHandler = (ctx) => {
	const message = `No '${ctx.req.method.toUpperCase()}' handler defined for '${ctx.req.path}'. Check the API documentation for more details.`;

	throw new AppError({ code: 404, message });
};

export { notFoundHandler };
