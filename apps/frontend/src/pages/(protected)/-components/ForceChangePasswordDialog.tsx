import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui";
import * as Dialog from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { callBackendApiForQuery } from "@/lib/api/callBackendApi";
import { sessionQuery } from "@/lib/react-query/queryOptions";

const ChangePasswordSchema = backendApiSchemaRoutes["@patch/auth/change-password"].body;

type ForceChangePasswordDialogProps = {
	isOpen: boolean;
};

export function ForceChangePasswordDialog({ isOpen }: ForceChangePasswordDialogProps) {
	const queryClient = useQueryClient();

	const form = useForm({
		defaultValues: {
			confirmNewPassword: "",
			currentPassword: "",
			newPassword: "",
		},
		resolver: zodResolver(ChangePasswordSchema),
	});

	const onSubmit = form.handleSubmit(async (data) => {
		await callBackendApiForQuery("@patch/auth/change-password", {
			body: data,
			onSuccess: async () => {
				await queryClient.invalidateQueries(sessionQuery());
			},
		});
	});

	return (
		<Dialog.Root open={isOpen}>
			<Dialog.Content
				withCloseButton={false}
				onPointerDownOutside={(e) => e.preventDefault()}
				onEscapeKeyDown={(e) => e.preventDefault()}
				className="max-w-110 rounded-2xl border border-[hsl(210,6%,93%)] bg-white p-8
					shadow-[0_1px_2px_hsl(0,0%,0%,0.05)]"
			>
				<Dialog.Header className="flex flex-col items-center gap-2 text-center">
					<Dialog.Title className="text-[24px] font-bold text-black">Change Password</Dialog.Title>
					<Dialog.Description className="text-sm text-gray-500">
						You are signed in with a temporary/default password. Please choose a new password to
						secure your account.
					</Dialog.Description>
				</Dialog.Header>

				<Form.Root
					form={form}
					onSubmit={(event) => void onSubmit(event)}
					className="mt-4 w-full gap-6"
				>
					<div className="flex flex-col gap-4">
						<Form.Field control={form.control} name="currentPassword">
							<Form.Label className="text-[14px] font-semibold text-gray-700">
								Current Password
							</Form.Label>
							<Form.Input
								placeholder="Enter current password"
								type="password"
								classNames={{
									inputGroup:
										"h-12.5 rounded-lg border-none bg-[hsl(210,9%,96%)] p-4 focus-visible:ring-1",
								}}
							/>
							<Form.ErrorMessage />
						</Form.Field>

						<Form.Field control={form.control} name="newPassword">
							<Form.Label className="text-[14px] font-semibold text-gray-700">
								New Password
							</Form.Label>
							<Form.Input
								placeholder="Enter new password"
								type="password"
								classNames={{
									inputGroup:
										"h-12.5 rounded-lg border-none bg-[hsl(210,9%,96%)] p-4 focus-visible:ring-1",
								}}
							/>
							<Form.ErrorMessage />
						</Form.Field>

						<Form.Field control={form.control} name="confirmNewPassword">
							<Form.Label className="text-[14px] font-semibold text-gray-700">
								Confirm New Password
							</Form.Label>
							<Form.Input
								placeholder="Confirm new password"
								type="password"
								classNames={{
									inputGroup:
										"h-12.5 rounded-lg border-none bg-[hsl(210,9%,96%)] p-4 focus-visible:ring-1",
								}}
							/>
							<Form.ErrorMessage />
						</Form.Field>
					</div>

					<Form.Submit asChild={true}>
						{(formState) => (
							<Button
								isDisabled={formState.isSubmitting}
								isLoading={formState.isSubmitting}
								theme="primary"
								size="full-width"
								className="mt-2 font-bold"
							>
								Update Password
							</Button>
						)}
					</Form.Submit>
				</Form.Root>
			</Dialog.Content>
		</Dialog.Root>
	);
}
