import * as React from "react";
import { Button } from "react-email";

type EmailButtonProps = {
	children: React.ReactNode;
	href: string;
};

function EmailButton(props: EmailButtonProps) {
	const { children, href } = props;

	return (
		<Button
			className="inline-block rounded-full bg-vitastock-primary-main px-10 py-4 text-sm font-semibold
				text-white no-underline"
			href={href}
			// style={{
			// 	backgroundColor: "#819fe6",
			// 	borderRadius: "9999px",
			// 	color: "#ffffff",
			// 	display: "inline-block",
			// 	fontSize: "14px",
			// 	fontWeight: 600,
			// 	padding: "16px 40px",
			// 	textDecoration: "none",
			// }}
		>
			{children}
		</Button>
	);
}

export { EmailButton };
