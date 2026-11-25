import { defineInstanceConfig } from "@zayne-labs/callapi/utils";
import { callBackendApi, callBackendApiForQuery, type GlobalMeta } from "../../callBackendApi";

export const sessionDedupeOptions = defineInstanceConfig({
	dedupeKey: (ctx) => ctx.options.initURL,
	dedupeStrategy: "defer",
});

export const checkUserSessionForQuery = (options?: Pick<GlobalMeta, "auth" | "toast">) => {
	const { auth, toast } = options ?? {};

	return callBackendApiForQuery("@get/auth/session", {
		...sessionDedupeOptions,
		meta: { auth, toast: { success: false, ...toast } },
	});
};

export const checkUserSession = () => {
	return callBackendApi("@get/auth/session", {
		...sessionDedupeOptions,
		meta: { toast: { success: false } },
	});
};
