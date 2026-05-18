import { useForm } from "react-hook-form";
import { IconBox } from "@/components/common/IconBox";
import { NavLink } from "@/components/common/NavLink";
import { Button } from "@/components/ui";
import { Form } from "@/components/ui/form";
import { Main } from "../-components/Main";

function ResetPasswordPage() {
	const form = useForm({});

	const onSubmit = form.handleSubmit(() => {});

	return (
		<Main>
			<section className="flex w-full max-w-[442px] flex-col items-center gap-9">
				<span
					className="grid size-[80px] place-items-center rounded-[12px] bg-vitastock-primary-subtle"
				>
					<IconBox
						icon="streamline:padlock-square-1-solid"
						className="size-7 text-vitastock-primary-light"
					/>
				</span>

				<div className="flex flex-col items-center gap-4 text-center">
					<h1 className="text-[30px] font-extrabold text-black">Reset your password</h1>
					<p>Enter a new password for your account.</p>
				</div>

				<Form.Root form={form} onSubmit={(event) => void onSubmit(event)} className="w-full gap-8">
					<div className="flex flex-col gap-4">
						<Form.Field control={form.control} name="password">
							<Form.Label className="text-[14px] font-semibold">Password</Form.Label>

							<Form.Input
								placeholder="New Password"
								type="password"
								classNames={{
									inputGroup:
										"h-[50px] rounded-[8px] border border-[hsl(231,20%,80%,0.6)] bg-white p-4",
								}}
							/>

							<Form.ErrorMessage />
						</Form.Field>

						<Form.Field control={form.control} name="confirmPassword">
							<Form.Label className="text-[14px] font-semibold">Confirm Password</Form.Label>

							<Form.Input
								placeholder="Confirm Password"
								type="password"
								classNames={{
									inputGroup:
										"h-[50px] rounded-[8px] border border-[hsl(231,20%,80%,0.6)] bg-white p-4",
								}}
							/>

							<Form.ErrorMessage />
						</Form.Field>
					</div>

					<div className="flex flex-col gap-4">
						<Form.Submit asChild={true}>
							{(formState) => (
								<Button
									isDisabled={formState.isSubmitting}
									isLoading={formState.isSubmitting}
									theme="primary"
									size="full-width"
									className="font-bold"
								>
									Reset Password
								</Button>
							)}
						</Form.Submit>

						<Button theme="primary-ghost" size="full-width" asChild={true}>
							<NavLink to="/auth/sign-in">
								<IconBox icon="lucide:arrow-left" className="size-3.5" />
								<p>Back to sign in</p>
							</NavLink>
						</Button>
					</div>
				</Form.Root>
			</section>
		</Main>
	);
}

export default ResetPasswordPage;
