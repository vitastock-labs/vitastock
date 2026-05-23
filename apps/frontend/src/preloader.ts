import { on } from "@zayne-labs/toolkit-core";
import { APP_EVENTS } from "./lib/constants/event";

const removePreloader = () => {
	const preloaderElement = document.querySelector("#preloader");

	if (!preloaderElement) return;

	preloaderElement.classList.add("hidden");

	on(preloaderElement, "transitionend", () => preloaderElement.remove(), { once: true });
};

on(document, APP_EVENTS.READY as never, removePreloader, { once: true });
