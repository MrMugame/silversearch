<script lang="ts">
    import { getContext } from "svelte";
    import ModalFile from "./ModalFile.svelte";
    import ModalSpace from "./ModalSpace.svelte";
    import { query } from "./query.svelte"

    const {
        defaultQuery,
        currentPath,
        customStyles
    }: {
        defaultQuery: string;
        currentPath: string;
        customStyles: string;
    } = $props();

    syscall("clientStore.get", "silversearch-history").then((history: string[] | null) => {
        query.history = history || [];
    });

    const isDocumentEditor = getContext("isDocumentEditor");

    // svelte-ignore state_referenced_locally
    query.text = defaultQuery;

    let spaceModal = $state(true);

    function onKeyDown(event: KeyboardEvent) {
        event.stopPropagation();
        if (event.key !== "Tab") return;

        if (isDocumentEditor) return;

        spaceModal = !spaceModal;

        event.preventDefault();
    }
</script>

{@html customStyles}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onkeydown={onKeyDown}>
    {#if spaceModal}
        <ModalSpace />
    {:else}
        <ModalFile {currentPath} />
    {/if}
</div>
