import { z } from "zod";

export const sharedEnvSchema = z.object({
	BASE_BACKEND_HOST: z
		.literal([
			"https://api-vitastock.vercel.app",
			"https://api-vitastock.onrender.com",
			"https://api-vitastock-dev.onrender.com",
		])
		.default("https://api-vitastock-dev.onrender.com"),
	BASE_BACKEND_HOST_DEV: z.literal("http://localhost:8000").default("http://localhost:8000"),
	BASE_FRONTEND_HOST: z
		.literal(["https://vitastock.vercel.app", "https://vitastock-dev.vercel.app"])
		.default("https://vitastock-dev.vercel.app"),
	BASE_FRONTEND_HOST_DEV: z.literal("http://localhost:5173").default("http://localhost:5173"),
	NODE_ENV: z.literal(["development", "production", "test"]).default("development"),
});
