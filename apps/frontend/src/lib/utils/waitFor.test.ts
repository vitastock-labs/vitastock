import { waitFor as toolkitWaitFor } from "@zayne-labs/toolkit-core";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { waitFor } from "./waitFor";

const withResolversDescriptor = Object.getOwnPropertyDescriptor(Promise, "withResolvers");

beforeEach(() => {
	vi.useFakeTimers();
	Reflect.deleteProperty(Promise, "withResolvers");
});

afterEach(() => {
	vi.useRealTimers();

	if (withResolversDescriptor) {
		Object.defineProperty(Promise, "withResolvers", withResolversDescriptor);
	}
});

test("toolkit-core's waitFor crashes without Promise.withResolvers", () => {
	expect(() => toolkitWaitFor(500)).toThrow(TypeError);
});

test("resolves after the delay without Promise.withResolvers", async () => {
	const onResolve = vi.fn();

	void waitFor(500)?.then(onResolve);

	await vi.advanceTimersByTimeAsync(499);
	expect(onResolve).not.toHaveBeenCalled();

	await vi.advanceTimersByTimeAsync(1);
	expect(onResolve).toHaveBeenCalledOnce();
});

test("accepts the toolkit's seconds and milliseconds delay objects", async () => {
	const onSecondsResolve = vi.fn();
	const onMillisecondsResolve = vi.fn();

	void waitFor({ seconds: 2 })?.then(onSecondsResolve);
	void waitFor({ milliseconds: 300 })?.then(onMillisecondsResolve);

	await vi.advanceTimersByTimeAsync(300);
	expect(onMillisecondsResolve).toHaveBeenCalledOnce();
	expect(onSecondsResolve).not.toHaveBeenCalled();

	await vi.advanceTimersByTimeAsync(1700);
	expect(onSecondsResolve).toHaveBeenCalledOnce();
});

test("returns undefined for a zero delay, like the toolkit", () => {
	expect(waitFor(0)).toBeUndefined();
});
