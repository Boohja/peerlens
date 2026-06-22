// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	interface Window {
		kofiWidgetOverlay?: {
			draw: (
				username: string,
				options: {
					type: string;
					'floating-chat.donateButton.text': string;
					'floating-chat.donateButton.background-color': string;
					'floating-chat.donateButton.text-color': string;
				}
			) => void;
		};
	}

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
