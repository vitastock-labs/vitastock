import { For } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { Badge, Button, Table } from "@/components/ui";
import { Form } from "@/components/ui/form";
import { cnJoin } from "@/lib/utils/cn";
import { Main } from "../-components/Main";

function ReportsPage() {
	return (
		<Main className="gap-10 px-12 pt-12">
			<ReportsHeader />
			<ReportsStats />
			<ReportsLog />
		</Main>
	);
}

export default ReportsPage;

function ReportsHeader() {
	return (
		<header className="flex flex-col gap-1.5">
			<h1 className="text-[30px] font-extrabold tracking-tight text-black">Reports</h1>
			<p className="text-[15px] font-medium text-vitastock-body-color/80">
				Manage usage reports and stock activity.
			</p>
		</header>
	);
}

function ReportsStats() {
	return (
		<section className="grid grid-cols-1 gap-6 md:grid-cols-3">
			<div
				className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-shadcn-border/60"
			>
				<div className="flex items-center justify-between">
					<h3 className="text-[14px] font-medium text-vitastock-body-color">Total Dispensed (30d)</h3>
					<IconBox type="online" icon="lucide:link" className="size-5 text-vitastock-primary-main" />
				</div>
				<div className="flex flex-col gap-2">
					<p className="text-[34px] leading-none font-extrabold tracking-tight text-black">12,450</p>
					<div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#16a34a]">
						<IconBox type="online" icon="lucide:arrow-up" className="size-3.5" />
						<span>8.2% vs last month</span>
					</div>
				</div>
			</div>

			<div
				className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-shadcn-border/60"
			>
				<div className="flex items-center justify-between">
					<h3 className="text-[14px] font-medium text-vitastock-body-color">Unique Patients</h3>
					<IconBox type="online" icon="lucide:users" className="size-5 text-vitastock-primary-main" />
				</div>
				<div className="flex flex-col gap-2">
					<p className="text-[34px] leading-none font-extrabold tracking-tight text-black">3,102</p>
					<div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#16a34a]">
						<IconBox type="online" icon="lucide:arrow-up" className="size-3.5" />
						<span>2.4% vs last month</span>
					</div>
				</div>
			</div>

			<div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#fca5a5]/70">
				<div className="flex items-center justify-between">
					<h3 className="text-[14px] font-medium text-[#dc2626]">Low Stock Alerts</h3>
					<IconBox type="online" icon="lucide:triangle-alert" className="size-5 text-[#dc2626]" />
				</div>
				<div className="flex flex-col gap-2">
					<p className="text-[34px] leading-none font-extrabold tracking-tight text-[#dc2626]">14</p>
					<p className="text-[13px] font-semibold text-vitastock-body-color">
						Requires immediate attention
					</p>
				</div>
			</div>
		</section>
	);
}

const dispensingLogs = [
	{
		drug: "Amoxicillin",
		patientName: "John Henderson",
		prescribedBy: "Dr. Sarah Wilson",
		status: "Dispensed",
		timestamp: "2023-10-27 14:32:01",
	},
	{
		drug: "Lisinopril",
		patientName: "Emily Rodriguez",
		prescribedBy: "Dr. Robert Chen",
		status: "Dispensed",
		timestamp: "2023-10-27 14:28:45",
	},
	{
		drug: "Atorvastatin",
		patientName: "Michael Thompson",
		prescribedBy: "Dr. Sarah Wilson",
		status: "Pending Verification",
		timestamp: "2023-10-27 14:15:22",
	},
	{
		drug: "Metformin",
		patientName: "Sarah Parker",
		prescribedBy: "Dr. James Miller",
		status: "Dispensed",
		timestamp: "2023-10-27 13:55:10",
	},
	{
		drug: "Omeprazole",
		patientName: "David Miller",
		prescribedBy: "Dr. Robert Chen",
		status: "Failed - Out of Stock",
		timestamp: "2023-10-27 13:42:05",
	},
];

const columns = ["Timestamp", "Drug", "Prescribed By", "Patient Name", "Status"] as const;

function ReportsLog() {
	return (
		<section className="flex flex-col rounded-2xl bg-white shadow-sm ring-1 ring-shadcn-border/60">
			<header
				className="flex flex-col gap-5 border-b border-shadcn-border/50 p-6 lg:flex-row lg:items-center
					lg:justify-between"
			>
				<div className="flex flex-col gap-1">
					<h2 className="text-[18px] font-bold text-black">Dispensing Log</h2>
					<p className="text-[14px] text-vitastock-body-color">
						Recent medication dispensing events across all stations.
					</p>
				</div>

				<div className="flex items-center gap-4">
					<Form.InputGroup
						className="h-10 w-full max-w-[320px] gap-2 rounded-lg border-none bg-shadcn-muted/40 px-3
							text-[14px] ring-1 ring-transparent transition-all focus-within:bg-white
							focus-within:ring-vitastock-primary-main/50"
					>
						<Form.InputLeftItem>
							<IconBox icon="lucide:search" className="size-4.5" />
						</Form.InputLeftItem>
						<Form.InputPrimitive
							type="search"
							placeholder="Search logs..."
							className="h-full placeholder:text-[14px]"
						/>
					</Form.InputGroup>

					<Button theme="secondary-outline" className="h-10 px-5 font-semibold">
						<IconBox type="online" icon="lucide:list-filter" className="size-4" />
						Filter
					</Button>
					<Button className="h-10 px-5 font-semibold">
						<IconBox type="online" icon="lucide:download" className="size-4" />
						Export
					</Button>
				</div>
			</header>

			<Table.Root>
				<Table.Header className="bg-[#f8fafc]">
					<Table.Row className="border-b-shadcn-border/50 hover:bg-transparent">
						<For
							each={columns}
							renderItem={(column) => (
								<Table.Head
									key={column}
									className="h-12 px-6 text-[12px] font-bold tracking-wider
										text-vitastock-body-color/80 uppercase"
								>
									{column}
								</Table.Head>
							)}
						/>
					</Table.Row>
				</Table.Header>

				<Table.Body>
					<For
						each={dispensingLogs}
						renderItem={(item) => (
							<Table.Row
								key={item.timestamp}
								className="border-b-shadcn-border/30 last:border-0 hover:bg-shadcn-muted/20"
							>
								<Table.Cell
									className="px-6 py-5 font-mono text-[13px] whitespace-nowrap text-black/70"
								>
									{item.timestamp}
								</Table.Cell>
								<Table.Cell className="px-6 py-5 text-[14px] font-medium text-black">
									{item.drug}
								</Table.Cell>
								<Table.Cell className="px-6 py-5 text-[14px] text-vitastock-body-color">
									{item.prescribedBy}
								</Table.Cell>
								<Table.Cell className="px-6 py-5 text-[14px] text-vitastock-body-color">
									{item.patientName}
								</Table.Cell>
								<Table.Cell className="px-6 py-5">
									<Badge
										className={cnJoin(
											"border-none px-2.5 py-1 text-[12px] font-bold",
											item.status === "Dispensed"
												&& "bg-[#dcfce7]/60 text-[#166534] hover:bg-[#dcfce7]/80",
											item.status === "Pending Verification"
												&& "bg-[#fef9c3]/80 text-[#854d0e] hover:bg-[#fef9c3]",
											item.status === "Failed - Out of Stock"
												&& "bg-[#fee2e2]/60 text-[#991b1b] hover:bg-[#fee2e2]/80"
										)}
									>
										<span
											className={cnJoin(
												"size-1.5 rounded-full",
												item.status === "Dispensed" && "bg-[#166534]",
												item.status === "Pending Verification" && "bg-[#ca8a04]",
												item.status === "Failed - Out of Stock" && "bg-[#dc2626]"
											)}
										/>
										{item.status}
									</Badge>
								</Table.Cell>
							</Table.Row>
						)}
					/>
				</Table.Body>
			</Table.Root>

			<footer className="flex items-center justify-between border-t border-shadcn-border/50 p-5">
				<p className="text-[14px] text-vitastock-body-color">Showing 1 to 5 of 1,245 entries</p>
				<div className="flex items-center gap-3">
					<Button
						theme="secondary-outline"
						className="h-9 px-4 font-semibold text-vitastock-body-color/50 shadow-none
							hover:bg-transparent"
					>
						Prev
					</Button>
					<Button theme="secondary-outline" className="h-9 px-4 font-semibold shadow-none">
						Next
					</Button>
				</div>
			</footer>
		</section>
	);
}
