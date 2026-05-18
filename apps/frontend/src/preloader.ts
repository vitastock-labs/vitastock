import { lockScroll, on } from "@zayne-labs/toolkit-core";
import { APP_EVENTS } from "./lib/constants/event";

const removePreloader = () => {
	const preloaderElement = document.querySelector("#preloader");

	if (!preloaderElement) return;

	lockScroll({ lock: true, targetElement: () => document.documentElement });

	preloaderElement.classList.add("hidden");

	const timeoutId = setTimeout(() => {
		lockScroll({ lock: false, targetElement: () => document.documentElement });
	}, 800);

	on(
		preloaderElement,
		"transitionend",
		() => {
			preloaderElement.remove();
			clearTimeout(timeoutId);
		},
		{ once: true }
	);
};

on(document, APP_EVENTS.READY as never, removePreloader, { once: true });
