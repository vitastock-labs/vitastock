import { z } from "zod";

export const sharedEnvSchema = z.object({
	BASE_BACKEND_HOST: z
		.literal(["https://api-vitastock.vercel.app", "https://api-vitastock.onrender.com"])
		.default("https://api-vitastock.vercel.app"),
	BASE_BACKEND_HOST_DEV: z.literal("http://localhost:8000").default("http://localhost:8000"),
	BASE_FRONTEND_HOST: z.literal("https://vitastock.vercel.app").default("https://vitastock.vercel.app"),
	BASE_FRONTEND_HOST_DEV: z.literal("http://localhost:3000").default("http://localhost:3000"),
	NODE_ENV: z.literal(["development", "production"]).default("development"),
});
