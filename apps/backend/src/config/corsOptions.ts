import type { cors } from "hono/cors";

const corsOptions = {
	credentials: true,
	origin: ["http://localhost:3000", "http://localhost:3001", "https://vitastock.vercel.app"],
} satisfies Parameters<typeof cors>[0];

export { corsOptions };
