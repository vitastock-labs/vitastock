import { useForm } from "react-hook-form";
import { Logo } from "@/components/common/Logo";
import { NavLink } from "@/components/common/NavLink";
import { Button } from "@/components/ui";
import { Form } from "@/components/ui/form";
import { Main } from "../-components/Main";

function SignupPage() {
	const form = useForm({});

	const onSubmit = form.handleSubmit(() => {});

	return (
		<Main>
			<section
				className="flex w-full max-w-[420px] flex-col items-center gap-12 rounded-[16px] border
					border-[hsl(210,6%,93%)] bg-white p-8 shadow-[0_1px_2px_hsl(0,0%,0%,0.05)]"
			>
				<Logo width={96} classNames={{ base: "flex flex-col items-center gap-1", image: "w-[96px]" }}>
					<h1 className="text-[30px] font-bold text-black">VitaStock</h1>
				</Logo>

				<Form.Root form={form} onSubmit={(event) => void onSubmit(event)} className="w-full gap-8">
					<div className="flex flex-col gap-4">
						<Form.Field control={form.control} name="pharmacy_name">
							<Form.Input
								placeholder="Pharmacy Name"
								className="h-[50px] rounded-[8px] bg-[hsl(210,9%,96%)] p-4"
							/>
							<Form.ErrorMessage />
						</Form.Field>

						<Form.Field control={form.control} name="email">
							<Form.Input
								placeholder="Email Address"
								className="h-[50px] rounded-[8px] bg-[hsl(210,9%,96%)] p-4"
							/>
							<Form.ErrorMessage />
						</Form.Field>

						<Form.Field control={form.control} name="password">
							<Form.Input
								placeholder="Password"
								type="password"
								classNames={{ inputGroup: "h-[50px] rounded-[8px] bg-[hsl(210,9%,96%)] p-4" }}
							/>
							<Form.ErrorMessage />
						</Form.Field>

						<Form.Field control={form.control} name="confirmPassword">
							<Form.Input
								placeholder="Confirm Password"
								type="password"
								classNames={{ inputGroup: "h-[50px] rounded-[8px] bg-[hsl(210,9%,96%)] p-4" }}
							/>
							<Form.ErrorMessage />
						</Form.Field>
					</div>

					<Form.Submit asChild={true}>
						{(formState) => (
							<Button
								theme="primary"
								size="full-width"
								className="font-bold"
								isDisabled={formState.isSubmitting}
								isLoading={formState.isSubmitting}
							>
								Create your account
							</Button>
						)}
					</Form.Submit>

					<p className="text-center text-[14px]">
						I already have an account.{" "}
						<NavLink className="font-semibold text-vitastock-primary-dark" to="/auth/signin">
							Sign in
						</NavLink>
					</p>
				</Form.Root>
			</section>
		</Main>
	);
}

export default SignupPage;
