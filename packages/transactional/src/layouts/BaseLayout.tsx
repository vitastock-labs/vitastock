/* eslint-disable react/purity */
import * as React from "react";
import {
	Body,
	Container,
	Font,
	Head,
	Html,
	Img,
	pixelBasedPreset,
	Preview,
	Section,
	Tailwind,
	Text,
} from "react-email";
import { FRONTEND_URL } from "../constants";

type EmailLayoutProps = {
	children: React.ReactNode;
	preview: string;
};

export function BaseLayout(props: EmailLayoutProps) {
	const { children, preview } = props;

	return (
		<Html>
			<Head>
				<Font
					fontFamily="Work Sans"
					fallbackFontFamily="sans-serif"
					webFont={{
						format: "woff2",
						url: "https://fonts.gstatic.com/s/worksans/v19/QGY_z_wNahGAdqQ43RhVcIgYT2Xz5u32K0nZN08.woff2",
					}}
					fontWeight={400}
					fontStyle="normal"
				/>
				<Font
					fontFamily="Work Sans"
					fallbackFontFamily="sans-serif"
					webFont={{
						format: "woff2",
						url: "https://fonts.gstatic.com/s/worksans/v19/QGY_z_wNahGAdqQ43RhVcIgYT2Xz5u32K0nZN08.woff2",
					}}
					fontWeight={600}
					fontStyle="normal"
				/>
			</Head>

			<Preview>{preview}</Preview>

			<Tailwind
				config={{
					presets: [pixelBasedPreset],
					theme: {
						extend: {
							colors: {
								vitastock: {
									"body-color": "#434656",
									primary: {
										dark: "#0049C7",
										darker: "#11235F",
										glow: "rgb(81, 132, 251)",
										light: "#4A5D96",
										main: "#1F5CEA",
										subtle: "#ADC0FF",
									},
								},
							},
							fontFamily: {
								sans: ["Work Sans", "sans-serif"],
							},
						},
					},
				}}
			>
				<Body className="bg-slate-50 py-12 font-sans text-vitastock-body-color">
					<Container className="mx-auto max-w-145 px-4">
						<Section className="text-center">
							<Img
								src={`${FRONTEND_URL}/logo.png`}
								width="80"
								height="80"
								alt="VitaStock"
								className="mx-auto h-20 w-auto"
							/>
						</Section>

						<Section className="mt-8 rounded-3xl border border-slate-200 bg-white px-10 py-12">
							{children}
						</Section>

						<Section className="mt-10 text-center">
							<Text className="m-0 text-xs text-slate-500">
								© {new Date().getFullYear()} VitaStock. All rights reserved.
							</Text>
							<Text className="mt-2 text-xs text-slate-500">
								123 Pharmacy Avenue, Lagos, Nigeria
							</Text>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}
