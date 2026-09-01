import { zodResolver } from "@hookform/resolvers/zod";
import {
	backendApiSchemaRoutes,
	withMatchingPasswordFields,
} from "@vitastock/shared/validation/backendApiSchema";
import { parseAsString, useQueryState } from "nuqs";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { IconBox } from "@/components/common/IconBox";
import { NavLinkEphemeral } from "@/components/common/NavLink";
import { Button } from "@/components/ui";
import { Form } from "@/components/ui/form";
import { callBackendApiForQuery } from "@/lib/api/callBackendApi";
import { InputField } from "@/pages/(home)/-components/FormPartsShared";
import { Main } from "../-components/Main";

const ResetPasswordSchema = withMatchingPasswordFields({
	confirmPasswordKey: "confirmNewPassword",
	passwordKey: "newPassword",
	schema: backendApiSchemaRoutes["@post/auth/reset-password"].body,
});

function ResetPasswordPage() {
	const [token] = useQueryState("token", parseAsString.withDefault(""));

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
						<InputField
							control={form.control}
							name="newPassword"
							label="Password"
							placeholder="New Password"
							type="password"
							classNames={{
								inputGroup: "h-[50px] border-[hsl(231,20%,80%,0.6)] bg-white p-4",
								label: "text-[14px] font-semibold",
							}}
						/>

						<InputField
							control={form.control}
							name="confirmNewPassword"
							label="Confirm Password"
							placeholder="Confirm New Password"
							type="password"
							classNames={{
								inputGroup: "h-[50px] border-[hsl(231,20%,80%,0.6)] bg-white p-4",
								label: "text-[14px] font-semibold",
							}}
						/>
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

						<NavLinkEphemeral to="/auth/sign-in">
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

export default ResetPasswordPage;
