const getNameInitials = (name: string | null | undefined) => {
	if (!name) return;

	const initials = name
		.split(" ")
		.slice(0, 2)
		.map((namePart) => namePart[0]?.toUpperCase())
		.join("");

	return initials;
};

export { getNameInitials };
