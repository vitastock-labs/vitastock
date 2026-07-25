import { zodResolver } from "@hookform/resolvers/zod";
import {
	backendApiSchemaRoutes,
	withMatchingPasswordFields,
} from "@vitastock/shared/validation/backendApiSchema";
import { useSearchParamsObject } from "@zayne-labs/toolkit-react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { IconBox } from "@/components/common/IconBox";
import { NavLink } from "@/components/common/NavLink";
import { Button } from "@/components/ui";
import { Form } from "@/components/ui/form";
import { callBackendApiForQuery } from "@/lib/api/callBackendApi";
import { Main } from "../-components/Main";

const ResetPasswordSchema = withMatchingPasswordFields({
	confirmPasswordKey: "confirmNewPassword",
	passwordKey: "newPassword",
	schema: backendApiSchemaRoutes["@post/auth/reset-password"].body,
});

function ResetPasswordPage() {
	const [{ token }] = useSearchParamsObject<{ token: string }>();

	const form = useForm({
		defaultValues: {
			confirmNewPassword: "",
			newPassword: "",
			token,
		},
		resolver: zodResolver(ResetPasswordSchema),
	});

	const navigate = useNavigate();

	const onSubmit = form.handleSubmit(async (data) => {
		await callBackendApiForQuery("@post/auth/reset-password", {
			body: data,

			onSuccess: () => {
				void navigate("/auth/reset-password/success");
			},
		});
	});

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
						<Form.Field control={form.control} name="newPassword">
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

						<Form.Field control={form.control} name="confirmNewPassword">
							<Form.Label className="text-[14px] font-semibold">Confirm Password</Form.Label>

							<Form.Input
								placeholder="Confirm New Password"
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
