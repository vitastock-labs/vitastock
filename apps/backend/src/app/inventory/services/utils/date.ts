import { tz, TZDateMini } from "@date-fns/tz";
import { addDays, format } from "date-fns";

const getWorkspaceStartOfDay = (date: string, timezone: string) => {
	const [year = 0, month = 0, day = 0] = date.split("-").map(Number);

	return TZDateMini.tz(timezone, year, month - 1, day);
};

export const getWorkspaceDateRange = (options: { from?: string; timezone: string; to?: string }) => {
	const { from, timezone, to } = options;

	return {
		from: from ? getWorkspaceStartOfDay(from, timezone) : undefined,
		toExclusive: to ? addDays(getWorkspaceStartOfDay(to, timezone), 1) : undefined,
	};
};

export const getWorkspaceInventoryDates = (options: {
	date?: Date;
	nearExpiryDays: number;
	timezone: string;
}) => {
	const { date = new Date(), nearExpiryDays, timezone } = options;
	const dateContext = { in: tz(timezone) };

	return {
		nearExpiryDate: format(addDays(date, nearExpiryDays, dateContext), "yyyy-MM-dd", dateContext),
		today: format(date, "yyyy-MM-dd", dateContext),
	};
};

export const getWorkspaceToday = (timezone: string, date = new Date()) => {
	return format(date, "yyyy-MM-dd", { in: tz(timezone) });
};

export const getWorkspaceDateAndHour = (date: Date, timezone: string) => {
	const dateContext = { in: tz(timezone) };

	return {
		date: format(date, "yyyy-MM-dd", dateContext),
		hour: format(date, "HH", dateContext),
	};
};
