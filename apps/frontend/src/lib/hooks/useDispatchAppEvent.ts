import { useMountEffect } from "@zayne-labs/toolkit-react";
import { APP_EVENTS } from "../constants/event";

export const useDispatchAppEvent = () => {
	useMountEffect(() => {
		document.dispatchEvent(new Event(APP_EVENTS.READY));
		document.documentElement.dataset.appState = "ready";
	});
};
