<script lang="ts" generics="Element">
    import { tick, type Snippet } from "svelte";
    import ResultContainer from "./ResultContainer.svelte";
    import ResultApology from "./ResultApology.svelte";
    import SearchApology from "./SearchApology.svelte";
    import SearchTips from "./SearchTips.svelte";
    import { query } from "./query.svelte";

    let {
        search,
        open,

        helpText,

        elementTitle,
        elementDescription,
        elementInfo,
    }: {
        search: (query: string) => Promise<Element[]>;
        open: (element: Element, openInNewTab: boolean, openSpecial: boolean) => Promise<void>;

        helpText: Snippet;

        elementTitle?: Snippet<[Element]>;
        elementDescription: Snippet<[Element]>;
        elementInfo?: Snippet<[Element]>;
    } = $props();

    let dialog: HTMLDialogElement;

    // We can't use the `open` property on the dialog, because then some events don't fire
    $effect(() => {
        dialog.showModal();
    });

    function onClickWindow() {
        syscall("editor.hidePanel", "modal");
    }

    let results: Element[] = $state([]);
    let searching = $state(false);
    let selectedIndex = $state(0);

    $effect(() => {
        if (query.text) {
            updateResults();
        } else {
            results = [];
            searching = false;
        }
    });

    let cancelPromise: PromiseWithResolvers<never> | null = null;
    async function updateResults() {
        searching = true;

        if (cancelPromise) {
            cancelPromise.reject();
            cancelPromise = null;
        }
        cancelPromise = Promise.withResolvers();

        try {
            results = await Promise.race([
                search(query.text),
                cancelPromise.promise,
            ]);

            cancelPromise = null;
            selectedIndex = 0;
            scrollIntoView();
            searching = false;
        } catch {}
    }

    async function openSelected(openInNewTab: boolean, openSpecial: boolean) {
        if (results.length === 0) return;

        await open(results[selectedIndex], openInNewTab, openSpecial);
    }

    function onKeyDown(e: KeyboardEvent) {
        if (e.key === "ArrowUp") selectedIndex--;
        else if (e.key === "ArrowDown") selectedIndex++;
        else if (e.key === "Enter") {
            openSelected(e.ctrlKey, e.altKey);
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

<svelte:window onclick={onClickWindow} />

<dialog
    class="sb-modal-box"
    oncancel={(e: Event) => {
        e.preventDefault();
        syscall("editor.hidePanel", "modal");
    }}
    bind:this={dialog}
>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="sb-header"
        onclick={(e: Event) => e.stopPropagation()}
        onkeydown={onKeyDown}
    >
        <label for="mini-editor">Search</label>
        <div class="sb-mini-editor">
            <input
                id="mini-editor"
                placeholder="Search with Silversearch"
                autocomplete="off"
                bind:value={query.text}
            />
        </div>
    </div>
    <div class="sb-help-text">{@render helpText()}</div>
    <div class="sb-result-list" style="max-height: 80vh;">
        {#each results as result, i}
            <ResultContainer
                selected={i === selectedIndex}
                onclick={({ ctrlKey, altKey }) => openSelected(ctrlKey, altKey)}
                onmousemove={() => (selectedIndex = i)}
            >
                {#snippet title()}
                    {#if elementTitle}
                        {@render elementTitle(result)}
                    {/if}
                {/snippet}
                {#snippet description()}
                    {@render elementDescription(result)}
                {/snippet}
                {#snippet info()}
                    {#if elementInfo}
                        {@render elementInfo(result)}
                    {/if}
                {/snippet}
            </ResultContainer>
        {/each}

        {#if !results.length && !searching && query.text}
            <ResultApology/>
        {:else if !results.length && !searching}
            <SearchTips/>
        {:else if !results.length && searching}
            <SearchApology/>
        {/if}
    </div>
</dialog>

<style>
    dialog {
        outline: none;
    }

    #mini-editor {
        caret-color: var(--editor-caret-color);
        outline: none;
        border: none;
        padding: 2px 0 0 3px;
        line-height: 1.4;
        width: 100%;
        background: none;
        font-family: var(--ui-font);
        font-size: 1em;
        color: inherit;
    }
</style>
