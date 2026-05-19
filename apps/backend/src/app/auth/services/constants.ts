import type { SelectUserType } from "@vitastock/db/schema/auth";
import { defineEnum } from "@zayne-labs/toolkit-type-helpers";

export const necessaryUserDetails = defineEnum([
	"id",
	"firstName",
	"lastName",
	"fullName",
	"email",
	"role",
	"workspaceId",
] satisfies Array<keyof SelectUserType>);
