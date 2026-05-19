import type { BackendApiRouteKeys, BackendApiRoutes } from "@vitastock/shared/validation/backendApiSchema";
import type { CallApiSchema } from "@zayne-labs/callapi";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { getValidatedValue } from "./validation";

const AppJsonResponse = <
	TSchema extends Extract<BackendApiRoutes[BackendApiRouteKeys], Pick<CallApiSchema, "data">>["data"],
	TDataSchema extends TSchema["shape"]["data"],
>(
	ctx: Context,
	options: {
		code?: ContentfulStatusCode;
		data: z.infer<TDataSchema>;
		message: string;
		schema: TSchema;
	}
) => {
	const { code: statusCode = 200, data, message, schema } = options;

	const validatedData = getValidatedValue(data, schema.shape.data, {
		schemaTarget: "data",
	}) as z.infer<TDataSchema>;

	return ctx.json(
		{
			/* eslint-disable perfectionist/sort-objects */
			status: "success",
			message,
			data: validatedData,
			/* eslint-enable perfectionist/sort-objects */
		},
		statusCode
	);
};

export { AppJsonResponse };
