import type { ValidationTargets } from "hono";
import { validator } from "hono/validator";
import type { z } from "zod";
import { getValidatedValue } from "@/lib/utils";

export const validateWithZodMiddleware = <
	TTarget extends keyof ValidationTargets,
	TSchema extends z.ZodType,
>(
	target: TTarget,
	schema: TSchema
) => {
	return validator(target, (value) => {
		const validatedValue = getValidatedValue(value, schema, { schemaTarget: target });

		return validatedValue;
	});
};
