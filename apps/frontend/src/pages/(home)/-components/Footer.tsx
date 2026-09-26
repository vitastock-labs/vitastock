import { ForWithWrapper } from "@zayne-labs/ui-react/common/for";
import { Logo } from "@/components/common/Logo";
import { NavLink } from "@/components/common/NavLink";

function Footer() {
	return (
		<footer
			className="flex flex-col items-start gap-6 border-t border-shadcn-border px-6 py-10 text-[14px]
				md:flex-row md:items-center md:justify-between lg:px-[100px]"
		>
			<article className="flex items-center gap-2">
				<Logo width={48} classNames={{ base: "flex items-center gap-2", image: "w-12" }}>
					<h3 className="font-bold text-black">VitaStock</h3>
				</Logo>
				{/* eslint-disable-next-line react/purity */}
				<p>© {new Date().getFullYear()}</p>
			</article>

			<article className="flex items-center gap-6">
				<ForWithWrapper
					as="nav"
					className="flex items-center gap-6"
					each={["Privacy", "Terms", "Contact"]}
					renderItem={(item) => (
						<NavLink
							key={item}
							to="#"
							transitionType="regular"
							className="hover:text-vitastock-primary-dark"
						>
							{item}
						</NavLink>
					)}
				/>
			</article>
		</footer>
	);
}

export { Footer };
