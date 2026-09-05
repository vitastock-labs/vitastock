import { expect, test } from "vitest";
import { getWorkspaceInventoryDates } from "./date";

test("Workspace inventory date - follows the workspace calendar day", () => {
	const date = new Date("2026-01-01T00:30:00.000Z");

	expect(getWorkspaceInventoryDates({ date, nearExpiryDays: 30, timezone: "Africa/Lagos" })).toEqual({
		nearExpiryDate: "2026-01-31",
		today: "2026-01-01",
	});
	expect(getWorkspaceInventoryDates({ date, nearExpiryDays: 30, timezone: "America/New_York" })).toEqual({
		nearExpiryDate: "2026-01-30",
		today: "2025-12-31",
	});
});
