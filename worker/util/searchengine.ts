import { clientStore, editor, space } from "@silverbulletmd/silverbullet/syscalls";
import { DocumentMeta, PageMeta } from "@silverbulletmd/silverbullet/type/index";
import { SearchResult, Options, default as MiniSearch } from "minisearch"
import { Query } from "./query.ts";
import { getPlugConfig, SilversearchSettings } from "./settings.ts";
import { tokenizeForIndexing, tokenizeForSearch, Tokenizer } from "./tokenizer.ts";
import { getGroups, removeDiacritics, removeStrayDiacritics, stripMarkdownCharacters } from "./utils.ts";
import { CacheEntry, IndexableEntry, RecencyCutoff } from "./global.ts";
import { getMatches, makeExcerpt } from "./textprocessing.ts";
import { ResultExcerpt, ResultPage } from "../../shared/global.ts";
import { getNameFromPath, isMarkdownPath, Path } from "@silverbulletmd/silverbullet/lib/ref";
import { fileName, folderName } from "@silverbulletmd/silverbullet/lib/resolve";
import { extractContentByPath, ExtractionInfo } from "./extract.ts";

const cacheVersion = 4;

export class SearchEngine {
    private minisearch: MiniSearch;
    private entryCache: Map<string, CacheEntry>;
    private tokenizers: Tokenizer[];

    private constructor(settings: SilversearchSettings, tokenizers: Tokenizer[]) {
        this.minisearch = new MiniSearch(SearchEngine.getOptions(settings, tokenizers));
        this.entryCache = new Map();
        this.tokenizers = tokenizers;
    }

    public static async create(settings: SilversearchSettings): Promise<SearchEngine> {
        const tokenizers: Tokenizer[] = (await Promise.all(settings.tokenizers.map(async path => {
            return await Tokenizer.loadFromPath(path);
        }))).filter(t => t !== null);

        return new SearchEngine(settings, tokenizers);
    }

    public static async loadFromCache(settings: SilversearchSettings): Promise<SearchEngine | null> {
        const cache = await clientStore.get("silversearch-cache");

        if (!cache || cache.version !== cacheVersion || typeof (cache.minisearch) !== "string" || typeof (cache.entries) !== "object") {
            console.log("[Silversearch] Couldn't find cache or cache version mismatched");
            SearchEngine.deleteCache();

            return null;
        }

        const searchEngine = await this.create(settings);

        searchEngine.minisearch = await MiniSearch.loadJSONAsync(cache.minisearch, SearchEngine.getOptions(settings, searchEngine.tokenizers));

        searchEngine.entryCache = new Map(cache.entries)

        return searchEngine;
    }

    public static async deleteCache() {
        await clientStore.del("silversearch-cache");
    }

    public async writeToCache(): Promise<void> {
        await clientStore.set("silversearch-cache", {
            version: cacheVersion,
            minisearch: JSON.stringify(this.minisearch),
            entries: Array.from(this.entryCache.entries()).filter(entry => entry[1].cacheMode === "persistent"),
        });
    }

    public async reindex(): Promise<void> {
        await editor.flashNotification("Silversearch - Reindexing, this can cause performance problems");
        this.minisearch.removeAll();

        // We could also use listDocuments and listPages, overhead is probably
        // similar tho, but we would have to filter stuff like plugs ourselfs
        const files = (await space.listFiles())
            .map(file => file.name as Path)
            .filter(this.isIndexedPath);

        console.log(`[Silversearch] Indexing ${files.length} pages`);
        await editor.showProgress(0, "index");

        await this.indexByPaths(
            files,
            (done, all) => {
                // Don't await, we don't care
                editor.showProgress(Math.round(done / all * 100), "index");
            }
        )

        await editor.showProgress();
        await editor.flashNotification("Silversearch - Full reindex done!");
    }

    public async indexByPath(path: Path): Promise<void> {
        await this.indexByPaths([path]);
    }

    public async indexByPaths(paths: Path[], progressCallback?: (done: number, all: number) => void): Promise<void> {
        let done = 0;

        for (const path of paths) {
            try {
                console.log(`[Silversearch] Indexing ${getNameFromPath(path)}`);

                // Make sure we don't just get the entry from the cache
                this.entryCache.delete(path);

                const result = await this.getCacheEntry(path);
                if (!result) throw null;

                // TODO: Maybe use addAllAsync?
                // We can just send the full cache entry here as the rest will just be ignored
                if (this.minisearch.has(result.path)) this.minisearch.replace(result);
                else this.minisearch.add(result);

                if (progressCallback) progressCallback(++done, paths.length);
            } catch {
                console.warn(`[Silversearch] Failed to index ${getNameFromPath(path)}. Skipping!`);
            }
        }

        await this.writeToCache();
    }

    public async deleteByPath(path: Path): Promise<void> {
        await this.deleteByPaths([path]);
    }

    public async deleteByPaths(paths: Path[]): Promise<void> {
        for (const path of paths) {
            try {
                this.minisearch.discard(path);
            } catch {
                console.error("[Silversearch] Something went wrong. Failed to delete page")
            }
        }

        await this.writeToCache();
    }

    private async search(query: Query, options: { prefixLength: number, singleFilePath?: string }): Promise<SearchResult[]> {
        const settings = await getPlugConfig();

        if (query.isEmpty()) return [];

        const fuzziness: number = {
            "0": 0,
            "1": 0.1,
            "2": 0.2
        }[settings.fuzziness];

        const searchTokens = tokenizeForSearch(query.segmentsToStr(), { tokenizers: this.tokenizers })

        let results = this.minisearch.search(searchTokens, {
            prefix: term => term.length >= options.prefixLength,
            // length <= 3: no fuzziness
            // length <= 5: fuzziness of 10%
            // length > 5: fuzziness of 20%
            fuzzy: term =>
                term.length <= 3 ? 0 : term.length <= 5 ? fuzziness / 2 : fuzziness,
            boost: {
                basename: settings.weights.basename,
                aliases: settings.weights.aliases,
                displayName: settings.weights.displayName,
                directory: settings.weights.directory,
                tags: settings.weights.tags,
                unmarkedTags: settings.weights.tags
            },
            tokenize: text => [text],
            boostDocument(_id, _term, storedFields) {
                if (!storedFields?.lastModified || settings.recencyBoost === RecencyCutoff.Disabled) {
                    return 1;
                }
                const lastModified = storedFields?.lastModified as number;
                const now = new Date().getTime();
                const daysElapsed = (now - lastModified) / (24 * 3600 * 1000);

                // Documents boost
                const cutoff = {
                    [RecencyCutoff.Day]: -3,
                    [RecencyCutoff.Week]: -0.3,
                    [RecencyCutoff.Month]: -0.1,
                } as const;
                return 1 + Math.exp(cutoff[settings.recencyBoost] * (daysElapsed / 1000));
            }
        });

        // Filter query results to only keep files that match query.query.ext (if any)
        if (query.query.ext?.length) {
            results = results.filter(r => {
                // ".can" should match ".canvas"
                // If the document doesn't have an extension it's a page
                const ext = r.id.includes(".") ? "." + r.id.split('.').pop() : ".md";
                return query.query.ext?.some(e =>
                    ext.startsWith(e.startsWith('.') ? e : '.' + e)
                );
            });
        }

        // Filter query results that match the path
        if (query.query.path) {
            results = results.filter(r =>
                query.query.path?.some(p =>
                    (r.id as string).toLowerCase().includes(p.toLowerCase())
                )
            );
        }
        if (query.query.exclude.path) {
            results = results.filter(
                r =>
                    !query.query.exclude.path?.some(p =>
                        (r.id as string).toLowerCase().includes(p.toLowerCase())
                    )
            );
        }

        if (!results.length) {
            return [];
        }

        if (options.singleFilePath) {
            return results.filter(r => r.id === options.singleFilePath);
        }

        const documents = await this.getCacheEntries(results.map(result => result.id));

        // Extract tags from the query
        const tags = query.getTags();

        for (const result of results) {
            const path = result.id;
            const name = getNameFromPath(path);
            if (settings.downrankedFoldersFilters.length > 0) {
                // downrank files that are in folders listed in the downrankedFoldersFilters
                const downrankingFolder =
                    // Check that it matches a whole folder name, so we don't get partial matches
                    settings.downrankedFoldersFilters.some(filter => name === filter || name.startsWith(filter + '/')) ||
                    name.split('/').some(part => settings.downrankedFoldersFilters.includes(part));

                if (downrankingFolder) result.score /= 10;
            }


            const document = documents.find((d) => d.path === path);
            if (document) {
                // Boost custom properties
                for (const [name, weight] of Object.entries(settings.weightCustomProperties)) {
                    // Get frontmatter property
                    const values = document.metadata[name];
                    if (values && result.terms.some(t => values.includes(t))) {
                        result.score *= weight;
                    }
                }
            }

            // Put the results with tags on top
            for (const tag of tags) {
                if ((document?.tags ?? []).includes(tag)) {
                    result.score *= 100;
                }
            }
        }

        // Sort results and keep the 50 best
        results = results.sort((a, b) => b.score - a.score).slice(0, 50);

        // If the search query contains quotes, filter out results that don't have the exact match
        const exactTerms = query.getExactTerms();
        if (exactTerms.length) {
            results = results.filter(r => {
                const document = documents.find(d => d.path === r.id);
                const title = document?.name.toLowerCase() ?? "";
                const content = (document?.cleanedContent ?? "").toLowerCase();
                return exactTerms.every(
                    q =>
                        content.includes(q) ||
                        removeDiacritics(
                            title,
                            settings.ignoreArabicDiacritics
                        ).includes(q)
                );
            });
        }

        // If the search query contains exclude terms, filter out results that have them
        const exclusions = query.query.exclude.text;
        if (exclusions.length) {
            results = results.filter(r => {
                const content = (
                    documents.find(d => d.path === r.id)?.content ?? ""
                ).toLowerCase();
                return exclusions.every(q => !content.includes(q));
            });
        }

        return results;
    }

    public async getSuggestions(
        query: Query,
        options?: Partial<{ singleFilePath?: string }>
    ): Promise<ResultPage[]> {
        const results = await this.search(query, {
            prefixLength: 1,
            singleFilePath: options?.singleFilePath,
        });

        const documents = await this.getCacheEntries(results.map(result => result.id));

        // Map the raw results to get usable suggestions
        const resultNotes = await Promise.all(results.map(async result => {
            const note = documents.find(d => d.path === result.id)
            if (!note) {
                console.warn(`[Silversearch] Note "${result.name}" disappeared. Skipping`);
                return null;
            }

            // Clean search matches that match quoted expressions,
            // and inject those expressions instead
            const foundWords = [
                // Matching terms from the result,
                // do not necessarily match the query
                ...result.terms,

                // Quoted expressions
                ...query.getExactTerms(),

                // Tags, starting with #
                ...query.getTags(),
            ]

            const matches = await getMatches(
                note.content,
                foundWords,
                query
            );

            // Generating these here is a little performance heavy but safes us from having a lot of doubled code in the frontend
            const matchesName = await getMatches(
                note.name,
                foundWords
            );

            let excerpts: ResultExcerpt[];

            if (options?.singleFilePath) {
                let groups = getGroups(matches);

                // If there are quotes in the search,
                // only show results that match at least one of the quotes
                const exactTerms = query.getExactTerms()
                if (exactTerms.length) {
                    groups = groups.filter(group =>
                        exactTerms.every(exact =>
                            group.some(match => match.match.includes(exact))
                        )
                    )
                }

                const groupedOffsets = groups.map(group => Math.round(group.at(0)!.offset));

                excerpts = await Promise.all(groupedOffsets.map(offset => makeExcerpt(note?.content ?? "", offset)));
            } else {
                excerpts = [await makeExcerpt(
                    note.content,
                    matches[0]?.offset ?? 0
                )];
            }

            const resultNote: ResultPage = {
                score: result.score,
                foundWords,
                matches,
                matchesName,
                excerpts,
                name: note.name,
                basename: note.basename,
                content: note.content,
                navigationMap: note.navigationMap,
            };
            return resultNote;
        }));

        return resultNotes.filter(result => result !== null);
    }

    private runningCacheProcesses: Map<Path, Promise<CacheEntry | null>> = new Map();
    private async getCacheEntries(paths: Path[]): Promise<CacheEntry[]> {
        // Due to the way deboucing works on the frontend, this can be called
        // multiple times, this could lead to multiple fetches for e.g. pdfs and
        // a big traffic jam, because it would render a pdf 10 times. To
        // mitigate this, we'll cache the promises in the
        // `runningCacheProcesses` map. This is a little cursed, but increases
        // the load times quite a bit
        const promises = paths.map(async path => {
            if (this.runningCacheProcesses.has(path)) {
                return this.runningCacheProcesses.get(path);
            }

            const promise = this.getCacheEntry(path);
            this.runningCacheProcesses.set(path, promise);

            const entry = await promise;
            this.runningCacheProcesses.delete(path);
            return entry;
        });

        const entries = await Promise.all(promises);

        return entries.filter(entry => !!entry);
    }

    private async getCacheEntry(path: Path): Promise<CacheEntry | null> {
        let meta: PageMeta | DocumentMeta;

        const cached = this.entryCache.get(path);
        // Don't compare timestamps here, we will trust that the minisearch
        // index and our entryCache is in sync
        if (cached) {
            return cached;
        }

        try {
            const name = getNameFromPath(path);

            meta = isMarkdownPath(path)
                ? await space.getPageMeta(name)
                : await space.getDocumentMeta(name);
        } catch {
            console.log("[Silversearch] Couldn't find the specified file:", path);

            return null;
        }

        const result = await SearchEngine.pathToIndexableEntry(path, meta);
        if (!result) return null;

        // TODO: This is cursed, move this out of here
        const metadata = Object.fromEntries(Object.entries(meta).filter(([key, _]) => !["ref", "tag", "tags", "itags", "name", "created", "lastModified", "perm", "lastOpened", "pageDecoration", "aliases", "extension", "size", "contentType"].includes(key)));

        const entry = {
            ...result.entry,
            ...result.info,
            cleanedContent: stripMarkdownCharacters(removeDiacritics(result.entry.content)),
            metadata,
            tags: meta.tags?.map((tag) => "#" + tag) ?? [],
        }

        this.entryCache.set(path, entry);

        return entry;
    }

    private static async pathToIndexableEntry(path: Path, cachedMeta?: PageMeta | DocumentMeta): Promise<{ entry: IndexableEntry, info: ExtractionInfo } | null> {
        const name = getNameFromPath(path);

        let meta;
        try {
            meta = cachedMeta ?? (isMarkdownPath(path) ? await space.getPageMeta(name) : await space.getDocumentMeta(name));
        } catch {
            return null;
        }

        const result = await extractContentByPath(path, meta);
        if (!result) {
            return null;
        }

        // Remove any stray diatrics. Not doing this could cause problems
        // later when removing diatrics in e.g. `getMatches`, because the
        // offsets won't match between the cleaned string and the original
        // string
        const content = removeStrayDiacritics(result.content);

        const entry: IndexableEntry = {
            path,
            name,
            content,
            basename: fileName(name),
            directory: folderName(name),
            aliases: meta.aliases ?? [],
            displayName: meta.displayName ?? "",
            unmarkedTags: meta.tags ?? [],
            lastModified: new Date(meta.lastModified).getTime(),
        };

        const { content: _, ...info } = result;
        return { entry, info };
    }

    private isIndexedPath(path: Path) {
        return !path.endsWith(".plug.js");
    }

    private static getOptions(settings: SilversearchSettings, tokenizers: Tokenizer[]): Options<IndexableEntry> {
        return {
            tokenize: (text: string) => tokenizeForIndexing(text, { tokenizers, tokenizeUrls: settings.tokenizeUrls }),
            processTerm: (term: string) => (settings.ignoreDiacritics
                ? removeDiacritics(term, settings.ignoreArabicDiacritics)
                : term
            ).toLowerCase(),
            idField: "path",
            fields: [
                "content",
                "basename",
                "directory",
                "aliases",
                "displayName",
                "unmarkedTags"
            ],
            storeFields: [
                "lastModified",
            ]
        }
    }
}