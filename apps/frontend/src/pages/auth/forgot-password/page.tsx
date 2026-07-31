import { zodResolver } from "@hookform/resolvers/zod";
import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { createSearchParams } from "@zayne-labs/toolkit-core";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { IconBox } from "@/components/common/IconBox";
import { NavLinkEphemeral } from "@/components/common/NavLink";
import { Button } from "@/components/ui";
import { Form } from "@/components/ui/form";
import { callBackendApiForQuery } from "@/lib/api/callBackendApi";
import { Main } from "../-components/Main";

const ForgotPasswordSchema = backendApiSchemaRoutes["@post/auth/forgot-password"].body;

function ForgotPasswordPage() {
	const form = useForm({
		defaultValues: {
			email: "",
		},
		resolver: zodResolver(ForgotPasswordSchema),
	});

	const navigate = useNavigate();

	const onSubmit = form.handleSubmit(async (data) => {
		await callBackendApiForQuery("@post/auth/forgot-password", {
			body: data,

			onSuccess: () => {
				void navigate({
					pathname: "/auth/signin",
					search: createSearchParams({ email: data.email }).toString(),
				});
			},
		});
	});

	return (
		<Main>
			<section className="flex w-full max-w-[442px] flex-col gap-9">
				<div className="flex flex-col gap-4">
					<h1 className="text-[30px] font-extrabold text-black">Forgot your password</h1>
					<p>Enter your email address and we’ll send you a link to reset your password.</p>
				</div>

				<Form.Root form={form} onSubmit={(event) => void onSubmit(event)} className="w-full gap-8">
					<div className="flex flex-col gap-4">
						<Form.Field control={form.control} name="email">
							<Form.Label className="text-[14px] font-semibold">Email address</Form.Label>

							<Form.Input
								placeholder="Email Address"
								className="h-[50px] rounded-[8px] border border-[hsl(231,20%,80%,0.6)] bg-white
									p-4"
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
									Send Reset Link
								</Button>
							)}
						</Form.Submit>

						<NavLinkEphemeral to="/auth/signin">
							<Button theme="primary-ghost" size="full-width">
								<IconBox icon="lucide:arrow-left" className="size-3.5" />
								<p>Back to sign in</p>
							</Button>
						</NavLinkEphemeral>
					</div>
				</Form.Root>
			</section>
		</Main>
	);
}

export default ForgotPasswordPage;
