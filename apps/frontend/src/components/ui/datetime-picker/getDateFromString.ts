const getDateFromString = (dateString: string) => {
	if (dateString === "") return;

	const date = new Date(dateString);

	if (Number.isNaN(date.getTime())) {
		console.warn(`Invalid date string '${dateString}', returning undefined`);

		return;
	}

	return date;
};

export { getDateFromString };
