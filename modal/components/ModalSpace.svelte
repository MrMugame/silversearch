<script lang="ts">
    import type { ResultPage } from "../../shared/global.js";
    import { solveNavigationMap } from "../util/mapSolver.js";
    import ModalContainer from "./ModalContainer.svelte";
    import { highlightText } from "../util/highlighting.js";
    import { getContext } from "svelte";

    const isDocumentEditor: boolean = getContext("isDocumentEditor");

    async function open(result: ResultPage, openInNewTab: boolean, addLink: boolean) {
        if (addLink) return await insertLink(result);

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

    async function insertLink(result: ResultPage) {
        const link = `[[${result.name}]]`;

        await syscall("editor.insertAtCursor", link);

        await syscall("editor.hidePanel", "modal");
    }

    async function search(query: string): Promise<ResultPage[]> {
        return syscall("silversearch.search", query, { silent: true });
    }
</script>

<ModalContainer
    {search}
    {open}
>
    {#snippet helpText()}
        Press <code>Ctrl-Enter</code> to open in new Tab and <code>Alt-Enter</code> to insert a link.
        {#if !isDocumentEditor}Use <code>Tab</code> to switch scope.{/if}
    {/snippet}

    {#snippet elementTitle(element: ResultPage)}
        {@html highlightText(element.name, element.matchesName)}
    {/snippet}
    {#snippet elementDescription(element: ResultPage)}
        {@html highlightText(element.excerpts[0].excerpt, element.matches)}
    {/snippet}
    {#snippet elementInfo(element: ResultPage)}
        {element.matches.length} Matches
    {/snippet}
</ModalContainer>
