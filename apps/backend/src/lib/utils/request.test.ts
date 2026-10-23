import { Hono } from "hono";
import { expect, test } from "vitest";
import { getClientIp } from "./request";

const requestIp = async (headers: Record<string, string>, env?: unknown) => {
	const app = new Hono().get("/ip", (ctx) => ctx.text(getClientIp(ctx) ?? "undefined"));

	const response = await app.request("/ip", { headers }, env);

	return response.text();
};

test("getClientIp - prefers DigitalOcean's do-connecting-ip over x-forwarded-for", async () => {
	await expect(
		requestIp({ "do-connecting-ip": "203.0.113.10", "x-forwarded-for": "10.0.0.1" })
	).resolves.toBe("203.0.113.10");
});

test("getClientIp - falls back to the first x-forwarded-for entry, then x-real-ip", async () => {
	await expect(requestIp({ "x-forwarded-for": "203.0.113.10, 10.0.0.1" })).resolves.toBe("203.0.113.10");
	await expect(requestIp({ "x-real-ip": "203.0.113.11" })).resolves.toBe("203.0.113.11");
});

test("getClientIp - falls back to the socket address when no proxy header is present", async () => {
	const env = { incoming: { socket: { remoteAddress: "127.0.0.1" } } };

	await expect(requestIp({}, env)).resolves.toBe("127.0.0.1");
});

test("getClientIp - returns undefined only when neither headers nor a Node socket are available", async () => {
	await expect(requestIp({})).resolves.toBe("undefined");
});
