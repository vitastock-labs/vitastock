import { tw } from "@zayne-labs/toolkit-core";
import { Fragment } from "react";
import {
	appDashboardAlertsImg,
	appDashboardHeroImg,
	appDashboardImg,
	appSignupImg,
	heroImg,
	howAddStockImg,
	howAlertsImg,
	howTrackImg,
	SquiggleArrowImg,
} from "@/assets/images";
import { ForWithWrapper } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { ImageOnline } from "@/components/common/Image";
import { NavLink } from "@/components/common/NavLink";
import { Button } from "@/components/ui/button";
import { cnJoin } from "@/lib/utils/cn";
import { Main } from "./-components/Main";

function HomePage() {
	return (
		<Main>
			<HeroSection />
			<ProblemSection />
			<SolutionSection />
			<HowItWorksSection />
			<FeaturesSection />
			<FinalCTASection />
		</Main>
	);
}

export default HomePage;

function HeroSection() {
	return (
		<section
			className="flex w-full flex-col items-center px-[clamp(24px,7vw,100px)] pt-20 pb-16 text-black"
		>
			<h1
				className="max-w-[18ch] text-center text-[72px]/[1.05] font-extrabold tracking-[-0.035em]
					text-balance delay-60"
			>
				The <span className="font-fraunces text-vitastock-primary-main italic">fastest way</span> to
				manage pharmacy stock, without the{" "}
				<span className="font-fraunces text-vitastock-primary-main italic">manual chaos.</span>
			</h1>

			<p
				className="mt-8 max-w-[600px] text-center text-[19px] leading-relaxed font-medium
					text-vitastock-body-color/80 delay-120"
			>
				VitaStock is a browser-based inventory workflow built for busy pharmacies that want faster
				tracking and more reliable records.
			</p>

			<div className="mt-9 flex flex-col items-center gap-4 delay-180">
				<Button
					className="h-[56px] rounded-full px-10 text-lg
						shadow-[0_20px_60px_-10px_theme(--color-vitastock-primary-dark/0.35)]"
					asChild={true}
				>
					<NavLink to="/auth/signup">
						Get Started for Free
						<IconBox icon="lucide:arrow-right" />
					</NavLink>
				</Button>
				<p className="text-center text-[14px] font-medium text-vitastock-body-color/60">
					No setup stress. Get started in minutes.
				</p>
			</div>

			<div
				className="mt-14 w-full max-w-[1000px] rounded-[32px] border border-shadcn-border/40
					bg-shadcn-muted p-2.5
					shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)]"
			>
				<ImageOnline
					src={heroImg}
					alt="Hero Image"
					width={1000}
					height={800}
					priority={true}
					className="rounded-[24px] object-cover"
				/>
			</div>
		</section>
	);
}

const problems = [
	{
		accent: "Workload",
		accentIcon: "lucide:clock",
		classNames: {
			blur: tw`bg-vitastock-primary-main/20`,
			card: tw`border-shadcn-foreground bg-shadcn-foreground text-shadcn-background`,
			chip: tw`bg-shadcn-background/10 text-shadcn-background/90 ring-1 ring-shadcn-background/15`,
			desc: tw`text-shadcn-background/70`,
			iconWrap: tw`bg-shadcn-background/10 text-shadcn-background ring-1 ring-shadcn-background/20`,
			title: tw`text-shadcn-background`,
		},
		desc: "Counting, updating, and reconciling stock steals hours from the day.",
		icon: "lucide:clipboard-list",
		title: "Manual tracking takes too much time",
	},
	{
		accent: "Inaccurate",
		accentIcon: "lucide:alert-triangle",
		classNames: {
			blur: tw`bg-shadcn-destructive/10`,
			card: tw`border-shadcn-destructive/20 bg-shadcn-destructive/10 text-shadcn-foreground`,
			chip: tw`bg-shadcn-background/70 text-shadcn-destructive ring-1 ring-shadcn-destructive/20`,
			desc: tw`text-shadcn-foreground/70`,
			iconWrap: tw`bg-shadcn-destructive text-shadcn-background`,
			title: tw`text-shadcn-foreground`,
		},
		desc: "By the time the numbers are checked, they are already out of date.",
		icon: "lucide:calendar-clock",
		title: "Records stop matching reality",
	},
	{
		accent: "Blind spots",
		accentIcon: "lucide:eye-off",
		classNames: {
			blur: tw`bg-current`,
			card: tw`border-shadcn-border bg-shadcn-card text-shadcn-foreground`,
			chip: tw`bg-shadcn-muted text-shadcn-foreground/80 ring-1 ring-shadcn-border`,
			desc: tw`text-shadcn-muted-foreground`,
			iconWrap: tw`bg-shadcn-foreground text-shadcn-background`,
			title: tw`text-shadcn-foreground`,
		},
		desc: "That makes ordering, dispensing, and planning harder than it should be.",
		icon: "lucide:search-x",
		title: "You do not always know what is available",
	},
	{
		accent: "Reactive",
		accentIcon: "lucide:zap-off",
		classNames: {
			blur: tw`bg-white/20`,
			card: tw`border-vitastock-primary-main bg-vitastock-primary-main text-shadcn-primary-foreground`,
			chip: tw`bg-shadcn-primary-foreground/10 text-shadcn-primary-foreground ring-1
			ring-shadcn-primary-foreground/20`,
			desc: tw`text-shadcn-primary-foreground/80`,
			iconWrap: tw`bg-shadcn-primary-foreground/15 text-shadcn-primary-foreground ring-1
			ring-shadcn-primary-foreground/20`,
			title: tw`text-shadcn-primary-foreground`,
		},
		desc: "Stockouts and expiry issues are usually discovered after the damage is done.",
		icon: "lucide:package-x",
		title: "Problems show up too late",
	},
];

function ProblemSection() {
	return (
		<section
			id="problem"
			className="flex flex-col items-center px-[clamp(24px,7vw,100px)] py-[100px] text-black"
		>
			<p
				className="text-center text-[14px] font-bold tracking-wider text-vitastock-primary-main
					uppercase"
			>
				The Problem
			</p>
			<h2
				className="mt-4 max-w-[15ch] text-center text-[64px]/[1.1] font-extrabold tracking-[-0.03em]
					text-balance delay-60"
			>
				Managing inventory shouldn't feel{" "}
				<span className="font-fraunces text-vitastock-primary-main italic">this hard.</span>
			</h2>
			<p
				className="mt-6 max-w-[640px] text-center text-[18px] leading-relaxed font-medium
					text-vitastock-body-color/80 delay-120"
			>
				Between serving patients and handling daily operations, keeping track of stock manually leads
				to mistakes, delays, and lost revenue.
			</p>

			<ForWithWrapper
				each={problems}
				className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4"
				renderItem={(problem) => {
					return (
						<li
							key={problem.title}
							className={cnJoin(
								`relative flex flex-col justify-between overflow-hidden rounded-3xl border p-7
								transition-all delay-120 duration-300 hover:-translate-y-1 hover:shadow-md`,
								problem.classNames.card
							)}
						>
							<span
								className={cnJoin(
									"inline-grid size-12 place-items-center rounded-2xl",
									problem.classNames.iconWrap
								)}
							>
								<IconBox
									type="online"
									icon={problem.icon}
									width={24}
									height={24}
									className="size-6"
								/>
							</span>

							<h3
								className={cnJoin(
									"mt-6 text-[20px] font-extrabold tracking-[-0.5px]",
									problem.classNames.title
								)}
							>
								{problem.title}
							</h3>

							<p className={cnJoin("mt-3 text-[14px]", problem.classNames.desc)}>{problem.desc}</p>

							<div className="mt-6">
								<span
									className={cnJoin(
										`inline-flex items-center gap-1.5 rounded-full px-3 py-1.25 text-[12px]
										font-semibold`,
										problem.classNames.chip
									)}
								>
									<IconBox
										type="online"
										icon={problem.accentIcon}
										width={14}
										height={14}
										className="size-3.5"
									/>
									{problem.accent}
								</span>
							</div>

							<div
								aria-hidden="true"
								className={cnJoin(
									"pointer-events-none absolute -top-5 -right-5 size-[96px] rounded-full blur-3xl",
									problem.classNames.blur
								)}
							/>
						</li>
					);
				}}
			/>
		</section>
	);
}

function SolutionSection() {
	return (
		<section
			id="solution"
			className="flex flex-col items-center gap-20 px-[clamp(24px,7vw,100px)] py-[80px] text-black
				lg:flex-row"
		>
			<div className="group relative aspect-5/4 w-full perspective-distant">
				<span
					className="absolute top-6 right-0 h-[88%] w-[78%] rounded-4xl bg-vitastock-primary-main/10"
				/>

				<span
					className="absolute top-0 left-0 w-[78%] overflow-hidden rounded-2xl bg-shadcn-card
						shadow-xl ring-1 ring-shadcn-border transition-all duration-700 ease-out
						group-hover:-translate-2
						group-hover:transform-[translate3d(-8px,-8px,0)_rotateX(2deg)_rotateY(-3deg)]
						group-hover:shadow-2xl"
				>
					<ImageOnline
						src={appSignupImg}
						alt="VitaStock sign up screen"
						className="w-full object-cover transition-[scale] duration-700 ease-out
							group-hover:scale-[1.03]"
					/>
				</span>

				<span
					className="absolute right-0 bottom-0 w-[62%] overflow-hidden rounded-2xl bg-shadcn-card
						shadow-2xl ring-1 ring-shadcn-border transition-all duration-700 ease-out
						group-hover:translate-x-3 group-hover:translate-y-2
						group-hover:transform-[translate3d(12px,8px,0)_rotateX(-2deg)_rotateY(3deg)]
						group-hover:shadow-[0_25px_60px_-15px_theme(--color-vitastock-primary-main/0.5)]"
				>
					<ImageOnline
						src={appDashboardImg}
						alt="VitaStock dashboard screen"
						className="w-full object-cover transition-[scale] duration-700 ease-out
							group-hover:scale-[1.03]"
					/>
				</span>
			</div>

			<div>
				<p className="text-[14px] font-bold tracking-wider text-vitastock-primary-main uppercase">
					The solution
				</p>

				<h2
					className="mt-3 max-w-[15ch] text-[64px]/[1.1] font-extrabold tracking-[-0.03em]
						text-balance delay-60"
				>
					A <span className="font-fraunces text-vitastock-primary-main italic">simpler way</span> to
					manage pharmacy inventory
				</h2>

				<p className="mt-6 text-[18px] leading-relaxed text-pretty text-vitastock-body-color/90">
					VitaStock replaces notebooks and spreadsheets with fast, dependable workflows that help your
					team keep stock clear, current, and easy to trust.
				</p>

				<ForWithWrapper
					className="mt-7 flex flex-col gap-3"
					each={[
						"Log stock-in and stock-out quickly",
						"Keep records aligned with real stock",
						"Spot low stock and expiry risk early",
						"Reconcile faster with less manual effort",
					]}
					renderItem={(item) => (
						<li key={item} className="flex items-start gap-3 text-base">
							<span
								className="grid size-6 shrink-0 place-content-center rounded-full
									bg-vitastock-primary-main/10 text-vitastock-primary-main"
							>
								<IconBox icon="lucide:check" className="size-3.5 *:stroke-3" />
							</span>
							<p className="text-black">{item}</p>
						</li>
					)}
				/>

				<Button
					className="mt-9 rounded-full px-8
						shadow-[0_20px_60px_-10px_theme(--color-vitastock-primary-dark/0.35)]"
					asChild={true}
				>
					<NavLink to="/auth/signup">
						Get Started for Free
						<IconBox icon="lucide:arrow-right" />
					</NavLink>
				</Button>
			</div>
		</section>
	);
}

const howItWorksSteps = [
	{
		alt: "Pharmacist uploading stock inventory data",
		desc: "Import your drugs or set up a simple reference list once.",
		image: howAddStockImg,
		title: "Add your drug list",
	},
	{
		alt: "Pharmacist reviewing live inventory dashboard on a tablet",
		desc: "Record stock-in, stock-out, in less than 10 seconds.",
		image: howTrackImg,
		title: "Log stock as it moves",
	},
	{
		alt: "Smartphone showing a low stock notification alert",
		desc: "Get alerts for low stock and expiry without manual checking.",
		image: howAlertsImg,
		title: "Stay ahead of issues automatically",
	},
];

function HowItWorksSection() {
	return (
		<section
			id="how-it-works"
			className="flex flex-col gap-20 px-[clamp(24px,7vw,100px)] py-[80px] text-black"
		>
			<div className="flex flex-col items-center gap-5 text-center">
				<p className="text-[14px] font-bold tracking-wider text-vitastock-primary-main uppercase">
					How it works
				</p>
				<h2
					className="max-w-[18ch] text-center text-[64px]/[1.1] font-extrabold tracking-[-0.03em]
						text-balance delay-60"
				>
					Set up in minutes.{" "}
					<span className="font-fraunces text-vitastock-primary-main italic">Use it every day.</span>
				</h2>

				<p className="mt-4 text-[18px] font-medium text-pretty text-vitastock-body-color/70">
					Built for fast-moving pharmacy workflows.
				</p>
			</div>

			<ForWithWrapper
				each={howItWorksSteps}
				className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-x-4 [--image-container-height:250px]"
				renderItem={(step, index) => (
					<Fragment key={step.title}>
						<li className="flex columns-[1fr] flex-col items-center gap-8 text-center">
							<span
								className="rounded-full border-[1.5px] border-dashed border-shadcn-border p-3
									ring-1 ring-shadcn-border"
							>
								<div className="overflow-hidden rounded-full">
									<ImageOnline
										src={step.image}
										alt={step.alt}
										width={768}
										height={768}
										className="h-(--image-container-height) rounded-full object-cover"
									/>
								</div>
							</span>

							<div className="flex grow flex-col items-center justify-between gap-3">
								<p className="text-[12px] font-bold tracking-[0.2em] uppercase">
									Step — 0{index + 1}
								</p>

								<h3
									className="font-bricolage-grotesque text-[24px] font-extrabold tracking-tight
										text-balance"
								>
									{step.title}
								</h3>
								<p className="max-w-[270px] text-center text-pretty">{step.desc}</p>
							</div>
						</li>

						{index < howItWorksSteps.length - 1 && (
							<SquiggleArrowImg
								className="mt-[calc(var(--image-container-height)/2)]
									text-vitastock-primary-main/70"
							/>
						)}
					</Fragment>
				)}
			/>
		</section>
	);
}

const features = [
	{
		desc: "Record stock-in and stock-out without slowing down the team.",
		title: "Fast stock logging",
	},
	{
		desc: "See what is available without guessing or cross-checking notebooks.",
		title: "Clear inventory visibility",
	},
	{
		desc: "Know when stock is nearing expiry before it becomes a loss.",
		title: "Expiry tracking",
	},
	{
		desc: "Spot supply gaps early and avoid last-minute surprises.",
		title: "Low-stock alerts",
	},
	{
		desc: "Compare expected vs physical stock and catch mismatches faster.",
		title: "Basic reconciliation",
	},
];

function FeaturesSection() {
	return (
		<section
			id="alerts"
			className="flex items-center gap-20 bg-vitastock-primary-darker px-[clamp(24px,7vw,100px)]
				py-[80px] text-white"
		>
			<div className="flex w-full flex-col gap-3">
				<p className="text-[14px] font-bold tracking-wider text-vitastock-primary-main uppercase">
					Features
				</p>

				<h2
					className="max-w-[20ch] text-[56px]/[1.1] font-extrabold tracking-[-0.02em] text-balance
						delay-60"
				>
					Everything you need to keep{" "}
					<span
						className="font-fraunces text-vitastock-primary-glow italic
							text-shadow-[0_0_30px_theme(--color-vitastock-primary-glow/0.4)]"
					>
						inventory under control.
					</span>
				</h2>

				<ForWithWrapper
					className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2"
					each={features}
					renderItem={(feature) => (
						<li key={feature.title} className="flex flex-col gap-2 text-base">
							<div className="flex items-center gap-3">
								<span
									className="grid size-6 shrink-0 place-items-center rounded-full
										bg-vitastock-primary-glow/15 text-vitastock-primary-glow"
								>
									<IconBox icon="lucide:circle-check" className="size-4" />
								</span>
								<h3 className="font-bold text-white">{feature.title}</h3>
							</div>
							<p className="pl-9 text-sm text-white/70">{feature.desc}</p>
						</li>
					)}
				/>

				<Button className="mt-9 rounded-full px-8 shadow-vitastock-primary-glow" asChild={true}>
					<NavLink to="/auth/signup">
						Get Started for Free
						<IconBox icon="lucide:arrow-right" />
					</NavLink>
				</Button>
			</div>

			<div className="group relative aspect-5/4 w-full perspective-distant">
				<span
					className="absolute top-6 right-0 h-[88%] w-[78%] rounded-4xl bg-vitastock-primary-main/15
						transition-transform duration-700 ease-out group-hover:scale-[1.02]"
				/>

				<span
					className="absolute top-0 left-0 w-[78%] overflow-hidden rounded-2xl bg-shadcn-card
						shadow-xl ring-1 ring-shadcn-border transition-all duration-700 ease-out
						group-hover:-translate-2
						group-hover:transform-[translate3d(-8px,-8px,0)_rotateX(2deg)_rotateY(-3deg)]
						group-hover:shadow-2xl"
				>
					<ImageOnline
						src={appDashboardAlertsImg}
						alt="VitaStock alerts screen"
						className="w-full object-cover transition-[scale] duration-700 ease-out
							group-hover:scale-[1.03]"
					/>
				</span>

				<span
					className="absolute right-0 bottom-0 w-[62%] overflow-hidden rounded-2xl bg-shadcn-card
						shadow-2xl ring-1 ring-shadcn-border transition-all duration-700 ease-out
						group-hover:translate-x-3 group-hover:translate-y-2
						group-hover:transform-[translate3d(12px,8px,0)_rotateX(-2deg)_rotateY(3deg)]
						group-hover:shadow-[0_25px_60px_-15px_theme(--color-vitastock-primary-main/0.5)]"
				>
					<ImageOnline
						src={appDashboardHeroImg}
						alt="VitaStock inventory dashboard"
						className="w-full object-cover transition-[scale] duration-700 ease-out
							group-hover:scale-[1.03]"
					/>
				</span>
			</div>
		</section>
	);
}

function FinalCTASection() {
	return (
		<section className="px-[clamp(24px,7vw,100px)] py-[80px] text-black">
			<div
				className="flex items-center gap-10 rounded-[24px] bg-vitastock-primary-main/8 px-[80px]
					py-[64px]"
			>
				<article className="w-full">
					<h2 className="text-[56px]/[1.1] font-extrabold tracking-[-0.02em] text-balance delay-60">
						Run your pharmacy{" "}
						<span className="font-fraunces text-vitastock-primary-main italic">
							with confidence.
						</span>
					</h2>

					<p className="mt-6 max-w-[448px] text-[18px] leading-relaxed text-vitastock-body-color/90">
						Less manual work. Fewer mismatches. Better visibility for the whole team.
					</p>

					<div className="mt-9 flex flex-col gap-4">
						<Button className="rounded-full px-8 shadow-vitastock-primary-glow" asChild={true}>
							<NavLink to="/auth/signup">
								Get Started for Free
								<IconBox icon="lucide:arrow-right" />
							</NavLink>
						</Button>

						<p className="text-[14px] text-vitastock-body-color">
							No complicated setup. Built for busy pharmacy teams.
						</p>
					</div>
				</article>

				<span className="size-full">
					<ImageOnline
						src={appDashboardHeroImg}
						alt="VitaStock inventory dashboard preview"
						className="size-full rounded-[16px] object-cover shadow-2xl ring-1 ring-shadcn-border"
					/>
				</span>
			</div>
		</section>
	);
}
