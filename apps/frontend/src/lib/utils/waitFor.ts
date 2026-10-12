import {
	createPromiseWithResolversPolyfill,
	type waitFor as toolkitWaitFor,
} from "@zayne-labs/toolkit-core";
import { isNumber } from "@zayne-labs/toolkit-type-helpers";

type Delay = Parameters<typeof toolkitWaitFor>[0];

const getDelayInMs = (delay: Delay) => {
	if (isNumber(delay)) {
		return delay;
	}

	if (isNumber(delay.seconds)) {
		return delay.seconds * 1000;
	}

	return delay.milliseconds;
};

// == Same as toolkit-core's waitFor, which calls Promise.withResolvers (Chrome 119+, Safari 17.4+,
// == Firefox 121+) and crashes on older browsers. The polyfill builds on plain `new Promise`
const waitFor: typeof toolkitWaitFor = (delay) => {
	const { promise, resolve } = createPromiseWithResolversPolyfill();

	const delayInMs = getDelayInMs(delay);

	if (delayInMs === undefined || delayInMs === 0) return;

	setTimeout(resolve, delayInMs);

	return promise;
};

export { waitFor };
