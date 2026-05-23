import { useLocation } from "react-router";
import { IconBox } from "@/components/common/IconBox";
import { Button } from "@/components/ui";
import { Form } from "@/components/ui/form";

function DashboardHeader() {
	const pathname = useLocation().pathname;

	const getPlaceholder = () => {
		switch (pathname) {
			case "/dashboard":
			case "/dashboard/inventory": {
				return "Search inventory...";
			}
			case "/dashboard/alerts": {
				return "Search alerts...";
			}
			case "/dashboard/reports": {
				return "Search reports...";
			}
			case "/dashboard/settings": {
				return "Search settings...";
			}
			default: {
				return null;
			}
		}
	};

	const placeholder = getPlaceholder();

	return (
		<header className="flex justify-between gap-10 border-b border-[hsl(231,20%,80%,0.15)] px-6 py-7">
			<span className="invisible w-[28px]" />

			<Form.InputGroup
				className="h-10 w-full max-w-[576px] gap-3.5 justify-self-center rounded-[12px] border
					border-[hsl(231,20%,80%,0.3)] bg-white px-4 py-1 text-[14px]"
			>
				<Form.InputLeftItem>
					<IconBox type="online" icon="lucide:search" />
				</Form.InputLeftItem>

				{placeholder && (
					<Form.InputPrimitive
						type="search"
						placeholder={placeholder}
						className="h-full placeholder:text-[14px]"
					/>
				)}
			</Form.InputGroup>

			<div className="flex items-center gap-6">
				<Button unstyled={true} className="relative hover:text-vitastock-primary-main">
					<IconBox icon="lucide:bell" className="size-5" />
					<span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-shadcn-destructive" />
				</Button>

				<Button
					unstyled={true}
					className="flex size-9 items-center justify-center rounded-full bg-vitastock-primary-main
						text-white shadow-md"
				>
					<IconBox icon="lucide:user" className="size-4.5" />
				</Button>
			</div>
		</header>
	);
}

export { DashboardHeader };
