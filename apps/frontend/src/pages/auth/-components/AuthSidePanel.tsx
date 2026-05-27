import { authBg, logoInverted } from "@/assets/images";
import { ImageOnline } from "@/components/common/Image";
import { Logo } from "@/components/common/Logo";

function AuthSidePanel() {
	return (
		<aside className="w-full max-w-[660px] p-8">
			<div
				className="relative isolate flex size-full flex-col gap-[64px] rounded-[24px] p-[64px]
					shadow-[0_8px_10px_-6px_hsl(0,0%,0%,0.1),0_20px_25px_-5px_hsl(0,0%,0%,0.1)]"
			>
				<div className="absolute inset-0 isolate -z-1 rounded-[inherit]">
					<span
						className="absolute inset-0 rounded-[inherit]
							bg-[linear-gradient(135deg,hsl(222,100%,15%)_0%,hsl(218,100%,39%,0.8)_100%)]
							mix-blend-multiply"
					/>

					<span
						className="absolute inset-0 rounded-[inherit]
							bg-[linear-gradient(0deg,hsl(222,100%,15%)_0%,hsl(222,100%,15%,0)_50%,hsl(222,100%,15%,0)_100%)]
							mix-blend-multiply"
					/>

					<ImageOnline
						src={authBg}
						alt="Auth Background"
						className="absolute inset-0 size-full rounded-[inherit] object-cover opacity-40
							mix-blend-multiply"
					/>
				</div>

				<Logo
					src={logoInverted}
					width={64}
					classNames={{ base: "flex items-center gap-3", image: "w-[64px]" }}
				>
					<h3 className="text-[36px] font-bold text-white">VitaStock</h3>
				</Logo>

				<div className="grow">
					<h3 className="text-[64px]/[70px] font-medium tracking-[-1.6px] text-white">
						Stay in control of your pharmacy inventory
					</h3>

					<p className="mt-8 max-w-[36ch] text-[18px] text-[hsl(226,100%,85%)]">
						Track stock in real time, prevent shortages, and avoid expired drugs — all in one simple
						system.
					</p>

					<p className="mt-4 text-[14px] text-[hsl(226,100%,85%,0.8)]">
						Built for fast-paced pharmacy workflows. No spreadsheets. No guesswork.
					</p>
				</div>

				<p className="mt-12 text-[14px] text-white/90">© 2026 VitaStock. All rights reserved.</p>
			</div>
		</aside>
	);
}

export { AuthSidePanel };
