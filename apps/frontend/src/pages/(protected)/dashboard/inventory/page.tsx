import { For, ForWithWrapper } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { Badge, Table } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { cnJoin } from "@/lib/utils/cn";
import { Main } from "../-components/Main";

function InventoryPage() {
	return (
		<Main className="gap-10 px-12 pt-12">
			<InventoryHeader />
			<InventoryStats />
			<InventoryActions />

			<div className="flex flex-col gap-6 lg:flex-row">
				<InventoryTable />
				<ProjectedStockOut />
			</div>
		</Main>
	);
}

export default InventoryPage;

function InventoryHeader() {
	return (
		<header className="flex flex-col gap-1.5">
			<h1 className="text-[30px] font-extrabold tracking-tight text-black">Inventory</h1>
			<p className="text-[15px] font-medium text-vitastock-body-color">
				Manage stock levels, expirations, and suppliers.
			</p>
		</header>
	);
}
function InventoryStats() {
	return (
		<section className="flex flex-col gap-6 lg:flex-row">
			<div
				className="flex w-full items-center justify-between rounded-2xl bg-[#fafafa] p-6 shadow-sm
					ring-1 ring-shadcn-border/60"
			>
				<div className="flex flex-col gap-2">
					<h3 className="text-[13px] font-bold tracking-widest text-vitastock-body-color uppercase">
						Total Inventory Value
					</h3>
					<p className="text-[34px] leading-none font-extrabold tracking-tight text-black">
						$124,500.00
					</p>
				</div>

				<span
					className="grid size-14 place-items-center rounded-xl bg-vitastock-primary-main/15
						text-vitastock-primary-main"
				>
					<IconBox type="online" icon="lucide:dollar-sign" className="size-6" />
				</span>
			</div>

			<div
				className="flex w-full items-center justify-between rounded-2xl bg-[#fee2e2] p-6 shadow-sm
					ring-1 ring-[#fca5a5]"
			>
				<div className="flex flex-col gap-2">
					<h3 className="text-[13px] font-bold tracking-widest text-[#b91c1c] uppercase">
						Critical Supply Alerts
					</h3>
					<p className="text-[34px] leading-none font-extrabold tracking-tight text-[#b91c1c]">12</p>
					<p className="text-[13px] font-medium text-[#b91c1c]/90">Requires immediate restock</p>
				</div>

				<span className="grid size-14 place-items-center rounded-xl bg-[#b91c1c] text-white">
					<IconBox type="online" icon="lucide:triangle-alert" className="size-6" />
				</span>
			</div>
		</section>
	);
}

function InventoryActions() {
	return (
		<section className="flex items-center justify-between">
			<div className="flex items-center gap-4">
				<Button theme="secondary-outline" className="px-5 text-vitastock-primary-main">
					<IconBox type="online" icon="lucide:file-down" className="size-4.5" />
					Bulk Import
				</Button>
				<Button theme="secondary-outline" className="px-5 text-vitastock-primary-main">
					<IconBox type="online" icon="lucide:zap" className="size-4.5" />
					Quick Dispense
				</Button>
			</div>

			<Button className="px-6">
				<IconBox type="online" icon="lucide:plus" className="size-4.5" />
				Add Stock
			</Button>
		</section>
	);
}

const inventoryData = [
	{
		batchNo: "BATCH-A492",
		drugName: "Amoxicillin 500mg",
		expiry: "Dec 2025",
		status: "normal",
		stock: "1,240",
		unit: "caps",
	},
	{
		batchNo: "BATCH-L110",
		drugName: "Lisinopril 10mg",
		expiry: "Nov 2024",
		status: "expired",
		stock: "850",
		unit: "tabs",
	},
	{
		batchNo: "BATCH-M993",
		drugName: "Metformin 1000mg",
		expiry: "Jan 2026",
		status: "low-stock",
		stock: "12",
		unit: "tabs",
	},
	{
		batchNo: "BATCH-AT22",
		drugName: "Atorvastatin 20mg",
		expiry: "Mar 2026",
		status: "normal",
		stock: "3,100",
		unit: "tabs",
	},
	{
		batchNo: "BATCH-LV05",
		drugName: "Levothyroxine 50mcg",
		expiry: "Aug 2025",
		status: "low-stock",
		stock: "45",
		unit: "tabs",
	},
];

const columns = ["Drug Name", "Batch No.", "Expiry", "Available Stock", "Action"] as const;

function InventoryTable() {
	return (
		<section className="flex w-full flex-col rounded-2xl bg-white shadow-sm ring-1 ring-shadcn-border/60">
			<header className="flex items-center justify-between border-b border-shadcn-border/50 p-5">
				<h2 className="text-[16px] font-bold text-black">Current Stock</h2>
				<Button
					unstyled={true}
					className="text-vitastock-body-color transition-colors hover:text-vitastock-primary-main"
				>
					<IconBox type="online" icon="lucide:filter" className="size-5" />
				</Button>
			</header>

			<Table.Root>
				<Table.Header>
					<Table.Row className="border-b-shadcn-border/50 hover:bg-transparent">
						<For
							each={columns}
							renderItem={(column) => (
								<Table.Head
									key={column}
									className={cnJoin(
										`h-12 px-5 text-[12px] font-bold tracking-wider text-vitastock-body-color/70
										uppercase`,
										column === "Action" && "text-right"
									)}
								>
									{column}
								</Table.Head>
							)}
						/>
					</Table.Row>
				</Table.Header>

				<Table.Body>
					<For
						each={inventoryData}
						renderItem={(item) => (
							<Table.Row
								key={item.batchNo}
								className={cnJoin(
									"border-b-shadcn-border/30 last:border-0 hover:bg-shadcn-muted/20",
									item.status === "expired" && "bg-[#fee2e2]/30 hover:bg-[#fee2e2]/50",
									item.status === "low-stock" && "bg-[#ffedd5]/30 hover:bg-[#ffedd5]/50"
								)}
							>
								<Table.Cell className="px-5 py-4 text-[14px] font-medium text-black">
									{item.drugName}
								</Table.Cell>
								<Table.Cell className="px-5 py-4 text-[14px] text-vitastock-body-color">
									{item.batchNo}
								</Table.Cell>
								<Table.Cell className="px-5 py-4">
									<div className="flex items-center gap-2.5">
										<span
											className={cnJoin(
												"text-[14px] text-vitastock-body-color",
												item.status === "expired" && "font-semibold text-[#b91c1c]"
											)}
										>
											{item.expiry}
										</span>
										{item.status === "expired" && (
											<Badge
												className="border-none bg-[#b91c1c] px-2 py-0.5 text-[11px]
													font-semibold tracking-wide text-white hover:bg-[#b91c1c]/90"
											>
												<IconBox
													type="online"
													icon="lucide:triangle-alert"
													className="size-3"
												/>
												Expired
											</Badge>
										)}
									</div>
								</Table.Cell>
								<Table.Cell className="px-5 py-4">
									<div className="flex items-center gap-3 text-[14px]">
										<span
											className={cnJoin(
												"font-medium text-black",
												item.status === "low-stock" && "font-bold text-[#c2410c]"
											)}
										>
											{item.stock}
										</span>
										<span className="text-vitastock-body-color">{item.unit}</span>
										{item.status === "low-stock" && (
											<Badge
												className="flex-col rounded-lg border-[#fdba74] bg-[#ffedd5] px-2
													py-0.5 text-[10px] leading-[1.1] font-bold text-[#c2410c]
													hover:bg-[#ffedd5]"
											>
												<span>Low</span>
												<span>Stock</span>
											</Badge>
										)}
									</div>
								</Table.Cell>
								<Table.Cell className="px-5 py-4 text-right">
									<Button
										unstyled={true}
										className="inline-flex p-1 text-vitastock-primary-main transition-colors
											hover:text-vitastock-primary-dark"
									>
										<IconBox type="online" icon="lucide:pencil" className="size-4.5" />
									</Button>
								</Table.Cell>
							</Table.Row>
						)}
					/>
				</Table.Body>
			</Table.Root>
		</section>
	);
}

const projectedStockouts = [
	{
		color: "text-[#dc2626]",
		drugName: "Metformin 1000mg",
		remaining: "2 days remaining",
	},
	{
		color: "text-[#d97706]",
		drugName: "Levothyroxine 50mcg",
		remaining: "5 days remaining",
	},
	{
		color: "text-[#d97706]",
		drugName: "Omeprazole 20mg",
		remaining: "6 days remaining",
	},
];

function ProjectedStockOut() {
	return (
		<section
			className="flex flex-col gap-5 rounded-2xl bg-[#fafafa] p-6 shadow-sm ring-1
				ring-shadcn-border/60"
		>
			<header className="flex flex-col gap-3">
				<div className="flex items-center gap-2.5">
					<IconBox type="online" icon="lucide:trending-down" className="size-5 text-[#d97706]" />
					<h2 className="font-bold text-black">Projected Stock-out</h2>
				</div>
				<p className="text-[14px] leading-relaxed text-vitastock-body-color">
					Items expected to deplete within 7 days based on current run rate.
				</p>
			</header>

			<ForWithWrapper
				className="flex flex-col gap-3"
				each={projectedStockouts}
				renderItem={(item) => (
					<li
						key={item.drugName}
						className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1
							ring-shadcn-border/40"
					>
						<div className="flex flex-col gap-1">
							<h4 className="text-[14px] font-medium text-black">{item.drugName}</h4>
							<p className={cnJoin("text-[13px] font-medium", item.color)}>{item.remaining}</p>
						</div>
						<Button
							unstyled={true}
							className="text-[13px] font-bold text-vitastock-primary-main transition-colors
								hover:text-vitastock-primary-dark"
						>
							Reorder
						</Button>
					</li>
				)}
			/>
		</section>
	);
}
