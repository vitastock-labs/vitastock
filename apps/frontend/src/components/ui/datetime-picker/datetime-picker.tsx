import { useControllableState } from "@zayne-labs/toolkit-react";
import type { InferProps } from "@zayne-labs/toolkit-react/utils";
import { isFunction } from "@zayne-labs/toolkit-type-helpers";
import { format } from "date-fns";
import { ForWithWrapper } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { cnJoin, cnMerge } from "@/lib/utils/cn";
import { Calendar, CalendarDayButton } from "../calender";
import { shadcnButtonVariants } from "../constants";
import * as Popover from "../popover";
import * as ScrollArea from "../scroll-area";
import { getDateFromString } from "./getDateFromString";

type OrderType = "ascending" | "descending" | "preserve" | ((resolvedRange: number[]) => number[]);

type TimeSettings = {
	hourOrder?: OrderType;
	hourRange?: number[];
	hourVariant?: "12-hour" | "24-hour";
	minuteOrder?: OrderType;
	minuteRange?: number[];
};

type DatePickerProps = {
	className?: string;
	dateFormats?: {
		onChangeDate?: string;
		visibleDate?: string;
	};
	datePickerProps?: Omit<InferProps<typeof Calendar>, "captionLayout" | "mode" | "onSelect" | "selected">;
	dateString?: string;
	defaultDateString?: string;
	onDateStringChange?: (dateString?: string) => void;
	placeholder?: string;
	timeSettings?: TimeSettings;

	variant?: "date" | "datetime" | "time";
};

export function DateTimePicker(props: DatePickerProps) {
	const {
		className,
		dateFormats,
		datePickerProps,
		dateString: dateStringProp,
		defaultDateString: defaultDateStringProp = "",
		onDateStringChange: onDateStringChangeProp,
		placeholder,
		timeSettings,
		variant = "date",
	} = props;

	const {
		classNames: calenderClassNames,
		components: calenderComponents,
		...restOfCalenderProps
	} = datePickerProps ?? {};

	const [dateString, setDateString] = useControllableState({
		defaultProp: defaultDateStringProp,
		isControlled: "dateString" in props,
		onChange: onDateStringChangeProp,
		prop: dateStringProp,
	});

	const date = getDateFromString(dateString);

	const showTimePicker = variant === "time" || variant === "datetime";

	const showDatePicker = variant === "date" || variant === "datetime";

	return (
		<Popover.Root>
			<Popover.Trigger asChild={true}>
				<button
					type="button"
					className={cnMerge(
						shadcnButtonVariants({ variant: "outline" }),
						"w-full justify-between text-[14px] font-medium text-black md:w-full",
						className
					)}
				>
					<span className={cnJoin(!date && "text-vitastock-body-color/70")}>
						{date ? format(date, dateFormats?.visibleDate ?? "PPP") : placeholder}
					</span>

					<IconBox icon="lucide:calendar-clock" className="size-5 text-vitastock-body-color" />
				</button>
			</Popover.Trigger>

			<Popover.Content className="flex w-fit rounded-[10px] p-0">
				{showDatePicker && (
					<Calendar
						mode="single"
						captionLayout="dropdown"
						classNames={{
							button_next: "hover:bg-vitastock-primary-subtle/60 hover:text-vitastock-primary-dark",
							button_previous:
								"hover:bg-vitastock-primary-subtle/60 hover:text-vitastock-primary-dark",
							today: "bg-vitastock-primary-subtle/60",

							...calenderClassNames,
						}}
						components={{
							// eslint-disable-next-line react/no-nested-component-definitions
							DayButton: (innerProps) => (
								<CalendarDayButton
									{...innerProps}
									className={cnMerge(
										`hover:bg-vitastock-primary-subtle/60 hover:text-vitastock-primary-dark
										data-[selected-single=true]:bg-vitastock-primary-main
										data-[selected-single=true]:text-white`,
										innerProps.className
									)}
								/>
							),

							...calenderComponents,
						}}
						selected={date}
						onSelect={(selectedDate) => {
							if (!selectedDate) return;

							setDateString(format(selectedDate, dateFormats?.onChangeDate ?? "dd-MM-yyyy"));
						}}
						{...restOfCalenderProps}
					/>
				)}

				{showTimePicker && (
					<TimePicker
						// eslint-disable-next-line react/purity
						dateValue={date ?? new Date()}
						onDateStringChange={setDateString as typeof onDateStringChangeProp}
						timeSettings={timeSettings}
						dateFormats={dateFormats}
					/>
				)}
			</Popover.Content>
		</Popover.Root>
	);
}

const resolve12HourVariant = (hour: number) => {
	const hour12 = hour % 12;

	return hour12 === 0 ? 12 : hour12;
};

const resolveOrder = (
	options:
		| (Required<Pick<TimeSettings, "hourOrder" | "hourRange">> & { type: "hour" })
		| (Required<Pick<TimeSettings, "minuteOrder" | "minuteRange">> & { type: "minute" })
) => {
	const { type } = options;

	const selectedOrder = type === "hour" ? options.hourOrder : options.minuteOrder;

	const selectedRange = type === "hour" ? options.hourRange : options.minuteRange;

	if (isFunction(selectedOrder)) {
		return selectedOrder(selectedRange);
	}

	switch (selectedOrder) {
		case "ascending": {
			return selectedRange.toSorted((a, b) => a - b);
		}

		case "descending": {
			return selectedRange.toSorted((a, b) => b - a);
		}

		case "preserve": {
			return selectedRange;
		}

		default: {
			selectedOrder satisfies never;
			throw new Error(`Invalid ${type} order: '${selectedOrder}'`);
		}
	}
};

type TimePickerProps = Pick<DatePickerProps, "dateFormats" | "onDateStringChange" | "timeSettings"> & {
	dateValue: Date;
};

function TimePicker(props: TimePickerProps) {
	const { dateFormats, dateValue, onDateStringChange, timeSettings } = props;

	const {
		hourOrder = "descending",
		hourVariant = "24-hour",
		minuteOrder = "preserve",
	} = timeSettings ?? {};

	const hourRange = timeSettings?.hourRange ?? [...Array(24).keys()];

	const minuteRange = timeSettings?.minuteRange ?? [...Array(60).keys()];

	function handleTimeChange(variant: "am-pm" | "hour" | "minute", value: number | string) {
		const newDate = new Date(dateValue);

		switch (variant) {
			case "am-pm": {
				const hours = newDate.getHours();

				if (value === "AM" && hours >= 12) {
					const modifiedHours = hours - 12;
					hourRange.includes(modifiedHours) && newDate.setHours(modifiedHours);
				}

				if (value === "PM" && hours < 12) {
					const modifiedHours = hours + 12;
					hourRange.includes(modifiedHours) && newDate.setHours(modifiedHours);
				}

				break;
			}

			case "hour": {
				const hourNumber = Number(value);

				if (hourVariant === "12-hour") {
					const isPM = newDate.getHours() >= 12;

					const hour24 = (hourNumber % 12) + (isPM ? 12 : 0);
					const oppositeHour24 = (hour24 + 12) % 24;

					hourRange.includes(hour24) ? newDate.setHours(hour24) : newDate.setHours(oppositeHour24);
					break;
				}

				newDate.setHours(hourNumber);

				break;
			}

			case "minute": {
				const minute = Number(value);

				newDate.setMinutes(minute);
				break;
			}

			default: {
				variant satisfies never;
			}
		}

		onDateStringChange?.(
			format(
				newDate,
				dateFormats?.onChangeDate
					?? (hourVariant === "12-hour" ? "dd-MM-yyyy - hh:mm aa" : "dd-MM-yyyy - HH:mm")
			)
		);
	}

	const resolvedHourRange =
		hourVariant === "12-hour" ?
			[...new Set(hourRange.map((hour) => resolve12HourVariant(hour)))]
		:	hourRange;

	const resolvedHours = resolveOrder({
		hourOrder,
		hourRange: resolvedHourRange,
		type: "hour",
	});

	const resolvedMinutes = resolveOrder({
		minuteOrder,
		minuteRange,
		type: "minute",
	});

	return (
		<div className="flex max-h-[300px] w-fit divide-x divide-shadcn-border">
			<ScrollArea.Root>
				<ForWithWrapper
					className="flex flex-col p-2"
					each={resolvedHours}
					renderItem={(hour) => (
						<button
							key={hour}
							type="button"
							data-selected={
								hourVariant === "12-hour" ?
									resolve12HourVariant(dateValue.getHours()) === hour
								:	dateValue.getHours() === hour
							}
							className={cnMerge(
								"aspect-square shrink-0",
								shadcnButtonVariants({ size: "icon", variant: "ghost" }),
								`hover:bg-vitastock-primary-subtle/60 hover:text-vitastock-primary-dark
								data-[selected=true]:bg-vitastock-primary-main
								data-[selected=true]:text-shadcn-primary-foreground`
							)}
							onClick={() => handleTimeChange("hour", hour)}
						>
							{hour}
						</button>
					)}
				/>
			</ScrollArea.Root>

			<ScrollArea.Root>
				<ForWithWrapper
					as="div"
					className="flex flex-col p-2"
					each={resolvedMinutes}
					renderItem={(minute) => (
						<button
							key={minute}
							type="button"
							data-selected={dateValue.getMinutes() === minute}
							className={cnMerge(
								"aspect-square shrink-0",
								shadcnButtonVariants({ size: "icon", variant: "ghost" }),
								`hover:bg-vitastock-primary-subtle/60 hover:text-vitastock-primary-dark
								data-[selected=true]:bg-vitastock-primary-main
								data-[selected=true]:text-shadcn-primary-foreground`
							)}
							onClick={() => handleTimeChange("minute", minute)}
						>
							{minute.toString().padStart(2, "0")}
						</button>
					)}
				/>
			</ScrollArea.Root>

			{hourVariant === "12-hour" && (
				<ScrollArea.Root>
					<ForWithWrapper
						as="div"
						className="flex flex-col p-2"
						each={["AM", "PM"]}
						renderItem={(am_pm) => (
							<button
								key={am_pm}
								type="button"
								data-selected={
									(am_pm === "AM" && dateValue.getHours() < 12)
									|| (am_pm === "PM" && dateValue.getHours() >= 12)
								}
								className={cnMerge(
									"aspect-square shrink-0",
									shadcnButtonVariants({ size: "icon", variant: "ghost" }),
									`hover:bg-vitastock-primary-subtle/60 hover:text-vitastock-primary-dark
									data-[selected=true]:bg-vitastock-primary-main
									data-[selected=true]:text-shadcn-primary-foreground`
								)}
								onClick={() => handleTimeChange("am-pm", am_pm)}
							>
								{am_pm}
							</button>
						)}
					/>
				</ScrollArea.Root>
			)}
		</div>
	);
}
