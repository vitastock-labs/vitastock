import { tz } from "@date-fns/tz";
import { format, parseISO } from "date-fns";

export const formatDate = (date: string | Date) => {
	return format(typeof date === "string" ? parseISO(date) : date, "d MMM yyyy");
};

export const formatDateTime = (date: Date) => {
	return format(date, "d MMM yyyy, hh:mm a");
};

export const formatCalendarDateInTimezone = (date: Date, timezone: string) => {
	return format(date, "yyyy-MM-dd", { in: tz(timezone) });
};

export const formatDrugLabel = (
	drug: { genericName?: string | null; name: string; strength?: string | null },
	options: { includeGenericName?: boolean } = {}
) => {
	const { includeGenericName = false } = options;

	return [drug.name, includeGenericName && drug.genericName && `(${drug.genericName})`, drug.strength]
		.filter(Boolean)
		.join(" ");
};

export const formatEnumLabel = (value: string) => {
	return value
		.split("_")
		.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
		.join(" ");
};

const nairaFormatter = new Intl.NumberFormat("en-NG", {
	currency: "NGN",
	maximumFractionDigits: 2,
	minimumFractionDigits: 0,
	style: "currency",
});

export const formatNaira = (amount: number) => {
	return nairaFormatter.format(amount);
};

const compactNairaFormatter = new Intl.NumberFormat("en-NG", {
	currency: "NGN",
	maximumFractionDigits: 1,
	notation: "compact",
	style: "currency",
});

export const formatNairaCompact = (amount: number) => {
	return compactNairaFormatter.format(amount);
};
