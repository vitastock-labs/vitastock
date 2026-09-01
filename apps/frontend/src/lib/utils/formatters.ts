import { tz } from "@date-fns/tz";
import { format, parseISO } from "date-fns";

const nairaFormatter = new Intl.NumberFormat("en-NG", {
	currency: "NGN",
	style: "currency",
});

export const formatDate = (date: string | Date) => {
	return format(typeof date === "string" ? parseISO(date) : date, "d MMM yyyy");
};

export const formatDateTime = (date: Date) => {
	return format(date, "d MMM yyyy, hh:mm a");
};

export const formatCalendarDateInTimezone = (date: Date, timezone: string) => {
	return format(date, "yyyy-MM-dd", { in: tz(timezone) });
};

export const formatKoboAsNaira = (amountInKobo: number) => {
	return nairaFormatter.format(amountInKobo / 100);
};

export const formatUncostedBatchCount = (count: number) => {
	if (count === 0) {
		return "All active batches have recorded costs";
	}

	if (count === 1) {
		return "1 active batch has no recorded cost";
	}

	return `${count} active batches have no recorded cost`;
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
