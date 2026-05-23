import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { Logo } from "@/components/common/Logo";
import { NavLink } from "@/components/common/NavLink";
import { Button } from "@/components/ui";
import { Form } from "@/components/ui/form";
import { callBackendApiForQuery } from "@/lib/api/callBackendApi";
import { sessionQuery } from "@/lib/react-query/queryOptions";
import { Main } from "../-components/Main";

const SignInSchema = backendApiSchemaRoutes["@post/auth/signin"].body;

function SigninPage() {
	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		resolver: zodResolver(SignInSchema),
	});

	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const onSubmit = form.handleSubmit(async (data) => {
		await callBackendApiForQuery("@post/auth/signin", {
			body: data,

			onResponseError: (ctx) => {
				const isEmailUnverifiedError =
					ctx.response.status === 401 && ctx.error.errorData.appCode === "EMAIL_UNVERIFIED";

				if (isEmailUnverifiedError) {
					void navigate(`/auth/verify-email?${new URLSearchParams({ email: data.email })}`);
				}
			},

			onSuccess: async () => {
				await queryClient.invalidateQueries(sessionQuery());

				void navigate(`/dashboard`);
			},
		});
	});

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

							<NavLink
								transitionType="regular"
								to="/auth/forgot-password"
								className="mt-1 self-end text-[14px] text-vitastock-primary-dark"
							>
								Forgot password?
							</NavLink>
						</Form.Field>
					</div>

					<Form.Submit asChild={true}>
						{(formState) => (
							<Button
								isDisabled={formState.isSubmitting}
								isLoading={formState.isSubmitting}
								theme="primary"
								size="full-width"
								className="font-bold"
							>
								Sign in
							</Button>
						)}
					</Form.Submit>

					<p className="text-center text-[14px]">
						I don't have an account.{" "}
						<NavLink
							transitionType="regular"
							className="font-semibold text-vitastock-primary-dark"
							to="/auth/signup"
						>
							Sign up
						</NavLink>
					</p>
				</Form.Root>
			</section>
		</Main>
	);
}

export default SigninPage;
