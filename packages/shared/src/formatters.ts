const wholeNairaFormatter = new Intl.NumberFormat("en-NG", {
	currency: "NGN",
	maximumFractionDigits: 0,
	style: "currency",
});

export const formatWholeNaira = (amount: number) => {
	return wholeNairaFormatter.format(amount);
};
