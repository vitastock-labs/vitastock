import { expect, test } from "vitest";
import { getWorkspaceDateRange, getWorkspaceInventoryDates } from "./date";

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

test("Workspace report date range - includes the complete local end date", () => {
	expect(
		getWorkspaceDateRange({
			from: "2026-09-05",
			timezone: "Africa/Lagos",
			to: "2026-09-05",
		})
	).toEqual({
		from: new Date("2026-09-04T23:00:00.000Z"),
		toExclusive: new Date("2026-09-05T23:00:00.000Z"),
	});

	expect(
		getWorkspaceDateRange({
			from: "2026-09-05",
			timezone: "America/New_York",
			to: "2026-09-05",
		})
	).toEqual({
		from: new Date("2026-09-05T04:00:00.000Z"),
		toExclusive: new Date("2026-09-06T04:00:00.000Z"),
	});
});
