import { splitCamelCase, splitHyphens } from "./utils";
import { QueryCombination } from "minisearch";
import { extractMdLinks } from "md-link-extractor";
import { BRACKETS_AND_SPACE, SPACE_OR_PUNCTUATION } from "./global";
import * as v from "valibot"
import { TokenizerConfig, tokenizerConfigSchema } from "./settings";
import { space } from "@silverbulletmd/silverbullet/syscalls";

type TokenizerImplementation = {
    init: (config: TokenizerConfig) => Promise<void>,
    isTokenizable: (text: string) => boolean,
    tokenize: (text: string) => string[]
}

const tokenizerImplementationSchema = v.strictObject({
    init: v.pipe(
        v.function(),
        v.args(v.tuple([tokenizerConfigSchema])),
        v.returnsAsync(v.void())
    ),
    isTokenizable: v.pipe(
        v.function(),
        v.args(v.tuple([v.string()])),
        v.returns(v.boolean())
    ),
    tokenize: v.pipe(
        v.function(),
        v.args(v.tuple([v.string()])),
        v.returns(v.array(v.string()))
    )
});

export class Tokenizer {
    private constructor(private readonly implementation: TokenizerImplementation) {}

    public static async loadFromPath(path: string, config: TokenizerConfig): Promise<Tokenizer | null> {
        let module;
        try {
            const code = await space.readDocument(path) as Uint8Array<ArrayBuffer>;
            const blob = new Blob([code], { type: "text/javascript" });
            const url = URL.createObjectURL(blob);

            module = await import(url);

            URL.revokeObjectURL(url);
        } catch {
            console.warn(`[Silversearch] Failed to load tokenizer at ${path}. Maybe the path is wrong?`);
            return null;
        }

        const result = v.safeParse(tokenizerImplementationSchema, module);

        if (result.success) {
            const tokenizer = new Tokenizer(result.output satisfies TokenizerImplementation);
            await tokenizer.implementation.init(config);

            return tokenizer;
        } else {
            console.warn(`[Silversearch] Failed to load tokenizer at ${path}. \n ${v.summarize(result.issues)}`);
            return null;
        }
    }

    public tryTokenization(text: string): string[] | null {
        try {
            if (this.implementation.isTokenizable(text)) {
                return this.implementation.tokenize(text);
            }
        } catch (e) {
            console.warn(`[Silversearch] Tokenizer failed with error ${e}. Ignoring!`);
        }

        return null;
    }
}

export function tokenizeForIndexing(text: string, options: { tokenizers: Tokenizer[], tokenizeUrls: boolean }): string[] {
    try {
        const words = tokenizeWords(text, options.tokenizers);

        let urls: string[] = [];
        if (options.tokenizeUrls) {
            // Would love to use silverbullet here, but we can't introduce async here
            urls = extractMdLinks(text).map(link => link.href);
        }

        const tokens = tokenizeTokens(text)
            .flatMap(token => [
                token,
                ...splitHyphens(token),
                ...splitCamelCase(token),
            ]);

        // Just throw all methods of tokenization at the problem and hope some
        // stuff sticks. Unsure if this is really the best approach here, but
        // it's the one omnisearch chooses
        const all = [
            ...tokens,
            ...words,
            ...urls,
        ];

        // Omnisearch removed this too
        // My guess would be that keeping doubled tokens improves search results
        // all = [...new Set(all)];

        return all;
    } catch (e) {
        console.error("[Silversearch] Error tokenizing text, skipping document", e);
        return [];
    }
}

export function tokenizeForSearch(text: string, options: { tokenizers: Tokenizer[] }): QueryCombination {
    // Extract urls and remove them from the query
    const urls: string[] = extractMdLinks(text).map(link => link.href);
    text = urls.reduce((acc, url) => acc.replace(url, ""), text);

    const tokens = [...tokenizeTokens(text), ...urls];

    return {
        combineWith: 'OR',
        queries: [
            { combineWith: 'AND', queries: tokens },
            { combineWith: 'AND', queries: tokenizeWords(text, options.tokenizers) },
            { combineWith: 'AND', queries: tokens.flatMap(splitHyphens) },
            { combineWith: 'AND', queries: tokens.flatMap(splitCamelCase) },
        ],
    };
}

function tokenizeWords(text: string, tokenizers: Tokenizer[]): string[] {
    return tokenizeLanguage(text, tokenizers) ?? text.split(BRACKETS_AND_SPACE).filter(Boolean);
}

function tokenizeTokens(text: string): string[] {
    return text.split(SPACE_OR_PUNCTUATION).filter(Boolean);
}

function tokenizeLanguage(text: string, tokenizers: Tokenizer[]): string[] | null {
    const result = tokenizers.flatMap(tokenizer => tokenizer.tryTokenization(text) ?? [])

    return result.length === 0 ? null : result;
}
