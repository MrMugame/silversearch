<script lang="ts">
    import ModalFile from "./ModalFile.svelte";
    import ModalSpace from "./ModalSpace.svelte";

    const { defaultQuery, currentPage, isDocumentEditor }: { defaultQuery: string, currentPage: string, isDocumentEditor: boolean } = $props();

    let query = $state(defaultQuery);

    let spaceModal = $state(true);

    function onKeyDown(event: KeyboardEvent) {
        event.stopPropagation();
        if (event.key !== "Tab") return;

        if (isDocumentEditor) return;

        spaceModal = !spaceModal;

        event.preventDefault();
    }
</script>


<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onkeydown={onKeyDown}>
    {#if spaceModal}
        <ModalSpace bind:query isDocumentEditor={isDocumentEditor}/>
    {:else}
        <ModalFile bind:query currentPage={currentPage}/>
    {/if}
</div>