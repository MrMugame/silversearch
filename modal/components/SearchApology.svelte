<script lang="ts">
    import { onMount } from "svelte";
    import ProgressBar from "./ProgressBar.svelte";

    let progress: null | { done: number, all: number } = $state(null);
    let percentage = $derived.by(() => progress ? progress.done / progress.all * 100 : null);

    onMount(() => {
		const interval = setInterval(async () => {
            const result = await syscall("clientStore.get", "silversearch-progress");
            if (!result) return;

            progress = result;
        }, 50);

		return () => clearInterval(interval);
	});
</script>

<div class="silversearch-apology">
    <ProgressBar progress={percentage}/>
    {#if progress !== null}
        <p>Indexed <code>{progress.done}</code> out of <code>{progress.all}</code> documents</p>
    {:else}
        <p>Loading ...</p>
    {/if}
</div>

<style>
    .silversearch-apology {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 1em;
    }

    .silversearch-apology p {
        margin: 0px;
    }
</style>

