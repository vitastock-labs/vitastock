import { STOCK_LOG_TYPES } from "@vitastock/db/schema/inventory";
import { defineEnum } from "@zayne-labs/toolkit-type-helpers";

export const STOCK_ADDITION_LOG_TYPES = defineEnum([STOCK_LOG_TYPES[2], STOCK_LOG_TYPES[4]]);

export const STOCK_OUT_LOG_TYPES = defineEnum([STOCK_LOG_TYPES[5]]);

export const STOCK_MOVEMENT_LOG_TYPES = defineEnum([STOCK_LOG_TYPES[4], STOCK_LOG_TYPES[5]]);

export const STOCK_REDUCTION_LOG_TYPES = defineEnum([
	STOCK_LOG_TYPES[0],
	STOCK_LOG_TYPES[1],
	STOCK_LOG_TYPES[5],
]);
