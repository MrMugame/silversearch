import { editor, system } from "@silverbulletmd/silverbullet/syscalls";
import * as v from "valibot"
import { RecencyCutoff } from "./global";

let errorWasShown = false;
let settings: null | SilversearchSettings = null;

export type TokenizerConfig =
  | string
  | number
  | boolean
  | null
  | { [key: string]: TokenizerConfig }
  | TokenizerConfig[];

export const tokenizerConfigSchema: v.GenericSchema<TokenizerConfig> = v.lazy(() =>
  v.union([
    v.string(),
    v.number(),
    v.boolean(),
    v.null(),
    v.record(v.string(), tokenizerConfigSchema),
    v.array(tokenizerConfigSchema),
  ])
);

const weightSchema = v.strictObject({
    content: v.optional(v.number(), 1),
    basename: v.optional(v.number(), 10),
    displayName: v.optional(v.number(), 10),
    directory: v.optional(v.number(), 7),
    aliases: v.optional(v.number(), 1),
    tags: v.optional(v.number(), 1),
});

const settingsSchema = v.strictObject({
    weights: v.optional(weightSchema, v.parse(weightSchema, {})),
    weightCustomProperties: v.optional(v.record(v.string(), v.number()), {}),
    recencyBoost: v.optional(v.enum(RecencyCutoff), RecencyCutoff.Disabled),
    downrankedFoldersFilters: v.optional(v.array(v.string()), []),
    ignoreDiacritics: v.optional(v.boolean(), true),
    ignoreArabicDiacritics: v.optional(v.boolean(), false),
    tokenizeUrls: v.optional(v.boolean(), true),
    splitCamelCase: v.optional(v.boolean(), true),
    fuzziness: v.optional(v.picklist(["0", "1", "2"]), "1"),
    renderLineReturnInExcerpts: v.optional(v.boolean(), true),
    ignore: v.optional(v.array(v.string()), []),
    tokenizers: v.optional(v.record(v.pipe(v.string(), v.nonEmpty()), v.record(v.string(), tokenizerConfigSchema)), {})
});

export type SilversearchSettings = v.InferOutput<typeof settingsSchema>

export async function getPlugConfig(): Promise<SilversearchSettings> {
    if (settings) return settings;

    const config = await system.getConfig("silversearch", {});

    const result = v.safeParse(settingsSchema, config);

    if (!result.success) {
        if (!errorWasShown) {
            const message = Object.entries(v.flatten<typeof settingsSchema>(result.issues).nested ?? {})
                .map(([location, err]) => err ? `${err.join(" & ")} in "${location}"` : "")
                .filter(str => str)
                .join("; ");

            await editor.flashNotification(`Silersearch - There was an error in your CONFIG: ${message}`);

            errorWasShown = true;
        }

        settings = v.parse(settingsSchema, {});
    } else {
        settings = result.output;
    }

    return settings;
}