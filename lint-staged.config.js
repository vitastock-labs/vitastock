export default {
	"*.{ts,tsx,_parallel-1_}": () => "pnpm lint:type-check",
	"*.{ts,tsx,_parallel-2_}": () => "pnpm lint:eslint:root",
	"*.{ts,tsx,_parallel-3_}": () => "pnpm test",
	"*.{ts,tsx,json,_parallel-1_}": () => "pnpm lint:knip",
	"*.{ts,tsx,json,_parallel-2_}": () => "pnpm lint:knip:production",
};
