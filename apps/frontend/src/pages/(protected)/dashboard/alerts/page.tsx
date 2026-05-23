import { For, ForWithWrapper } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { Switch } from "@/components/common/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cnJoin } from "@/lib/utils/cn";
import { Main } from "../-components/Main";

type AlertItem = {
	action: "Remove" | "Restock" | "Review";
	currentQty?: string;
	expiry?: string;
	location: string;
	qtyAffected?: string;
	sku: string;
	threshold?: string;
	title: string;
	type: "Expired" | "Expiring Soon" | "Low-Stock";
};

const alertsData = [
	{
		action: "Remove",
		expiry: "Oct 15, 2023",
		location: "Shelf B4",
		qtyAffected: "45 units",
		sku: "AMX-500-120",
		title: "Amoxicillin 500mg Capsules",
		type: "Expired",
	},
	{
		action: "Review",
		expiry: "Dec 01, 2023",
		location: "Shelf A2",
		qtyAffected: "120 units",
		sku: "LIS-10-90",
		title: "Lisinopril 10mg Tablets",
		type: "Expiring Soon",
	},
	{
		action: "Restock",
		currentQty: "12 units",
		location: "Shelf C1",
		sku: "ATV-20-30",
		threshold: "50 units",
		title: "Atorvastatin 20mg Tablets",
		type: "Low-Stock",
	},
	{
		action: "Restock",
		currentQty: "5 units",
		location: "Shelf F3",
		sku: "IBU-400-100",
		threshold: "30 units",
		title: "Ibuprofen 400mg Tablets",
		type: "Low-Stock",
	},
] satisfies AlertItem[];

function AlertsPage() {
	return (
		<Main className="gap-8">
			<section className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
				<div>
					<h1 className="text-[32px] font-extrabold tracking-tight text-black">Alerts</h1>
					<p className="mt-1 text-[15px] font-medium text-vitastock-body-color/80">
						Manage critical inventory issues needing attention.
					</p>
				</div>

				<ForWithWrapper
					as="div"
					className="flex items-center gap-2.5"
					each={["All Alerts", "Expired", "Expiring Soon", "Low-Stock"]}
					renderItem={(filter) => (
						<Button
							key={filter}
							unstyled={true}
							className={cnJoin(
								"h-9.5 rounded-[10px] px-4 text-[14px] font-medium transition-colors",
								filter === "All Alerts" ?
									"bg-vitastock-primary-main text-white"
								:	"border border-shadcn-border/60 bg-white hover:bg-shadcn-muted"
							)}
						>
							{filter}
						</Button>
					)}
				/>
			</section>

			<section
				className="flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-shadcn-border/40"
			>
				<For
					each={alertsData}
					renderItem={(alert, index) => {
						return (
							<article
								key={alert.sku}
								className={cnJoin(
									"flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between",
									index !== alertsData.length - 1 && "border-b border-shadcn-border/40"
								)}
							>
								<div className="flex items-start gap-4">
									<span
										className={cnJoin(
											"grid size-12 shrink-0 place-items-center rounded-xl",
											alert.type === "Expired"
												&& "bg-shadcn-destructive/10 text-shadcn-destructive",
											alert.type === "Expiring Soon" && "bg-[#d97706]/10 text-[#d97706]",
											alert.type === "Low-Stock" && "bg-[#eab308]/15 text-[#eab308]"
										)}
									>
										<Switch.Root>
											<Switch.Match when={alert.type === "Expired"}>
												<IconBox
													type="online"
													icon="lucide:triangle-alert"
													className="size-5.5"
												/>
											</Switch.Match>
											<Switch.Match when={alert.type === "Expiring Soon"}>
												<IconBox type="online" icon="lucide:clock" className="size-5.5" />
											</Switch.Match>
											<Switch.Match when={alert.type === "Low-Stock"}>
												<IconBox type="online" icon="lucide:archive" className="size-5.5" />
											</Switch.Match>
										</Switch.Root>
									</span>

									<div className="flex flex-col gap-1.5">
										<h3 className="text-[16px] font-bold text-black">{alert.title}</h3>
										<div
											className="flex items-center gap-3 text-[13px]
												text-vitastock-body-color/70"
										>
											<Badge
												className={cnJoin(
													`rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide
													uppercase`,
													alert.type === "Expired"
														&& `border-shadcn-destructive/20 bg-shadcn-destructive/10
														text-shadcn-destructive`,
													alert.type === "Expiring Soon"
														&& "border-[#d97706]/20 bg-[#d97706]/10 text-[#d97706]",
													alert.type === "Low-Stock"
														&& "border-[#eab308]/20 bg-[#eab308]/15 text-[#ca8a04]"
												)}
											>
												{alert.type}
											</Badge>
											<p>SKU: {alert.sku}</p>
											<p className="size-1 rounded-full bg-vitastock-body-color/30" />
											<p>Location: {alert.location}</p>
										</div>
									</div>
								</div>

								<div className="flex items-center justify-between gap-10 md:justify-end">
									<div className="flex flex-col gap-1 text-[13px]">
										<div className="flex items-center justify-end gap-1.5">
											<p className="text-vitastock-body-color/70">
												{alert.type === "Low-Stock" ? "Current Qty:" : "Qty Affected:"}
											</p>
											<p
												className={cnJoin(
													"font-medium",
													alert.type === "Expired" && "text-shadcn-destructive",
													alert.type === "Expiring Soon" && "text-black",
													alert.type === "Low-Stock" && "text-[#d97706]"
												)}
											>
												{alert.type === "Low-Stock" ? alert.currentQty : alert.qtyAffected}
											</p>
										</div>

										<div className="flex items-center justify-end gap-1.5">
											<p className="text-vitastock-body-color/70">
												{alert.type === "Low-Stock" ? "Threshold:" : "Expiry:"}
											</p>
											<p
												className={cnJoin(
													"font-medium",
													alert.type === "Expired" && "text-black",
													alert.type === "Expiring Soon" && "text-[#d97706]",
													alert.type === "Low-Stock" && "text-black"
												)}
											>
												{alert.type === "Low-Stock" ? alert.threshold : alert.expiry}
											</p>
										</div>
									</div>

									<div className="flex items-center gap-4">
										<Button
											unstyled={true}
											className="text-[14px] font-semibold text-vitastock-body-color/80
												transition-colors hover:text-black"
										>
											View Details
										</Button>

										<Button
											unstyled={true}
											className={cnJoin(
												`flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-[13px]
												font-semibold transition-colors`,
												alert.action === "Remove"
													&& `border border-shadcn-destructive text-shadcn-destructive
													hover:bg-shadcn-destructive/5`,
												alert.action === "Review"
													&& "border border-shadcn-border text-black hover:bg-shadcn-muted",
												alert.action === "Restock"
													&& `bg-vitastock-primary-main text-white
													hover:bg-vitastock-primary-main/90`
											)}
										>
											{alert.action === "Remove" && (
												<IconBox type="online" icon="lucide:trash-2" className="size-4" />
											)}
											{alert.action === "Restock" && (
												<IconBox
													type="online"
													icon="lucide:shopping-cart"
													className="size-4"
												/>
											)}
											{alert.action}
										</Button>
									</div>
								</div>
							</article>
						);
					}}
				/>
			</section>
		</Main>
	);
}

export default AlertsPage;
