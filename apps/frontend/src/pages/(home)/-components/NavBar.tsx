import { useScrollObserver } from "@zayne-labs/toolkit-react";
import { ForWithWrapper } from "@zayne-labs/ui-react/common/for";
import { Logo } from "@/components/common/Logo";
import { NavLink } from "@/components/common/NavLink";
import { Button } from "@/components/ui/button";
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
				`sticky top-0 z-500 flex h-[72px] w-full items-center justify-between px-8
				transition-[box-shadow,background-color] duration-300 ease-[ease]`,
				isScrolled && "bg-white/80 shadow-[0_1px_2px_hsl(0,0%,0%,0.05)] backdrop-blur-xl"
			)}
		>
			<Logo width={48} classNames={{ base: "flex items-center gap-2", image: "w-12" }}>
				<h3 className="text-[20px] font-bold text-black">VitaStock</h3>
			</Logo>

			<DesktopNavigation />
		</header>
	);
}

function DesktopNavigation(props: { className?: string }) {
	const { className } = props;

	return (
		<section className={cnMerge("flex w-full items-center", className)}>
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
				<Button theme="primary-ghost" className="h-10" asChild={true}>
					<NavLink to="/auth/signin">Sign in</NavLink>
				</Button>

				<Button className="h-10" asChild={true}>
					<NavLink to="/auth/signup">Sign up for free</NavLink>
				</Button>
			</div>
		</section>
	);
}

export { NavBar };
