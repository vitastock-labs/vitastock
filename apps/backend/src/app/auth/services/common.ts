import type { SelectUserType } from "@vitastock/db/schema/auth";
import { pickKeys } from "@zayne-labs/toolkit-core";
import { necessaryUserDetails } from "./constants";

export const getNecessaryUserDetails = <const TKeys extends Array<keyof SelectUserType> = []>(
	user: SelectUserType,
	keys: TKeys = [] as never
) => {
	return pickKeys(user, [...necessaryUserDetails, ...keys] as const);
};
