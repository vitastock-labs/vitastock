import { on } from "@zayne-labs/toolkit-core";
import { APP_EVENTS } from "./lib/constants/event";

const removePreloader = () => {
	const preloaderElement = document.querySelector("#preloader");

	if (!preloaderElement) {
		document.documentElement.dataset.appState = "ready";
		return;
	}

	preloaderElement.classList.add("hidden");

	on(
		preloaderElement,
		"transitionend",
		() => {
			preloaderElement.remove();
			document.documentElement.dataset.appState = "ready";
		},
		{ once: true }
	);
};

on(document, APP_EVENTS.READY as never, removePreloader, { once: true });
