import { NavLink } from "react-router";
import { IconBox } from "@/components/common/IconBox";
import { Button } from "@/components/ui";
import { Main } from "../../-components/Main";

function VerifyEmailSuccessPage() {
	return (
		<Main>
			<section className="flex w-full max-w-[448px] flex-col items-center gap-8">
				<span className="grid size-[80px] place-items-center rounded-[12px] bg-[hsl(149,80%,90%)]">
					<IconBox icon="mingcute:check-circle-fill" className="size-7.5 text-[hsl(163,88%,20%)]" />
				</span>

				<div className="flex flex-col items-center gap-4 text-center">
					<h1 className="text-[30px] font-extrabold text-black">Email Verified</h1>
					<p className="text-base">Your account is ready. Sign in to access your dashboard.</p>
				</div>

				<Button theme="primary" size="full-width" className="font-semibold">
					<NavLink to="/auth/signin">Go to Sign In</NavLink>
				</Button>
			</section>
		</Main>
	);
}

export default VerifyEmailSuccessPage;
