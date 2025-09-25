<script lang="ts">
    import type { Snippet } from "svelte";
    import type { KeyboardEventHandler } from "svelte/elements";

    let {
        onkeydown,
        query = $bindable(),
        helpText,
        resultList,
    }: {
        onkeydown: KeyboardEventHandler<HTMLDivElement>;
        query: string;
        helpText: Snippet;
        resultList: Snippet;
    } = $props();

    let dialog: HTMLDialogElement;

    // We can't use the `open` property on the dialog, because then some events don't fire
    $effect(() => {
        dialog.showModal();
    });

    function onClickWindow() {
        syscall("editor.hidePanel", "modal");
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
        {onkeydown}
    >
        <label for="mini-editor">Search</label>
        <div class="sb-mini-editor">
            <input
                id="mini-editor"
                placeholder="Search with Silversearch"
                autocomplete="off"
                bind:value={query}
            />
        </div>
    </div>
    <div class="sb-help-text">{@render helpText()}</div>
    <div class="sb-result-list" style="max-height: 80vh;">
        {@render resultList()}
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
