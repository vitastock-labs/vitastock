import { Timer, useTimer } from "@ark-ui/react/timer";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Fragment } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";
import { For } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { Button, InputOTP } from "@/components/ui";
import { Form } from "@/components/ui/form";
import { callBackendApiForQuery } from "@/lib/api/callBackendApi";
import { resendVerificationEmailMutation } from "@/lib/react-query/mutationOptions";
import { Main } from "../-components/Main";

const VerifyEmailSchema = backendApiSchemaRoutes["@post/auth/verify-email"].body.pick({ code: true });

function VerifyEmailPage() {
	const [searchParams] = useSearchParams();
	const email = searchParams.get("email") ?? "";
	const code = searchParams.get("code") ?? "";

	const resendTimer = useTimer({
		countdown: true,
		startMs: 1.5 * 60 * 1000,
	});

	const form = useForm({
		defaultValues: {
			code,
		},
		resolver: zodResolver(VerifyEmailSchema),
	});

	const navigate = useNavigate();

	const onSubmit = form.handleSubmit(async (data) => {
		await callBackendApiForQuery("@post/auth/verify-email", {
			body: { ...data, email },
			meta: { toast: { success: true } },

			onSuccess: () => {
				void navigate("/auth/signin");
			},
		});
	});

	const resendCodeMutationResult = useMutation(resendVerificationEmailMutation());

	const handleResendCode = () => {
		resendCodeMutationResult.mutate(
			{ email },
			{
				onSuccess: () => {
					resendTimer.restart();
				},
			}
		);
	};

	const isResendCooldownActive = resendTimer.running;
	const isResendDisabled = resendCodeMutationResult.isPending || isResendCooldownActive || !email;

	return (
		<Main>
			<section className="flex max-w-[442px] flex-col items-center gap-8">
				<span
					className="grid size-[80px] place-items-center rounded-[12px] bg-vitastock-primary-subtle"
				>
					<IconBox icon="material-symbols:mail" className="size-7.5 text-vitastock-primary-light" />
				</span>

				<div className="flex flex-col items-center gap-4 text-center">
					<h1 className="text-[30px] font-extrabold text-black">Check your email</h1>
					<p>We've sent a 6-digit verification code to your email address.</p>
				</div>

				<Form.Root form={form} onSubmit={(event) => void onSubmit(event)} className="w-full gap-8">
					<Form.Field control={form.control} name="code" className="items-center">
						<Form.FieldBoundController
							render={({ field }) => (
								<InputOTP.Root
									pattern={REGEXP_ONLY_DIGITS}
									maxLength={6}
									value={field.value}
									onChange={field.onChange}
									classNames={{
										container: "gap-3 md:gap-4",
									}}
								>
									<InputOTP.Group className="gap-1">
										<For
											each={6}
											renderItem={(index) => (
												<Fragment key={index}>
													<InputOTP.Slot
														index={index}
														classNames={{
															base: "size-10 rounded-[4px] text-[14px]",
															isActive: "ring-vitastock-primary-dark/80",
														}}
													/>
													{index === 2 && <InputOTP.Separator />}
												</Fragment>
											)}
										/>
									</InputOTP.Group>
								</InputOTP.Root>
							)}
						/>
						<Form.ErrorMessage />
					</Form.Field>

					<Form.Submit asChild={true}>
						{(formState) => (
							<Button
								isDisabled={formState.isSubmitting}
								isLoading={formState.isSubmitting}
								theme="primary"
								size="full-width"
								className="font-bold"
							>
								Verify email
							</Button>
						)}
					</Form.Submit>

					<div className="flex flex-col items-center gap-2 text-center">
						<p className="text-[14px]">Didn't receive the code?</p>
						<Button
							theme="secondary-outline"
							className="h-9 gap-1"
							isLoading={resendCodeMutationResult.isPending}
							disabled={isResendDisabled}
							onClick={handleResendCode}
						>
							Resend Code
							{isResendCooldownActive && <ResendCountdown timer={resendTimer} />}
						</Button>
					</div>
				</Form.Root>

				<p className="max-w-[280px] text-center text-[12px]/4 text-[hsl(231,8%,49%)]">
					Didn’t receive the email? Check your spam folder or resend.
				</p>
			</section>
		</Main>
	);
}

export default VerifyEmailPage;

function ResendCountdown(props: { timer: ReturnType<typeof useTimer> }) {
	const { timer } = props;

	return (
		<Timer.RootProvider value={timer} className="inline-flex items-center gap-1">
			<p>in</p>
			<Timer.Area className="inline-flex items-center font-semibold tabular-nums">
				<Timer.Item type="minutes" />
				<Timer.Separator>:</Timer.Separator>
				<Timer.Item type="seconds" />
			</Timer.Area>
		</Timer.RootProvider>
	);
}
