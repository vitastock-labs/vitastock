import type { Awaitable } from "@zayne-labs/toolkit-type-helpers";
import type { TemplateLookupType } from "./lookup";

export type WithCommonFields<TObject extends Record<string, unknown>> = TObject & {
	priority?: "high" | "low";
	to: string;
};

type EmailJobOptionsBase = {
	[TKey in keyof TemplateLookupType]: {
		data: WithCommonFields<Parameters<TemplateLookupType[TKey]["template"]>[0]>;
		type: TKey;
	};
}[keyof TemplateLookupType];

type EmailJobHooks = {
	onError?: () => Awaitable<void>;
	onSuccess?: () => Awaitable<void>;
};

export type EmailJobOptions = EmailJobHooks & EmailJobOptionsBase;
