<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		children: Snippet;
	};

	let { title, children }: Props = $props();

	let open = $state(false);
</script>

<div class="collapsible">
	<button class="collapsible-trigger" onclick={() => (open = !open)} aria-expanded={open}>
		<span class="collapsible-icon" aria-hidden="true">
    {#if open}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" color="currentColor" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
        <path d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z" />
        <path d="M16 12H8" />
      </svg>
    {:else}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" color="currentColor" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
        <path d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z" />
        <path d="M12 8V16M16 12H8" />
      </svg>
    {/if}
    </span>
		<span>{title}</span>
	</button>

	{#if open}
		<div class="collapsible-body">
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.collapsible {
		border-radius: 0.5rem;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.16);
	}

	.collapsible-trigger {
		all: unset;
		display: flex;
		align-items: center;
		gap: 0.55rem;
		width: 100%;
		box-sizing: border-box;
		padding: 0.75rem 1rem;
		cursor: pointer;
		font-weight: 600;
		font-size: 0.95rem;
		background: rgba(255, 255, 255, 0.08);
		transition: background 150ms ease;
	}

	.collapsible-trigger:hover {
		background: rgba(255, 255, 255, 0.14);
	}

	.collapsible-icon {
    width: 1.5rem;
	}
  .collapsible-icon svg {
    stroke: var(--primary);
  }

	.collapsible-body {
		padding: 0.85rem 1rem;
		background: rgba(255, 255, 255, 0.04);
		overflow-x: auto;
	}
</style>
