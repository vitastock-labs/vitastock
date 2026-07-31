import { format } from "date-fns";

const nairaFormatter = new Intl.NumberFormat("en-NG", {
	currency: "NGN",
	style: "currency",
});

const formatDate = (date: Date) => {
	return format(date, "d MMM yyyy");
};

const formatDateTime = (date: Date) => {
	return format(date, "d MMM yyyy, hh:mm a");
};

const formatKoboAsNaira = (amountInKobo: number) => {
	return nairaFormatter.format(amountInKobo / 100);
};

const formatEnumLabel = (value: string) => {
	return value
		.split("_")
		.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
		.join(" ");
};

export { formatDate, formatDateTime, formatEnumLabel, formatKoboAsNaira };
