import { useQuery } from "@tanstack/react-query";
import { useScrollObserver, useToggle } from "@zayne-labs/toolkit-react";
import { ForWithWrapper } from "@zayne-labs/ui-react/common/for";
import { IconBox } from "@/components/common/IconBox";
import { Logo } from "@/components/common/Logo";
import { NavLink, NavLinkEphemeral } from "@/components/common/NavLink";
import { Show } from "@/components/common/show";
import { Button } from "@/components/ui/button";
import { sessionQuery } from "@/lib/react-query/queryOptions";
import { cnJoin, cnMerge } from "@/lib/utils/cn";
import { navLinkItems } from "../-constants/navLinkItems";

function NavBar() {
	const { isScrolled, observedElementRef } = useScrollObserver({
		rootMargin: "0px",
	});

	return (
		<header
			ref={observedElementRef}
			className={cnJoin(
				`sticky inset-[0_0_auto_0] z-500 flex h-[72px] w-full items-center justify-between px-5
				transition-[box-shadow,background-color] duration-300 ease-[ease] md:px-8`,
				isScrolled && "bg-white/80 shadow-[0_1px_2px_hsl(0,0%,0%,0.05)] backdrop-blur-xl"
			)}
		>
			<Logo width={48} classNames={{ base: "flex items-center gap-2", image: "w-12" }}>
				<h3 className="text-[20px] font-bold text-black">VitaStock</h3>
			</Logo>

			<DesktopNavigation className="hidden lg:flex" />
			<MobileNavigation className="lg:hidden" />
		</header>
	);
}

function DesktopNavigation(props: { className?: string }) {
	const { className } = props;

	return (
		<div className={cnMerge("flex w-full items-center", className)}>
			<ForWithWrapper
				as="nav"
				className="mx-6 flex min-w-fit grow justify-center gap-8 text-[15px] font-semibold text-black"
				each={navLinkItems}
				renderItem={(linkItem) => (
					<NavLink
						key={linkItem.title}
						transitionType="regular"
						to={linkItem.href}
						className="hover:text-vitastock-primary-dark"
					>
						{linkItem.title}
					</NavLink>
				)}
			/>

			<div className="flex min-w-fit items-center gap-3">
				<AuthActions />
			</div>
		</div>
	);
}

function MobileNavigation(props: { className?: string }) {
	const { className } = props;

	const [isNavShow, toggleNavShow] = useToggle(false);

	return (
		<>
			<section
				inert={!isNavShow}
				className={cnMerge(
					`fixed top-[72px] right-0 flex h-[calc(100svh-72px)] flex-col gap-8 overflow-x-hidden
					overscroll-contain bg-white px-5 pt-6 pb-[max(24px,env(safe-area-inset-bottom))]
					transition-[width] ease-[ease]`,
					isNavShow ? "w-full duration-350" : "w-0 px-0 duration-500",
					className
				)}
				onClick={(event) => {
					const element = event.target as HTMLElement;

					element.closest("a") && toggleNavShow(false);
				}}
			>
				<ForWithWrapper
					as="nav"
					className="flex flex-col text-[18px] font-semibold text-nowrap text-black"
					each={navLinkItems}
					renderItem={(linkItem) => (
						<NavLink
							key={linkItem.title}
							to={linkItem.href}
							className="border-b border-shadcn-border/60 py-4 hover:text-vitastock-primary-dark"
						>
							{linkItem.title}
						</NavLink>
					)}
				/>

				<div className="flex flex-col gap-3 [&_button]:w-full">
					<AuthActions />
				</div>
			</section>

			<Button
				unstyled={true}
				className={cnMerge("-mr-2 grid size-11 place-items-center rounded-lg text-black", className)}
				aria-label={isNavShow ? "Close menu" : "Open menu"}
				aria-expanded={isNavShow}
				onClick={() => toggleNavShow()}
			>
				<IconBox icon={isNavShow ? "lucide:x" : "lucide:menu"} className="size-6" />
			</Button>
		</>
	);
}

function AuthActions() {
	const sessionQueryResult = useQuery(sessionQuery());

	return (
		<Show.Root when={sessionQueryResult.data}>
			<NavLinkEphemeral to="/dashboard">
				<Button className="h-10">Go to dashboard</Button>
			</NavLinkEphemeral>

			<Show.Fallback>
				<NavLinkEphemeral to="/auth/signin">
					<Button theme="primary-ghost" className="h-10">
						Sign in
					</Button>
				</NavLinkEphemeral>

				<NavLinkEphemeral to="/auth/signup">
					<Button className="h-10">Sign up for free</Button>
				</NavLinkEphemeral>
			</Show.Fallback>
		</Show.Root>
	);
}

export { NavBar };
