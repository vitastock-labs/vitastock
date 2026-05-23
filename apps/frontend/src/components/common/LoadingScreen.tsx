import { lockScroll } from "@zayne-labs/toolkit-core";
import { AnimatePresence, motion } from "motion/react";
import { useLayoutEffect } from "react";
import { ForWithWrapper } from "./for";
import { Logo } from "./Logo";
import { Show } from "./show";

type LoadingScreenProps = {
	isVisible?: boolean;
	loadingText?: string;
};

function LoadingScreen(props: LoadingScreenProps) {
	const { isVisible = true, loadingText } = props;

	useLayoutEffect(() => {
		lockScroll({ lock: isVisible });
	}, [isVisible]);

	return (
		<AnimatePresence>
			{isVisible && (
				<motion.div
					initial={{ opacity: 1 }}
					exit={{
						opacity: 0,
						transition: { delay: 0.2, duration: 0.8, ease: [0.76, 0, 0.24, 1] },
					}}
					className="fixed inset-0 z-1000 flex flex-col items-center justify-center overflow-hidden
						bg-white"
				>
					<div
						className="pointer-events-none absolute inset-0 bg-[url('src/assets/images/noise.svg')]
							opacity-[0.05]"
					/>

					<div className="relative flex flex-col items-center">
						<motion.div
							initial={{ opacity: 0, scale: 0.9 }}
							animate={{
								opacity: 1,
								scale: [0.9, 1.02, 1],
							}}
							transition={{
								duration: 1.5,
								ease: "easeOut",
								repeat: Number.POSITIVE_INFINITY,
								repeatType: "reverse",
							}}
							className="relative z-10"
						>
							<Logo as="div" width={180} className="h-14 w-auto" />
						</motion.div>

						<div
							className="relative mt-12 h-0.5 w-56 overflow-hidden rounded-full
								bg-vitastock-primary-main/5"
						>
							<motion.div
								initial={{ x: "-100%" }}
								animate={{ x: "100%" }}
								transition={{
									duration: 2,
									ease: [0.65, 0, 0.35, 1],
									repeat: Number.POSITIVE_INFINITY,
								}}
								className="size-full bg-vitastock-primary-main
									shadow-[0_0_20px_theme(--color-vitastock-primary-main)]"
							/>
						</div>

						<motion.div
							animate={{
								opacity: [0.2, 0.4, 0.2],
								scale: [1, 1.3, 1],
							}}
							transition={{
								duration: 4,
								ease: "easeInOut",
								repeat: Number.POSITIVE_INFINITY,
							}}
							className="absolute top-1/2 left-1/2 -z-10 size-100 -translate-1/2 rounded-full
								bg-vitastock-primary-glow/10 blur-[100px]"
						/>
						<motion.div
							animate={{
								opacity: [0.1, 0.3, 0.1],
								scale: [1.2, 1, 1.2],
							}}
							transition={{
								delay: 1,
								duration: 5,
								ease: "easeInOut",
								repeat: Number.POSITIVE_INFINITY,
							}}
							className="absolute top-1/2 left-1/2 -z-20 size-75 -translate-1/2 rounded-full
								bg-vitastock-primary-main/10 blur-[80px]"
						/>

						<Show.Root control="content">
							<Show.Content when={loadingText}>
								{(definedLoadingText) => (
									<ForWithWrapper
										each={[
											...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(
												definedLoadingText
											),
										]}
										className="absolute top-35 flex gap-1 whitespace-nowrap"
										renderItem={(item, index) => (
											<motion.h2
												key={`char-${index}`}
												initial={{ opacity: 0, y: 10 }}
												animate={{ opacity: 1, y: 0 }}
												transition={{
													delay: 0.5 + index * 0.03,
													duration: 0.5,
													ease: "easeOut",
												}}
												className="text-base font-bold tracking-[0.25em]
													text-vitastock-body-color/30 uppercase"
											>
												{item.segment === " " ? "\u00A0" : item.segment}
											</motion.h2>
										)}
									/>
								)}
							</Show.Content>

							<Show.Fallback>
								<ForWithWrapper
									each={3}
									className="absolute top-35 flex gap-2"
									renderItem={(index) => (
										<motion.div
											key={`dot-${index}`}
											animate={{ opacity: [0.2, 1, 0.2] }}
											transition={{
												delay: index * 0.2,
												duration: 1.2,
												ease: "easeInOut",
												repeat: Number.POSITIVE_INFINITY,
											}}
											className="size-1.5 rounded-full bg-vitastock-primary-main/30"
										/>
									)}
								/>
							</Show.Fallback>
						</Show.Root>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

export { LoadingScreen };
