import { tw } from "@zayne-labs/toolkit-core";
import { useEffect } from "react";
import { useRouteError } from "react-router";
import { IconBox } from "@/components/common/IconBox";
import { Logo } from "@/components/common/Logo";
import { Button } from "@/components/ui";
import { cnJoin } from "@/lib/utils/cn";
import { Main } from "@/pages/auth/-components/Main";

const chunkErrorDetails = {
	actionFn: () => window.location.reload(),
	actionLabel: "Reload Now",
	bgText: "UP",
	icon: "lucide:refresh-cw" as const,
	iconColor: tw`text-vitastock-primary-dark`,
	message:
		"A new version of VitaStock is ready with the latest improvements. Please reload to stay in sync.",
	title: "VitaStock has been updated",
};

const generalErrorDetails = (error: unknown) => ({
	actionFn: () => window.location.reload(),
	actionLabel: "Retry",
	bgText: "500",
	icon: "material-symbols:error-outline-rounded" as const,
	iconColor: tw`text-shadcn-destructive`,
	message: error instanceof Error ? error.message : "An unexpected error occurred on our end.",
	title: "Something went wrong",
});

function ErrorPage() {
	const error = useRouteError();

	const isChunkLoadError =
		error instanceof Error
		&& (error.message.includes("Failed to fetch dynamically imported module")
			|| error.name === "ChunkLoadError");

	useEffect(() => {
		const hasReloaded = sessionStorage.getItem("chunk-load-reloaded");

		if (isChunkLoadError && !hasReloaded) {
			sessionStorage.setItem("chunk-load-reloaded", "true");
			window.location.reload();
		}
	}, [isChunkLoadError]);

	const details = isChunkLoadError ? chunkErrorDetails : generalErrorDetails(error);

	return (
		<Main className="relative min-h-svh">
			<section className="relative isolate z-10 flex flex-col items-center gap-10 text-center">
				<span
					className="absolute right-0 -z-1 size-[384px] bg-vitastock-primary-dark/10 mix-blend-overlay
						blur-3xl md:right-64"
				/>
				<span
					className="absolute left-0 -z-1 size-full bg-vitastock-primary-subtle/10 mix-blend-overlay
						blur-3xl md:left-24"
				/>

				<div className="flex flex-col items-center gap-8">
					<div className="flex items-center gap-2">
						<Logo width={48} className="w-12 animate-pulse" />
						<span className="text-[28px] font-extrabold tracking-tight text-black">VitaStock</span>
					</div>

					<span
						className="relative grid size-30 place-items-center rounded-2xl border
							border-[hsl(231,20%,80%)] bg-white/80 shadow-xl shadow-vitastock-primary-dark/10"
					>
						<p
							className="absolute -z-1 translate-x-2 text-[192px] font-extrabold
								text-[hsl(215,20%,85%,0.75)]"
						>
							{details.bgText}
						</p>
						<IconBox icon={details.icon} className={cnJoin("size-10", details.iconColor)} />
					</span>
				</div>

				<div className="flex flex-col items-center gap-4">
					<h1 className="text-4xl font-extrabold tracking-tight text-black md:text-5xl">
						{details.title}
					</h1>
					<p className="max-w-[480px] text-lg text-[hsl(215,16%,47%)]">{details.message}</p>
				</div>

				<div className="mt-4 flex flex-col gap-4 sm:flex-row">
					<Button
						className="px-10 py-6 text-base shadow-xl transition-shadow hover:shadow-2xl
							hover:shadow-vitastock-primary-dark/20"
						onClick={details.actionFn}
					>
						{details.actionLabel}
						<IconBox icon="lucide:refresh-cw" />
					</Button>
					{!isChunkLoadError && (
						<Button
							theme="primary-ghost"
							className="px-8 py-6 text-base"
							onClick={() => window.location.assign("/")}
						>
							<IconBox icon="lucide:arrow-left" className="mr-2 size-4" />
							Back to Home
						</Button>
					)}
				</div>
			</section>
		</Main>
	);
}

export default ErrorPage;
