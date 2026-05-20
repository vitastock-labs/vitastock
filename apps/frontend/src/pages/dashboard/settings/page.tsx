import { useForm } from "react-hook-form";
import { IconBox } from "@/components/common/IconBox";
import { Button } from "@/components/ui";
import { Form } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Main } from "../-components/Main";

function SettingsPage() {
	const form = useForm({
		defaultValues: {
			email: "owner@vitastock.com",
			emailAlerts: true,
			lowStockThreshold: 20,
			pharmacyName: "Central Branch Pharmacy",
		},
	});

	return (
		<Main className="max-w-225 gap-8 self-center">
			<header className="flex flex-col gap-1.5">
				<h1 className="text-[28px] font-extrabold tracking-tight text-black">System Settings</h1>
				<p className="text-[15px] font-medium text-vitastock-body-color/80">
					Manage your workspace preferences and alert configurations.
				</p>
			</header>

			<Form.Root
				form={form}
				onSubmit={(event) => event.preventDefault()}
				className="flex flex-col gap-8"
			>
				<article className="flex flex-col rounded-xl bg-white ring-1 ring-shadcn-border/60">
					<div className="flex items-center gap-2.5 border-b border-shadcn-border/50 p-5">
						<IconBox
							type="online"
							icon="lucide:store"
							className="size-5 text-vitastock-primary-main"
						/>
						<h2 className="text-[16px] font-bold text-black">Workspace Settings</h2>
					</div>

					<div className="flex flex-col gap-6 p-6 sm:flex-row">
						<Form.Field
							control={form.control}
							name="pharmacyName"
							className="flex w-full flex-col gap-2"
						>
							<Form.Label className="text-[13px] font-semibold text-vitastock-body-color">
								Pharmacy Name
							</Form.Label>
							<Form.Input
								className="h-10 rounded-lg border border-shadcn-border bg-transparent px-3
									text-[14.5px] font-medium text-black transition-colors outline-none
									focus-within:border-vitastock-primary-main focus-within:ring-1
									focus-within:ring-vitastock-primary-main"
							/>
							<Form.ErrorMessage />
						</Form.Field>

						<Form.Field control={form.control} name="email" className="flex w-full flex-col gap-2">
							<Form.Label className="text-[13px] font-semibold text-vitastock-body-color">
								Email Address
							</Form.Label>
							<Form.Input
								type="email"
								className="h-10 rounded-lg border border-shadcn-border bg-transparent px-3
									text-[14.5px] font-medium text-black transition-colors outline-none
									focus-within:border-vitastock-primary-main focus-within:ring-1
									focus-within:ring-vitastock-primary-main"
							/>
							<Form.ErrorMessage />
						</Form.Field>
					</div>
				</article>

				<article className="flex flex-col rounded-xl bg-white ring-1 ring-shadcn-border/60">
					<div className="flex items-center gap-2.5 border-b border-shadcn-border/50 p-5">
						<IconBox icon="lucide:bell" className="size-5 text-vitastock-primary-main" />
						<h2 className="text-[16px] font-bold text-black">Alert Settings</h2>
					</div>

					<div className="flex flex-col p-6">
						<div className="flex items-center justify-between border-b border-shadcn-border/50 pb-6">
							<div className="flex flex-col gap-1">
								<h3 className="text-[14.5px] font-bold text-black">Low Stock Threshold</h3>
								<p className="text-[13.5px] font-medium text-vitastock-body-color/80">
									Trigger alert when item quantity falls below this number.
								</p>
							</div>

							<Form.Field
								control={form.control}
								name="lowStockThreshold"
								className="flex flex-col gap-2"
							>
								<Form.Input
									type="number"
									className="h-10 w-25 rounded-lg border border-shadcn-border bg-transparent px-3
										text-center text-[14.5px] font-medium text-black transition-colors
										outline-none focus-within:border-vitastock-primary-main focus-within:ring-1
										focus-within:ring-vitastock-primary-main"
								/>
								<Form.ErrorMessage />
							</Form.Field>
						</div>

						<div className="flex items-center justify-between pt-6">
							<div className="flex flex-col gap-1">
								<h3 className="text-[14.5px] font-bold text-black">Email Alerts</h3>
								<p className="text-[13.5px] font-medium text-vitastock-body-color/80">
									Receive critical stock warnings via email.
								</p>
							</div>
							<Form.FieldWithController
								control={form.control}
								name="emailAlerts"
								render={({ field }) => (
									<Switch
										checked={field.value}
										onCheckedChange={field.onChange}
										className="data-checked:bg-vitastock-primary-dark
											data-unchecked:bg-shadcn-border"
									/>
								)}
							/>
						</div>
					</div>
				</article>

				<article
					className="flex flex-col items-start justify-between gap-5 rounded-xl border
						border-vitastock-primary-main/20 bg-[#f0f6fc] p-6 sm:flex-row sm:items-center"
				>
					<div className="flex flex-col gap-1.5">
						<h2 className="text-[16px] font-bold text-black">Drug Management</h2>
						<p className="text-[14.5px] font-medium text-vitastock-body-color/90">
							Add, remove, or categorize items in your central inventory.
						</p>
					</div>

					<Button className="h-10.5 shrink-0 rounded-lg bg-[#0047b3] px-5 hover:bg-[#0047b3]/90">
						<IconBox type="online" icon="lucide:book-user" className="size-4" />
						Manage Drug List
					</Button>
				</article>
			</Form.Root>
		</Main>
	);
}

export default SettingsPage;
