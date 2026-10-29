import { db } from "@vitastock/db";
import { workspaces } from "@vitastock/db/schema/workspace";
import { eq } from "drizzle-orm";
import { expect, test, vi } from "vitest";
import { addEmailToQueue } from "@/services/queues/emailQueue";
import { createInventoryFixture, type InventoryFixture } from "@/test/inventoryFixture";
import { queueDueWeeklyOwnerReports, sendWeeklyOwnerReport } from "./weeklyReport";

vi.mock("@/services/queues/emailQueue", () => ({ addEmailToQueue: vi.fn() }));

// == Sunday 25 Oct 2026, 21:30 in Africa/Lagos (UTC+1); that week starts Monday 19 Oct
const SUNDAY_EVENING = new Date("2026-10-25T20:30:00Z");
const SUNDAY_AFTERNOON = new Date("2026-10-25T14:00:00Z");
const SATURDAY_EVENING = new Date("2026-10-24T20:30:00Z");

const getQueuedJobIds = (fixture: InventoryFixture) =>
	vi
		.mocked(addEmailToQueue)
		.mock.calls.map(([options]) => options.jobId)
		.filter((jobId) => jobId?.includes(fixture.workspace.id));

const getLastSentWeek = async (fixture: InventoryFixture) => {
	const [workspace] = await db
		.select({ weeklyEmailLastSentWeek: workspaces.weeklyEmailLastSentWeek })
		.from(workspaces)
		.where(eq(workspaces.id, fixture.workspace.id));

	return workspace?.weeklyEmailLastSentWeek;
};

test("Weekly report - queues one email per manager and claims the week once", async () => {
	await using fixture = await createInventoryFixture();

	await Promise.all([
		sendWeeklyOwnerReport({ now: SUNDAY_EVENING, workspace: fixture.workspace }),
		sendWeeklyOwnerReport({ now: SUNDAY_EVENING, workspace: fixture.workspace }),
	]);

	expect(getQueuedJobIds(fixture)).toEqual([
		`weekly-owner-report:${fixture.workspace.id}:2026-10-19:${fixture.user.email.toLowerCase()}`,
	]);
	expect(await getLastSentWeek(fixture)).toBe("2026-10-19");
});

test("Weekly report - waits for Sunday at the chosen time", async () => {
	await using fixture = await createInventoryFixture();

	await queueDueWeeklyOwnerReports(SATURDAY_EVENING);
	await queueDueWeeklyOwnerReports(SUNDAY_AFTERNOON);

	expect(getQueuedJobIds(fixture)).toEqual([]);
	expect(await getLastSentWeek(fixture)).toBeNull();

	await queueDueWeeklyOwnerReports(SUNDAY_EVENING);

	expect(getQueuedJobIds(fixture)).toHaveLength(1);
});

test("Weekly report - skips workspaces that turned the email off", async () => {
	await using fixture = await createInventoryFixture();

	await db
		.update(workspaces)
		.set({ weeklyEmailEnabled: false })
		.where(eq(workspaces.id, fixture.workspace.id));

	await queueDueWeeklyOwnerReports(SUNDAY_EVENING);

	expect(getQueuedJobIds(fixture)).toEqual([]);
	expect(await getLastSentWeek(fixture)).toBeNull();
});

test("Weekly report - releases the claim when queueing fails", async () => {
	await using fixture = await createInventoryFixture();

	vi.mocked(addEmailToQueue).mockRejectedValueOnce(new Error("Queue unavailable"));

	await expect(
		sendWeeklyOwnerReport({ now: SUNDAY_EVENING, workspace: fixture.workspace })
	).rejects.toThrow("Queue unavailable");
	expect(await getLastSentWeek(fixture)).toBeNull();
});
