<script lang="ts">
    import type { ResultPage } from "../../shared/global.js";
    import { debounce } from "../util/debounce.js";
    import { solveNavigationMap } from "../util/mapSolver.js";
    import ModalContainer from "./ModalContainer.svelte";
    import ResultSpace from "./ResultSpace.svelte";
    import SearchTips from "./SearchTips.svelte";
    import ResultApology from "./ResultApology.svelte";
    import SearchApology from "./SearchApology.svelte";
    import { tick } from "svelte";

    let {
        query = $bindable(),
        isDocumentEditor,
    }: { query: string; isDocumentEditor: boolean } = $props();

    let results: ResultPage[] = $state([]);
    let searching = $state(false);

    let selectedIndex: number = $state(0);

    $effect(() => {
        if (query) {
            debounceUpdateResults();
        } else {
            results = [];
            searching = false;
        }
    });

    const debounceUpdateResults = debounce(updateResults, 0);

    // svelte-ignore non_reactive_update
    let waitPromise: PromiseWithResolvers<ResultPage[]> | null = null;
    async function updateResults() {
        searching = true;

        if (waitPromise) {
            waitPromise.reject("canceled");
            waitPromise = null;
        }

        waitPromise = Promise.withResolvers();

        try {
            results = await Promise.race([
                syscall("silversearch.search", query, { silent: true }) as Promise<ResultPage[]>,
                waitPromise.promise,
            ]);
            waitPromise = null;
            selectedIndex = 0;
            scrollIntoView();
            searching = false;
        } catch (_) {}
    }

    async function openSelected(openInNewTab: boolean) {
        if (results.length == 0) return;

        const result = results[selectedIndex];
        const offset = result.matches?.[0]?.offset ?? 0;

        let tail = `@${offset}`;
        if (result.navigationMap) {
            tail = solveNavigationMap(result.navigationMap, offset);
        }

        await syscall(
            "editor.navigate",
            `${result.name}${tail}`,
            false,
            openInNewTab,
        );

        await syscall("editor.hidePanel", "modal");
    }

    async function insertLink() {
        const result = results[selectedIndex];

        const link = `[[${result.name}]]`;

        await syscall("editor.insertAtCursor", link);

        await syscall("editor.hidePanel", "modal");
    }

    function onKeyDown(e: KeyboardEvent) {
        // TODO: Silverbullet supports quiete a few more here
        if (e.key === "ArrowUp") selectedIndex--;
        else if (e.key === "ArrowDown") selectedIndex++;
        else if (e.key === "Enter") {
            if (e.altKey) insertLink();
            else openSelected(e.ctrlKey);
        } else return;

        e.preventDefault();

        selectedIndex = Math.max(
            0,
            Math.min(results.length - 1, selectedIndex),
        );

        scrollIntoView();
    }

    async function scrollIntoView() {
        await tick();

        const element = document.querySelector(".silversearch-selected");

        if (!element) return;

        element.scrollIntoView({
            block: "nearest",
        });
    }
</script>

<ModalContainer onkeydown={onKeyDown} bind:query>
    {#snippet helpText()}
        Press <code>Ctrl-Enter</code> to open in new Tab and <code>Alt-Enter</code> to insert a link.
        {#if !isDocumentEditor}Use <code>Tab</code> to switch scope.{/if}
    {/snippet}

    {#snippet resultList()}
        {#each results as result, i}
            {@const isSelected = i === selectedIndex}
            <ResultSpace
                {result}
                selected={isSelected}
                onclick={({ ctrlKey }) => openSelected(ctrlKey)}
                onmousemove={() => (selectedIndex = i)}
            ></ResultSpace>
        {/each}

        {#if !results.length && !searching && query}
            <ResultApology/>
        {:else if !results.length && !searching}
            <SearchTips />
        {:else if !results.length && searching}
            <SearchApology />
        {/if}
    {/snippet}
</ModalContainer>
