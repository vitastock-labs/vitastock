import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
	SignUpSchema as SignUpSchemaPrimitive,
	withMatchingPasswordFields,
} from "@vitastock/shared/validation/backendApiSchema";
import { createSearchParams } from "@zayne-labs/toolkit-core";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { Logo } from "@/components/common/Logo";
import { NavLink } from "@/components/common/NavLink";
import { Button } from "@/components/ui";
import { Form } from "@/components/ui/form";
import { callBackendApiForQuery } from "@/lib/api/callBackendApi";
import { sessionQuery } from "@/lib/react-query/queryOptions";
import { InputField } from "@/pages/(home)/-components/FormPartsShared";
import { Main } from "../-components/Main";

const SignUpSchema = withMatchingPasswordFields({
	confirmPasswordKey: "confirmPassword",
	passwordKey: "password",
	schema: SignUpSchemaPrimitive.safeExtend({
		confirmPassword: SignUpSchemaPrimitive.shape.password,
	}),
});

function SignupPage() {
	const form = useForm({
		defaultValues: {
			confirmPassword: "",
			email: "",
			fullName: "",
			password: "",
			pharmacyName: "",
		},
		resolver: zodResolver(SignUpSchema),
	});

	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const onSubmit = form.handleSubmit(async (data) => {
		await callBackendApiForQuery("@post/auth/signup", {
			body: data,

			onSuccess: async (ctx) => {
				await queryClient.invalidateQueries(sessionQuery());
				void navigate({
					pathname: "/auth/verify-email",
					search: createSearchParams({ email: ctx.data.data.user.email }).toString(),
				});
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
						<InputField
							control={form.control}
							name="fullName"
							placeholder="Full Name"
							classNames={{ input: "h-[50px] border-0 bg-[hsl(210,9%,96%)] p-4" }}
						/>
						<InputField
							control={form.control}
							name="pharmacyName"
							placeholder="Pharmacy Name"
							classNames={{ input: "h-[50px] border-0 bg-[hsl(210,9%,96%)] p-4" }}
						/>
						<InputField
							control={form.control}
							name="email"
							placeholder="Email Address"
							classNames={{ input: "h-[50px] border-0 bg-[hsl(210,9%,96%)] p-4" }}
						/>
						<InputField
							control={form.control}
							name="password"
							placeholder="Password"
							type="password"
							classNames={{ inputGroup: "h-[50px] border-0 bg-[hsl(210,9%,96%)] p-4" }}
						/>
						<InputField
							control={form.control}
							name="confirmPassword"
							placeholder="Confirm Password"
							type="password"
							classNames={{ inputGroup: "h-[50px] border-0 bg-[hsl(210,9%,96%)] p-4" }}
						/>
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
