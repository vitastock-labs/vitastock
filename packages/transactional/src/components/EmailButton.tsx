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
				text-white no-underline shadow-md"
			href={href}
		>
			{children}
		</Button>
	);
}

export { EmailButton };
