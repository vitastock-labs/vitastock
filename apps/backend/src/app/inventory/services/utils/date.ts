import { tz } from "@date-fns/tz";
import { addDays, format } from "date-fns";

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
