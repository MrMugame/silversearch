export let query = $state({
    text: "",
    buffer: "",
    historyIndex: -1,
    history: [] as string[] // Most recent is first
});