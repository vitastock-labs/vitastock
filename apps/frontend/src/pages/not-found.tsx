import { useNavigate } from "react-router";
import { IconBox } from "@/components/common/IconBox";
import { Button } from "@/components/ui";
import { Logo } from "../components/common/Logo";
import { Main } from "./auth/-components/Main";

function NotFoundPage() {
	const navigate = useNavigate();

	return (
		<Main className="relative">
			<section className="relative isolate flex flex-col items-center gap-10 text-center">
				<span
					className="absolute right-[256px] -z-1 size-[384px] bg-vitastock-primary-dark/5
						mix-blend-overlay blur-3xl"
				/>
				<span
					className="absolute left-[96px] -z-1 size-full bg-vitastock-primary-subtle/10
						mix-blend-overlay blur-3xl"
				/>

				<div className="flex flex-col items-center gap-8">
					<div className="flex items-center gap-3">
						<Logo width={48} className="w-12 animate-pulse" />
						<span className="text-[28px] font-extrabold tracking-tight text-black">VitaStock</span>
					</div>

					<span
						className="relative isolate grid size-30 place-items-center rounded-2xl border
							border-[hsl(231,20%,80%)] bg-white shadow-xl shadow-vitastock-primary-dark/10"
					>
						<p className="absolute -z-1 text-[192px] font-extrabold text-[hsl(215,20%,85%,0.75)]">
							404
						</p>
						<IconBox
							icon="material-symbols:troubleshoot"
							className="size-10 text-vitastock-primary-dark"
						/>
					</span>
				</div>

				<div className="flex flex-col gap-4">
					<h1 className="text-[48px] font-bold text-black">Page not found</h1>
					<p className="max-w-[405px] text-[18px]">
						The page you’re looking for doesn’t exist or has been moved.
					</p>
				</div>

				<div className="flex gap-4">
					<Button className="px-8">Go to Dashboard</Button>
					<Button theme="primary-ghost" onClick={() => void navigate(-1)}>
						<IconBox icon="lucide:arrow-left" className="size-3.5" />
						<p>Back</p>
					</Button>
				</div>
			</section>
		</Main>
	);
}

export default NotFoundPage;
