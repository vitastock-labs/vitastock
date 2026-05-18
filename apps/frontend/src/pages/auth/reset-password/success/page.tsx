import { NavLink } from "react-router";
import { IconBox } from "@/components/common/IconBox";
import { Button } from "@/components/ui";
import { Main } from "../../-components/Main";

function ResetPasswordSuccessPage() {
	return (
		<Main>
			<section className="flex w-full max-w-[448px] flex-col items-center gap-8">
				<span
					className="grid size-[80px] place-items-center rounded-[12px] bg-vitastock-primary-subtle"
				>
					<IconBox
						icon="mingcute:check-circle-fill"
						className="size-7.5 text-vitastock-primary-light"
					/>
				</span>

				<div className="flex flex-col items-center gap-4 text-center">
					<h1 className="text-[30px] font-extrabold text-black">Password reset successful</h1>
					<p className="text-base">
						Your password has been successfully updated. You can now log in.
					</p>
				</div>

				<Button theme="primary" size="full-width" className="font-semibold">
					<NavLink to="/auth/signin">Go to sign in</NavLink>
				</Button>
			</section>
		</Main>
	);
}

export default ResetPasswordSuccessPage;
