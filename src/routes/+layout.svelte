<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import Navbar from '$lib/Navbar.svelte';
	import ToastContainer from '$lib/ToastContainer.svelte';
	import { onMount } from 'svelte';
	import './layout.css';
	// import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	const bodyThemeClasses = ['theme-root', 'theme-viewer', 'theme-phone'];

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

	onMount(() => {
		applyBodyTheme(window.location.pathname);

		return () => {
			document.body.classList.remove(...bodyThemeClasses);
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
		<div class="site-footer-links" aria-label="Legal links">
			<a href="/privacy">Privacy</a>
			<a href="/data">Data</a>
		</div>
	</footer>
</div>
