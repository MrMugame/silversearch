import { editor, syscall } from "@silverbulletmd/silverbullet/syscalls";
import { IndexTreeEvent } from "@silverbulletmd/silverbullet/type/event";
import { Path } from "@silverbulletmd/silverbullet/lib/ref";

import script from "../dist/modal.iife.js.ts"
import html from "../dist/modal.html.ts"

import { SearchEngine } from "./util/searchengine.ts";
import { Query } from "./util/query.ts";
import { getPlugConfig } from "./util/settings.ts";
import { ResultPage } from "../shared/global.ts";
import { version } from "../dist/version.ts";

// So this will be a global variable in a service worker, so the lifetime is kind of uncertain, especially if
// we don't have direct access to events, i.e. we can't trust that this exists AT ALL
let searchEngine: SearchEngine | null = null;

type Action = {
    action: "delete" | "index",
    path: Path
}

let actionQueue: Action[] = [];

async function checkIfInitalized() {
    if (searchEngine) return;

    const settings = await getPlugConfig();
    // We want to try to load from cache, if that fails create the index and cache it
    searchEngine = await SearchEngine.loadFromCache(settings);

    if (!searchEngine) {
        searchEngine = await SearchEngine.create(settings);
        await searchEngine.reindex();
    } else if (actionQueue.length) {
        await searchEngine.indexByPaths(actionQueue.filter((action) => action.action === "index").map((action) => action.path));
        await searchEngine.deleteByPaths(actionQueue.filter((action) => action.action === "delete").map((action) => action.path));
        actionQueue = [];
    }
}

export async function openSearch(defaultQuery: string  = ""): Promise<void> {
    await editor.showPanel(
        "modal",
        // We can't have a falsy value (0) here, because of some silverbullet oddities
        1,
        html,
        defaultQuery ? `globalThis.DEFAULT_QUERY = ${JSON.stringify(defaultQuery)};` + script : script,
    );
}

export async function startSearch(): Promise<void> {
    await syscall("silversearch.openSearch");
}

export async function init(): Promise<void> {
    // Create it now as all systems should be fully initalized, so we can handle
    // all the queued paths
    await checkIfInitalized();
}

export async function indexPage({ name }: IndexTreeEvent) {
    // We piggyback of the index event here as that pretty much excatly aligns with our needs.
    const path: Path = `${name}.md`;
    if (!searchEngine) actionQueue.push({ action: "index", path });
    else await searchEngine.indexByPath(path);
}

export async function indexDocument(name: string) {
    const path: Path = name as Path;
    if (!searchEngine) actionQueue.push({ action: "index", path });
    else await searchEngine.indexByPath(path);
}

export async function deleted(path: Path) {
    if (!searchEngine) actionQueue.push({ action: "delete", path });
    else await searchEngine.deleteByPath(path);
}

export async function search(searchTerm: string, singleFilePath?: string): Promise<ResultPage[]> {
    await checkIfInitalized();

    const settings = await getPlugConfig();

    const query = new Query(searchTerm, {
      ignoreDiacritics: settings.ignoreDiacritics,
      ignoreArabicDiacritics: settings.ignoreArabicDiacritics,
    });

    return searchEngine!.getSuggestions(query, { singleFilePath });
}

export async function reindex() {
    await SearchEngine.deleteCache();
    searchEngine = null;

    await checkIfInitalized();
}

export async function showVersion() {
    await editor.flashNotification(`Silversearch - Version ${version}`);
}