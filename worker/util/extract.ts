import { getNameFromPath, isMarkdownPath, Path } from "@silverbulletmd/silverbullet/lib/ref";
import { space, events } from "@silverbulletmd/silverbullet/syscalls";
import { DocumentMeta, PageMeta } from "@silverbulletmd/silverbullet/type/index";
import * as v from "valibot"
import { NavigationMap } from "../../shared/global";

export type ExtractionInfo = {
    // If a document took a lot of processing power to generate, it makes sense to store it across reloads
    cacheMode: "persistent" | "session";
    navigationMap?: NavigationMap | undefined;
};

export type ExtractionResult = {
    content: string;
} & ExtractionInfo;

const extractionResultSchema = v.strictObject({
    content: v.string(),
    cacheMode: v.undefinedable(v.picklist(["persistent", "session"]), "session"),
    navigationMap: v.optional(v.array(v.object({ type: v.literal("range"), from: v.number(), to: v.number(), tail: v.string() })))
});

export async function extractContentByPath(path: Path, cachedMeta?: PageMeta | DocumentMeta): Promise<ExtractionResult | null> {
    if (isMarkdownPath(path)) {
        try {
            return { content: await space.readPage(getNameFromPath(path)), cacheMode: "session" };
        } catch {
            return null;
        }
    } else {
        let meta;
        try {
            meta = cachedMeta ?? await space.getDocumentMeta(getNameFromPath(path));
        } catch {
            return null;
        }

        let results;
        try {
            results = await events.dispatchEvent("silversearch:index", { meta }) as unknown[];
        } catch {
            console.warn(`[silversearch] Eventhandler threw error. Discarding it.`)
            return null;
        }

        if (results.length === 0) return null;
        else if (results.length > 1) {
            console.warn(`[silversearch] We got multiple responses while indexing ${meta.name}. Can't handle that.`);
        }

        const result = v.safeParse(extractionResultSchema, results[0]);
        if (!result.success) {
            console.warn(`[silversearch] Eventhandler didn't return well-formed result. Discarding it.`)
            return null;
        }

        return result.output;
    }
}
