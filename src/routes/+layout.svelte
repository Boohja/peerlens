<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import Navbar from '$lib/Navbar.svelte';
	import ToastContainer from '$lib/ToastContainer.svelte';
	import { onMount } from 'svelte';
	import './layout.css';
	// import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	const bodyThemeClasses = ['theme-root', 'theme-viewer', 'theme-phone'];
	const kofiScriptSrc = 'https://storage.ko-fi.com/cdn/scripts/overlay-widget.js';

	let kofiObserver: MutationObserver | null = null;
	let cleanupKofiPositioning: (() => void) | null = null;
	let kofiRepositionFrame = 0;

	function resolveThemeClass(pathname: string) {
		if (pathname.startsWith('/viewer')) return 'theme-viewer';
		if (pathname.startsWith('/phone')) return 'theme-phone';
		return 'theme-root';
	}

	function applyBodyTheme(pathname: string) {
		if (typeof document === 'undefined') return;

		document.body.classList.remove(...bodyThemeClasses);
		document.body.classList.add(resolveThemeClass(pathname));
	}

	function positionKofiWidgetAtFooter() {
		const footerSlot = document.getElementById('kofi-footer-slot');
		const widget = document.querySelector<HTMLElement>('.floatingchat-container-wrap');

		if (!footerSlot || !widget) return;
		if (footerSlot.contains(widget)) {
			document.body.append(widget);
		}

		widget.classList.add('site-footer-kofi-widget');

		const slotRect = footerSlot.getBoundingClientRect();
		widget.style.left = `${window.scrollX + slotRect.left + slotRect.width / 2}px`;
		widget.style.top = `${window.scrollY + slotRect.top + slotRect.height / 2}px`;

		positionKofiPopupAtFooter(footerSlot);
	}

	function positionKofiPopupAtFooter(footerSlot: HTMLElement) {
		const gap = 12;
		const edgePadding = 12;
		const slotRect = footerSlot.getBoundingClientRect();
		const slotCenter = slotRect.left + slotRect.width / 2;
		const popups = document.querySelectorAll<HTMLElement>(
			'.floating-chat-kofi-popup-iframe, .floating-chat-kofi-popup-iframe-mobi'
		);

		popups.forEach((popup) => {
			const popupRect = popup.getBoundingClientRect();
			const isOpen = popupRect.width > 0 && popupRect.height > 0;

			if (!isOpen) return;

			const width = popupRect.width;
			const height = popupRect.height;
			const left = Math.min(
				Math.max(edgePadding, slotCenter - width / 2),
				window.innerWidth - width - edgePadding
			);
			const top = Math.max(edgePadding, slotRect.top - height - gap);

			popup.classList.add('site-footer-kofi-popup');
			popup.style.setProperty('left', `${left}px`, 'important');
			popup.style.setProperty('right', 'auto', 'important');
			popup.style.setProperty('top', `${top}px`, 'important');
			popup.style.setProperty('bottom', 'auto', 'important');
		});
	}

	function drawKofiWidget() {
		if (typeof window === 'undefined' || !window.kofiWidgetOverlay) return;

		if (!document.querySelector('.floatingchat-container-wrap')) {
			window.kofiWidgetOverlay.draw('boohja', {
				type: 'floating-chat',
				'floating-chat.donateButton.text': 'Support me',
				'floating-chat.donateButton.background-color': '#00b9fe',
				'floating-chat.donateButton.text-color': '#fff'
			});
		}

		const repositionKofiWidget = () => positionKofiWidgetAtFooter();
		const scheduleKofiReposition = () => {
			if (kofiRepositionFrame) return;

			kofiRepositionFrame = window.requestAnimationFrame(() => {
				kofiRepositionFrame = 0;
				positionKofiWidgetAtFooter();
			});
		};

		positionKofiWidgetAtFooter();
		window.setTimeout(positionKofiWidgetAtFooter, 400);
		window.setTimeout(positionKofiWidgetAtFooter, 1200);
		window.setTimeout(positionKofiWidgetAtFooter, 2200);
		window.addEventListener('resize', repositionKofiWidget);
		window.addEventListener('scroll', repositionKofiWidget, { passive: true });

		cleanupKofiPositioning = () => {
			window.removeEventListener('resize', repositionKofiWidget);
			window.removeEventListener('scroll', repositionKofiWidget);
			if (kofiRepositionFrame) {
				window.cancelAnimationFrame(kofiRepositionFrame);
				kofiRepositionFrame = 0;
			}
		};

		kofiObserver = new MutationObserver(scheduleKofiReposition);
		kofiObserver.observe(document.body, {
			attributes: true,
			attributeFilter: ['class', 'style'],
			childList: true,
			subtree: true
		});
	}

	function loadKofiWidget() {
		if (window.kofiWidgetOverlay) {
			drawKofiWidget();
			return;
		}

		const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${kofiScriptSrc}"]`);
		if (existingScript) {
			existingScript.addEventListener('load', drawKofiWidget, { once: true });
			return;
		}

		const script = document.createElement('script');
		script.src = kofiScriptSrc;
		script.async = true;
		script.addEventListener('load', drawKofiWidget, { once: true });
		document.body.append(script);
	}

	onMount(() => {
		applyBodyTheme(window.location.pathname);
		loadKofiWidget();

		return () => {
			document.body.classList.remove(...bodyThemeClasses);
			kofiObserver?.disconnect();
			cleanupKofiPositioning?.();
		};
	});

	onNavigate(({ to }) => {
		if (!to) return;
		applyBodyTheme(to.url.pathname);
	});
</script>

<svelte:head>
	<!-- <link rel="icon" href={favicon} /> -->
	<link rel="icon" type="image/png" href="/logo/favicon-96x96.png" sizes="96x96" />
	<link rel="icon" type="image/svg+xml" href="/logo/favicon.svg" />
	<link rel="shortcut icon" href="/logo/favicon.ico" />
	<link rel="apple-touch-icon" sizes="180x180" href="/logo/apple-touch-icon.png" />
	<meta name="apple-mobile-web-app-title" content="PeerLens" />
	<link rel="manifest" href="/logo/site.webmanifest" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
</svelte:head>

<div class="app-container">
	<ToastContainer />

	<Navbar />

	<main class="app-main">
		{@render children()}
	</main>

	<footer class="site-footer" aria-label="Site footer">
		<p class="site-footer-byline">by <a href="https://sorkos.net" target="_blank" rel="noopener noreferrer">sorkos.net</a></p>
		<div id="kofi-footer-slot" class="site-footer-kofi" aria-label="Support this project"></div>
		<div class="site-footer-links" aria-label="Legal links">
			<a href="/privacy">Privacy</a>
			<a href="/data">Data</a>
		</div>
	</footer>
</div>
