"use client";

import { css } from "@zayne-labs/toolkit-core";
import type { CssWithCustomProperties } from "@zayne-labs/toolkit-react/utils";
import { createContext, use, useId, useMemo } from "react";
import * as RechartsPrimitive from "recharts";
import { cnMerge } from "@/lib/utils/cn";

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { dark: ".dark", light: "" } as const;

const INITIAL_DIMENSION = { height: 200, width: 320 } as const;

export type ChartConfig = Record<
	string,
	{
		icon?: React.ComponentType;
		label?: React.ReactNode;
	} & (
		| {
				color?: never;
				theme: Record<keyof typeof THEMES, string>;
		  }
		| {
				color?: string;
				theme?: never;
		  }
	)
>;

type ChartContextProps = {
	config: ChartConfig;
};

const ChartContext = createContext<ChartContextProps | null>(null);

const useChart = () => {
	const context = use(ChartContext);

	if (!context) {
		throw new Error("useChart must be used within a <ChartContainer />");
	}

	return context;
};

function ChartContainer(
	props: Pick<React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>, "children" | "debounce">
		& React.ComponentProps<"div"> & {
			config: ChartConfig;
			initialDimension?: {
				height: number;
				width: number;
			};
		}
) {
	const {
		children,
		className,
		config,
		debounce = 180,
		id,
		initialDimension = INITIAL_DIMENSION,
		...restOfProps
	} = props;

	const uniqueId = useId();
	const chartId = `chart-${id ?? uniqueId.replaceAll(":", "")}`;

	const contextValue = useMemo(() => ({ config }), [config]);

	return (
		<ChartContext value={contextValue}>
			<div
				data-slot="chart-root"
				data-chart={chartId}
				className={cnMerge(
					`flex aspect-video w-full min-w-0 justify-center text-xs
					[&_.recharts-cartesian-axis-tick_text]:fill-shadcn-muted-foreground
					[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-shadcn-border/50
					[&_.recharts-curve.recharts-tooltip-cursor]:stroke-shadcn-border
					[&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden
					[&_.recharts-polar-grid_[stroke='#ccc']]:stroke-shadcn-border
					[&_.recharts-radial-bar-background-sector]:fill-shadcn-muted
					[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-shadcn-muted
					[&_.recharts-reference-line_[stroke='#ccc']]:stroke-shadcn-border
					[&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent
					[&_.recharts-surface]:outline-hidden`,
					className
				)}
				{...restOfProps}
			>
				<ChartStyle id={chartId} config={config} />

				<RechartsPrimitive.ResponsiveContainer debounce={debounce} initialDimension={initialDimension}>
					{children}
				</RechartsPrimitive.ResponsiveContainer>
			</div>
		</ChartContext>
	);
}

function ChartStyle(props: { config: ChartConfig; id: string }) {
	const { config, id } = props;

	const colorConfig = Object.entries(config).filter(
		({ 1: configItem }) => configItem.theme ?? configItem.color
	);

	if (colorConfig.length === 0) {
		return null;
	}

	const cssStringArray = Object.entries(THEMES).map(
		// eslint-disable-next-line react-hooks/todo
		([theme, prefix]) => css`
			${prefix} [data-chart=${id}] {
				${colorConfig
					.map(([key, configItem]) => {
						const color =
							configItem.theme?.[theme as keyof typeof configItem.theme] ?? configItem.color;

						return color ? `--color-${key}: ${color};` : null;
					})
					.join("\n")}
			}
		`
	);

	return <style>{cssStringArray.join("\n")}</style>;
}

const ChartTooltip = RechartsPrimitive.Tooltip;

function ChartTooltipContent(
	props: Omit<RechartsPrimitive.DefaultTooltipContentProps, "accessibilityLayer">
		& React.ComponentProps<"div">
		& React.ComponentProps<typeof RechartsPrimitive.Tooltip> & {
			hideIndicator?: boolean;
			hideLabel?: boolean;
			indicator?: "dashed" | "dot" | "line";
			labelKey?: string;
			nameKey?: string;
		}
) {
	const {
		active,
		className,
		color,
		formatter,
		hideIndicator = false,
		hideLabel = false,
		indicator = "dot",
		label,
		labelClassName,
		labelFormatter,
		labelKey,
		nameKey,
		payload,
	} = props;
	const { config } = useChart();

	const tooltipLabel = useMemo(() => {
		if (hideLabel || !payload || payload.length === 0) {
			return null;
		}

		const [item] = payload;

		const key = String(labelKey ?? item?.dataKey ?? item?.name ?? "value");

		const configItem = getConfigItemFromPayload(config, item, key);

		const value =
			!labelKey && typeof label === "string" ? (config[label]?.label ?? label) : configItem?.label;

		if (labelFormatter) {
			return (
				<div className={cnMerge("font-medium", labelClassName)}>{labelFormatter(value, payload)}</div>
			);
		}

		if (!value) {
			return null;
		}

		return <div className={cnMerge("font-medium", labelClassName)}>{value}</div>;
	}, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

	if (!active || !payload || payload.length === 0) {
		return null;
	}

	const nestLabel = payload.length === 1 && indicator !== "dot";

	return (
		<div
			className={cnMerge(
				`grid min-w-32 items-start gap-1.5 rounded-lg border border-shadcn-border/50
				bg-shadcn-background px-2.5 py-1.5 text-xs shadow-xl`,
				className
			)}
		>
			{!nestLabel ? tooltipLabel : null}

			<div className="grid gap-1.5">
				{payload
					.filter((item) => item.type !== "none")
					.map((item, index) => {
						const key = String(nameKey ?? item.name ?? item.dataKey ?? "value");
						const configItem = getConfigItemFromPayload(config, item, key);
						const indicatorColor =
							color ?? (item.payload as Record<string, string> | undefined)?.fill ?? item.color;

						return (
							<div
								key={key}
								className={cnMerge(
									`flex w-full flex-wrap items-stretch gap-2 [&>svg]:size-2.5
									[&>svg]:text-shadcn-muted-foreground`,
									indicator === "dot" && "items-center"
								)}
							>
								{formatter && item.value !== undefined && item.name ?
									// eslint-disable-next-line ts-eslint/no-unsafe-argument
									formatter(item.value, item.name, item, index, item.payload)
								:	<>
										{configItem?.icon ?
											<configItem.icon />
										:	!hideIndicator && (
												<div
													className={cnMerge(
														"shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)",
														indicator === "dot" && "size-2.5",
														nestLabel && indicator === "dashed" && "my-0.5",
														indicator === "dashed"
															&& "w-0 border-[1.5px] border-dashed bg-transparent",
														indicator === "line" && "w-1"
													)}
													style={
														{
															"--color-bg": indicatorColor as string,
															"--color-border": indicatorColor as string,
														} satisfies CssWithCustomProperties as CssWithCustomProperties
													}
												/>
											)
										}
										<div
											className={cnMerge(
												"flex flex-1 justify-between leading-none",
												nestLabel ? "items-end" : "items-center"
											)}
										>
											<div className="grid gap-1.5">
												{nestLabel ? tooltipLabel : null}
												<span className="text-shadcn-muted-foreground">
													{configItem?.label ?? item.name}
												</span>
											</div>
											{item.value != null && (
												<span
													className="font-mono font-medium text-shadcn-foreground
														tabular-nums"
												>
													{typeof item.value === "number" ?
														item.value.toLocaleString()
													:	String(item.value)}
												</span>
											)}
										</div>
									</>
								}
							</div>
						);
					})}
			</div>
		</div>
	);
}

const ChartLegend = RechartsPrimitive.Legend;

function ChartLegendContent(
	props: React.ComponentProps<"div">
		& RechartsPrimitive.DefaultLegendContentProps & {
			classNames?: {
				base?: string;
				legendItem?: string;
				legendItemIcon?: string;
				legendItemLabel?: string;
			};
			nameKey?: string;
			position?: React.ComponentProps<typeof RechartsPrimitive.Legend>["position"];
			renderItem?: (context: {
				configItem: ReturnType<typeof getConfigItemFromPayload>;
				index: number;
				payloadItem: RechartsPrimitive.LegendPayload;
			}) => React.ReactNode;
			withIcon?: boolean;
		}
) {
	const {
		className,
		classNames,
		nameKey,
		payload,
		position = "bottom",
		renderItem,
		withIcon = true,
	} = props;

	const { config } = useChart();

	if (!payload?.length) {
		return null;
	}

	return (
		<div
			className={cnMerge(
				"flex items-center justify-center gap-4",
				typeof position === "string" && (position === "top" || position.includes("Top")) ?
					"pb-3"
				:	"pt-3",
				className,
				classNames?.base
			)}
		>
			{payload
				.filter((item) => item.type !== "none")
				.map((item, index) => {
					const key = String(nameKey ?? item.dataKey ?? "value");
					const configItem = getConfigItemFromPayload(config, item, key);

					if (renderItem) {
						return renderItem({
							configItem,
							index,
							payloadItem: item,
						});
					}

					return (
						<div
							key={key}
							className={cnMerge(
								"flex items-center gap-1.5 [&>svg]:size-3 [&>svg]:text-shadcn-muted-foreground",
								classNames?.legendItem
							)}
						>
							{configItem?.icon && withIcon ?
								<configItem.icon />
							:	<div
									className="size-2 shrink-0 rounded-[2px]"
									style={{
										backgroundColor: item.color,
									}}
								/>
							}
							{configItem?.label}
						</div>
					);
				})}
		</div>
	);
}

const getConfigItemFromPayload = (config: ChartConfig, payload: unknown, key: string) => {
	if (typeof payload !== "object" || payload === null) {
		return;
	}

	const payloadPayload =
		"payload" in payload && typeof payload.payload === "object" && payload.payload !== null ?
			payload.payload
		:	null;

	let configLabelKey = key;

	if (key in payload && typeof payload[key as never] === "string") {
		configLabelKey = payload[key as never];
	}

	if (payloadPayload && key in payloadPayload && typeof payloadPayload[key as never] === "string") {
		configLabelKey = payloadPayload[key as never];
	}

	return configLabelKey in config ? config[configLabelKey] : config[key];
};

export {
	ChartContainer as Container,
	// eslint-disable-next-line react-refresh/only-export-components
	ChartLegend as Legend,
	ChartLegendContent as LegendContent,
	ChartStyle as Style,
	// eslint-disable-next-line react-refresh/only-export-components
	ChartTooltip as Tooltip,
	ChartTooltipContent as TooltipContent,
};
