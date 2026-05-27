import type { MoniconConfig } from "@monicon/core";
import { iconsGenPlugin } from "./monicon-config/iconsGenPlugin.ts";

export default {
	icons: getIconsArray(),
	plugins: [iconsGenPlugin({ outputPath: ".monicon" })],
} satisfies MoniconConfig;

function getIconsArray() {
	return [
		"radix-icons:chevron-down",
		"lucide:chevron-down",
		"lucide:chevron-up",
		"lucide:check",
		"lucide:circle-check",
		"lucide:chevron-down",
		"radix-icons:dash",
		"radix-icons:dot-filled",
		"radix-icons:chevron-right",
		"lucide:panel-left",
		"lucide:x",
		"lucide:arrow-left",
		"lucide:arrow-right",
		"radix-icons:check",
		"lucide:chevron-left",
		"lucide:chevron-right",
		"lucide:chevrons-up-down",
		"lucide:search",
		"lucide:bell",
		"lucide:user",
		"lucide:users-round",
		"lucide:plus",
		"lucide:circle",
		"lucide:refresh-cw",
		"devicon:google",
		"mingcute:check-circle-fill",
		"material-symbols:mail",
		"material-symbols:troubleshoot",
		"streamline:padlock-square-1-solid",
		"material-symbols:dashboard-outline-rounded",
		"material-symbols:dashboard-rounded",
		"material-symbols:inventory-2-outline-rounded",
		"material-symbols:inventory-2-rounded",
		"mdi:chart-box-outline",
		"mdi:chart-box",
		"material-symbols:warning-outline",
		"material-symbols:warning-rounded",
		"material-symbols:settings-outline-rounded",
		"material-symbols:settings-rounded",
		"material-symbols:error-outline-rounded",
		"lucide:send-horizontal",
	];
}
