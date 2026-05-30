/* eslint-disable react-you-might-not-need-an-effect/no-reset-all-state-on-prop-change */
/* eslint-disable react/set-state-in-effect */
/* eslint-disable react-you-might-not-need-an-effect/no-derived-state */
/* eslint-disable react-hooks/no-deriving-state-in-effects */
/* eslint-disable react/no-unstable-default-props */
"use client";

import { createCustomContext, useControllableState } from "@zayne-labs/toolkit-react";
import { AnimatePresence, motion, type HTMLMotionProps } from "motion/react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useEffect, useMemo, useState } from "react";

type RadioGroupContextType = {
	setValue: (value: string) => void;
	value: string;
};

type RadioGroupItemContextType = {
	isChecked: boolean;
	setIsChecked: (isChecked: boolean) => void;
};

const [RadioGroupContextProvider, useRadioGroupContext] = createCustomContext<RadioGroupContextType>({
	name: "RadioGroupContext",
});

const [RadioGroupItemContextProvider, useRadioGroupItemContext] =
	createCustomContext<RadioGroupItemContextType>({
		name: "RadioGroupItemContext",
	});

type RadioGroupProps = React.ComponentProps<typeof RadioGroupPrimitive.Root>;

function RadioGroupRoot(props: RadioGroupProps) {
	const {
		defaultValue: defaultValueProp,
		onValueChange: onValueChangeProp,
		value: valueProp,
		...restOfProps
	} = props;

	const [value, setValue] = useControllableState({
		defaultProp: defaultValueProp,
		onChange: onValueChangeProp,
		prop: valueProp ?? undefined,
	});

	const contextValue = useMemo(() => ({ setValue, value }), [setValue, value]);

	return (
		<RadioGroupContextProvider value={contextValue}>
			<RadioGroupPrimitive.Root
				data-slot="radio-group-root"
				value={value}
				onValueChange={setValue}
				{...restOfProps}
			/>
		</RadioGroupContextProvider>
	);
}

type RadioGroupIndicatorProps = HTMLMotionProps<"div">
	& Omit<React.ComponentProps<typeof RadioGroupPrimitive.Indicator>, "asChild" | "forceMount">;

function RadioGroupIndicator(props: RadioGroupIndicatorProps) {
	const { transition = { damping: 16, stiffness: 200, type: "spring" }, ...restOfProps } = props;
	const { isChecked } = useRadioGroupItemContext();

	return (
		<AnimatePresence>
			{isChecked && (
				<RadioGroupPrimitive.Indicator
					data-slot="radio-group-indicator"
					asChild={true}
					forceMount={true}
				>
					<motion.div
						key="radio-group-indicator-circle"
						data-slot="radio-group-indicator-circle"
						initial={{ opacity: 0, scale: 0 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0 }}
						transition={transition}
						{...restOfProps}
					/>
				</RadioGroupPrimitive.Indicator>
			)}
		</AnimatePresence>
	);
}

type RadioGroupItemProps = HTMLMotionProps<"button">
	& Omit<React.ComponentProps<typeof RadioGroupPrimitive.Item>, "asChild">;

function RadioGroupItem(props: RadioGroupItemProps) {
	const { disabled, required, value: valueProp, ...restOfProps } = props;

	const { value } = useRadioGroupContext();
	const [isChecked, setIsChecked] = useState(value === valueProp);

	useEffect(() => {
		setIsChecked(value === valueProp);
	}, [value, valueProp]);

	const contextValue = useMemo(() => ({ isChecked, setIsChecked }), [isChecked, setIsChecked]);

	return (
		<RadioGroupItemContextProvider value={contextValue}>
			<RadioGroupPrimitive.Item
				asChild={true}
				value={valueProp}
				disabled={disabled}
				required={required}
			>
				<motion.button
					data-slot="radio-group-item"
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
					{...restOfProps}
				/>
			</RadioGroupPrimitive.Item>
		</RadioGroupItemContextProvider>
	);
}

export {
	RadioGroupRoot as Root,
	RadioGroupItem as Item,
	RadioGroupIndicator as Indicator,
	// eslint-disable-next-line react-refresh/only-export-components
	useRadioGroupContext,
	// eslint-disable-next-line react-refresh/only-export-components
	useRadioGroupItemContext,
};
