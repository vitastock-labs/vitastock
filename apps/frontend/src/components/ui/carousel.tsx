/* eslint-disable react-you-might-not-need-an-effect/no-external-store-subscription */
/* eslint-disable react-you-might-not-need-an-effect/no-pass-data-to-parent */
/* eslint-disable react-you-might-not-need-an-effect/no-event-handler */
"use client";

import { createCustomContext, useCallbackRef } from "@zayne-labs/toolkit-react";
import type { DiscriminatedRenderProps } from "@zayne-labs/toolkit-react/utils";
import type { AnyFunction } from "@zayne-labs/toolkit-type-helpers";
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import { useEffect, useMemo, useState } from "react";
import { cnMerge } from "@/lib/utils/cn";
import { IconBox } from "../common/IconBox";
import { shadcnButtonVariants, type ShadcnButtonProps } from "./constants";

type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

type CarouselProps = {
	options?: CarouselOptions;
	orientation?: "horizontal" | "vertical";
	plugins?: CarouselPlugin;
	setApi?: (api: CarouselApi) => void;
};

type CarouselContextType = CarouselProps & {
	api: ReturnType<typeof useEmblaCarousel>[1];
	canScrollNext: boolean;
	canScrollPrev: boolean;
	carouselRef: ReturnType<typeof useEmblaCarousel>[0];
	scrollNext: () => void;
	scrollPrev: () => void;
	scrollTo: (index: number) => void;
	selectedIndex: number;
	totalItems: number;
};

const [CarouselContextProvider, useCarouselContext] = createCustomContext<CarouselContextType>({
	hookName: "useCarouselContext",
	name: "CarouselContext",
	providerName: "CarouselRoot",
});

function CarouselRoot(props: CarouselProps & React.ComponentProps<"div">) {
	const {
		children,
		className,
		options,
		orientation = "horizontal",
		plugins,
		setApi,
		...restOfProps
	} = props;

	const [carouselRef, carouselApi] = useEmblaCarousel(
		{ ...options, axis: orientation === "horizontal" ? "x" : "y" },
		plugins
	);
	const [canScrollPrev, setCanScrollPrev] = useState(false);
	const [canScrollNext, setCanScrollNext] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(options?.startIndex ?? 0);

	const scrollPrev = useCallbackRef(() => carouselApi?.scrollPrev());

	const scrollNext = useCallbackRef(() => carouselApi?.scrollNext());

	const scrollTo = useCallbackRef((index: number) => {
		if (index === carouselApi?.selectedScrollSnap()) return;

		const autoplay = (carouselApi?.plugins().autoplay ?? {}) as { reset: AnyFunction | undefined };
		autoplay.reset?.();

		carouselApi?.scrollTo(index);
	});

	const handleKeyDown = useCallbackRef((event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			scrollPrev();
		}

		if (event.key === "ArrowRight") {
			event.preventDefault();
			scrollNext();
		}
	});

	useEffect(() => {
		if (!carouselApi || !setApi) return;

		setApi(carouselApi);
	}, [carouselApi, setApi]);

	useEffect(() => {
		if (!carouselApi) return;

		const onSelect = () => {
			/* eslint-disable react/set-state-in-effect */
			setCanScrollPrev(carouselApi.canScrollPrev());
			setCanScrollNext(carouselApi.canScrollNext());
			setSelectedIndex(carouselApi.selectedScrollSnap());
			/* eslint-enable react/set-state-in-effect */
		};

		onSelect();

		carouselApi.on("reInit", onSelect);
		carouselApi.on("select", onSelect);

		return () => {
			carouselApi.off("select", onSelect);
		};
	}, [carouselApi]);

	const contextValue = useMemo(
		() =>
			({
				api: carouselApi,
				canScrollNext,
				canScrollPrev,
				carouselRef,
				options,
				orientation,
				scrollNext,
				scrollPrev,
				scrollTo,
				selectedIndex,
				totalItems: carouselApi?.scrollSnapList().length ?? 0,
			}) satisfies CarouselContextType,
		[
			carouselApi,
			canScrollNext,
			canScrollPrev,
			carouselRef,
			options,
			orientation,
			selectedIndex,
			scrollNext,
			scrollPrev,
			scrollTo,
		]
	);

	return (
		<CarouselContextProvider value={contextValue}>
			<div
				onKeyDownCapture={handleKeyDown}
				className={cnMerge("relative", className)}
				role="region"
				aria-roledescription="carousel"
				data-slot="carousel-root"
				{...restOfProps}
			>
				{children}
			</div>
		</CarouselContextProvider>
	);
}

function CarouselContent(props: React.ComponentProps<"div">) {
	const { className, ...restOfProps } = props;

	const { carouselRef, orientation } = useCarouselContext();

	return (
		<div ref={carouselRef} data-slot="carousel-content-outer" className="size-full overflow-hidden">
			<div
				data-slot="carousel-content-inner"
				className={cnMerge(
					"flex gap-4",
					// orientation === "horizontal" && "-ml-4",
					// orientation === "vertical" && "-mt-4 flex-col",
					orientation === "vertical" && "flex-col",
					className
				)}
				{...restOfProps}
			/>
		</div>
	);
}

function CarouselItem(props: React.ComponentProps<"div">) {
	const { className, ...restOfProps } = props;

	// const { orientation } = useCarouselContext();

	return (
		<div
			role="group"
			aria-roledescription="slide"
			data-slot="carousel-item"
			className={cnMerge(
				"w-full min-w-0 shrink-0 grow-0",
				// orientation === "horizontal" && "pl-4",
				// orientation === "vertical" && "pt-4",
				className
			)}
			{...restOfProps}
		/>
	);
}

function CarouselPrevious(props: ShadcnButtonProps) {
	const { className, size = "icon", variant = "outline", ...restOfProps } = props;

	const { canScrollPrev, orientation, scrollPrev } = useCarouselContext();

	return (
		<button
			type="button"
			data-slot="carousel-previous"
			className={cnMerge(
				"absolute size-8 rounded-full",
				shadcnButtonVariants({ size, variant }),
				orientation === "horizontal" && "top-1/2 -left-12 -translate-y-1/2",
				orientation === "vertical" && "-top-12 left-1/2 -translate-x-1/2 rotate-90",
				className
			)}
			disabled={!canScrollPrev}
			onClick={scrollPrev}
			{...restOfProps}
		>
			<IconBox icon="lucide:arrow-left" />
			<span className="sr-only">Previous slide</span>
		</button>
	);
}

function CarouselNext(props: ShadcnButtonProps) {
	const { className, size = "icon", variant = "outline", ...restOfProps } = props;

	const { canScrollNext, orientation, scrollNext } = useCarouselContext();

	return (
		<button
			type="button"
			data-slot="carousel-next"
			className={cnMerge(
				"absolute size-8 rounded-full",
				orientation === "horizontal" ?
					"top-1/2 -right-12 -translate-y-1/2"
				:	"-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
				shadcnButtonVariants({ size, variant }),
				className
			)}
			disabled={!canScrollNext}
			onClick={scrollNext}
			{...restOfProps}
		>
			<IconBox icon="lucide:arrow-right" />
			<span className="sr-only">Next slide</span>
		</button>
	);
}

function CarouselIndicator(props: React.ComponentProps<"button"> & { currentIndex: number }) {
	const { className, currentIndex, ...restOfProps } = props;
	const { scrollTo, selectedIndex } = useCarouselContext();

	return (
		<button
			type="button"
			role="tab"
			data-slot="carousel-indicator"
			data-selected={currentIndex === selectedIndex}
			aria-controls="carousel-item"
			aria-label={`Slide ${currentIndex + 1}`}
			className={cnMerge(
				"size-2.5 cursor-pointer rounded-full bg-shadcn-ring data-[selected=true]:bg-shadcn-primary",
				className
			)}
			onClick={() => scrollTo(currentIndex)}
			{...restOfProps}
		/>
	);
}

type RenderPropFn = (context: {
	index: number;
	snapPoint: number;
	snapPointArray: number[];
}) => React.ReactNode;

function CarouselIndicatorList(
	props: Omit<React.ComponentProps<"ul">, "children"> & {
		children?: RenderPropFn;
		classNames?: { indicator?: string; indicatorGroup?: string };
	}
) {
	const { children, className, classNames, ...restOfProps } = props;
	const { api } = useCarouselContext();

	const snapPointArray = api?.scrollSnapList();

	const defaultChildren: RenderPropFn = (ctx) => (
		<CarouselIndicator key={ctx.index} currentIndex={ctx.index} className={classNames?.indicator} />
	);

	const selectedChildren = children ?? defaultChildren;

	return (
		<ul
			role="tablist"
			data-slot="carousel-indicator-group"
			className={cnMerge(
				"absolute inset-x-0 bottom-0 flex w-full items-center justify-center gap-2",
				className,
				classNames?.indicatorGroup
			)}
			{...restOfProps}
		>
			{snapPointArray?.map((snapPoint, index) =>
				selectedChildren({ index, snapPoint, snapPointArray })
			)}
		</ul>
	);
}

type RenderFn = (props: CarouselContextType) => React.ReactNode;

function CarouselContext(props: DiscriminatedRenderProps<RenderFn>) {
	const { children, render } = props;

	const contextValue = useCarouselContext();

	const selectedRenderFn = typeof children === "function" ? children : render;

	return selectedRenderFn(contextValue);
}

export {
	CarouselContent as Content,
	CarouselContext as Context,
	CarouselIndicator as Indicator,
	CarouselIndicatorList as IndicatorList,
	CarouselItem as Item,
	CarouselNext as Next,
	CarouselPrevious as Previous,
	CarouselRoot as Root,
	type CarouselApi,
};
