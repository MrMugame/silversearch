<script lang="ts">
    import type { Snippet } from "svelte";
    import type { MouseEventHandler } from "svelte/elements";

    const {
        title,
        description,
        info,
        selected,
        onclick,
        onmousemove,
    }: {
        title?: Snippet;
        description: Snippet;
        info?: Snippet;
        selected: boolean;
        onclick: MouseEventHandler<HTMLDivElement>;
        onmousemove: MouseEventHandler<HTMLDivElement>;
    } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="silversearch-option"
    class:silversearch-selected={selected}
    {onclick}
    {onmousemove}
>
    {#if title || info}
        <div class="silversearch-name">
            {#if title}
                <span class="silversearch-title">{@render title()}</span>
            {/if}
            {#if info}
                <span class="silversearch-info">{@render info()}</span>
            {/if}
        </div>
    {/if}
    <div class="silversearch-description">
        {@render description()}
    </div>
</div>

<style>
    .silversearch-option {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px;
        border-radius: var(--ui-radius-md);
        cursor: pointer;
    }

    .silversearch-option:hover:not(.silversearch-selected) {
        background-color: var(--subtle-background-color);
    }

    .silversearch-name {
        display: flex;
        align-items: baseline;
        gap: 1ch;
        min-width: 0;
    }

    .silversearch-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .silversearch-info {
        flex: none;
        color: var(--modal-description-color);
        font-size: 0.75em;
    }

    .silversearch-description {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
        line-clamp: 3;
        overflow: hidden;
        color: var(--modal-description-color);
        font-size: 0.75em;
        line-height: 1.5;
    }

    .silversearch-selected {
        color: var(--modal-selected-option-color);
        background-color: var(--modal-selected-option-background-color);
    }

    .silversearch-selected .silversearch-info,
    .silversearch-selected .silversearch-description {
        color: var(--modal-selected-option-description-color);
    }

    :global(.silversearch-highlight) {
        background-color: var(--editor-highlight-background-color);
    }
</style>
