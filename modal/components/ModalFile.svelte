<script lang="ts">
    import type { ResultExcerpt, ResultPage, SearchMatch } from "../../shared/global";
    import ModalContainer from "./ModalContainer.svelte";
    import { highlightText } from "../util/highlighting";

    let {
        currentPath,
    }: { currentPath: string } = $props();

    // svelte-ignore non_reactive_update
    let matches: SearchMatch[] = [];
    let name: string | null = null;

    async function search(query: string): Promise<ResultExcerpt[]> {
        let result = await syscall(
            "silversearch.search",
            query,
            { singleFilePath: currentPath, silent: true },
        ) as ResultPage[];

        matches = result[0].matches;
        name = result[0].name;
        return result[0].excerpts;
    }

    async function open(result: ResultExcerpt, openInNewTab: boolean, _: boolean) {
        if (!name) return;

        await syscall(
            "editor.navigate",
            `${name}@${result.offset}`,
            false,
            openInNewTab,
        );
    }
</script>

<ModalContainer
    {search}
    {open}
>
    {#snippet helpText()}
        Press <code>Ctrl-Enter</code> to open in new Tab. Use <code>Tab</code> to switch scope.
    {/snippet}

    {#snippet elementDescription(excerpt: ResultExcerpt)}
        {@html highlightText(excerpt.excerpt, matches)}
    {/snippet}
</ModalContainer>
