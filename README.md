# Silversearch
Silversearch is a plug for [Silverbullet](https://silverbullet.md/) implementing full-text search across your space, with the goal of maximum usability out of the box. It's *heavily* based on code from [Omnisearch](https://github.com/scambier/obsidian-omnisearch) (so give this guy a star not me) and as a consequence also uses [Minisearch](https://github.com/lucaong/minisearch) under the hood. When combined with other plugs it can not only search through your markdown files, but also search inside any document, like pdfs or images.

![](https://raw.githubusercontent.com/mrmugame/silversearch/main/docs/demo.webp)

## Installation
Silversearch is part of the [`Std`](https://silverbullet.md/Repositories/Std) repostitory and can by installed using the [Library Manager](https://silverbullet.md/Library%20Manager). You will have to navigate to `Library/Std/Pages/Library Manager` in *your* space and look for Silversearch under the available libraries and press `Install`.

## Usage
You can open the search dialog using the `Silversearch: Search` command (`Ctrl-s`/`Cmd-s`). Simply start typing to begin your search, helpful tips for refining your searches will appear at the start. If Silversearch is missing the most up-to-date content, you can rebuild the search database using the `Silversearch: Reindex` command. If you rebuild Silverbullets index, Silversearch will also rebuild, so there is no need to run both commands. The `Silversearch: Clear History` command is used to clear the search history.

Indexing for documents isn't handled by Silversearch, but by other plugs or Space Lua. You can install the following plugs to index specific documents.

- [Silverbullet PDF](https://github.com/MrMugame/silverbullet-pdf): Will index text content from PDFs using PDF.js

If you are missing something and want to write your own indexer, you can look into the [API](#API) section.

## Keybinds
- `Esc`: Closes Search Modal
- `Enter`: Opens currently selected result
- `Alt-Enter`: Inserts a link to the search result at the current cursor
- `Ctrl-Enter`: Opens the result in a new tab
- `ArrowUp/ArrowDown`: Moves through the results
- `Ctrl-ArrowUp/ArrowDown`: Moves through the history

## Settings
Silversearch can be configured using SpaceLua

```lua
config.set {
  silversearch = {
    -- Weighs specific fields more
    weights = {
      basename = 15
      -- Also available: tags, aliases, directory, displayName, content
    },
    -- Weighs pages with specific attributes set through frontmatter more if that attribute is included in the search
    weightCustomProperties = {
      books = 10
    },
    -- Files that have been edited more recently than, will be weighed more. Options are "day", "week", "month" or "disabled"
    recencyBoost = "week",
    -- Rank specific folders down
    downrankedFoldersFilters = {"Library/"},
    -- Normalize diatrics in queries and search terms. Words like "brûlée" or "žluťoučký" will be indexed as "brulee" and "zlutoucky".
    ignoreDiacritics = true,
    -- Similar to `ignoreDiacritics` but for arabic diatritics
    ignoreArabicDiacritics = false,
    -- Breaks urls down into searchable words
    tokenizeUrls = true,
    -- Breaks words seperated with camel case into searchable words
    splitCamelCase = true,
    -- Increases the fuzziness of the full-text search, options are "0", "1", "2"
    fuzziness = "1",
    -- Puts newlines into the excerpts as opposed to rendering it as one continous string
    renderLineReturnInExcerpts = true,
    -- Loads additional tokenizers, see the "Language support" section for more info
    tokenizers = {
      ["Library/bob/tokenizer.js"] = {
        -- These options will be different for different tokenizers
        maxWordLength = 10
      }
    }
  }
}
```

## Language support
Silversearch makes an effort to support as many languages as possible, which isn't always possible. RTL languages for example aren't really supported by Silverbullet and thus it also doesn't make sense for Silversearch to support them. Most Latin languages work well out of the box, like English, German, French, etc. Other languages like Chinese don't work so well by default, because the tokenization (i.e. the breaking of text into smaller sections, which are later compared, generally "words") is way more complex than in English. This can be improved by installing a purpose build tokenizer. Available tokenizers are lisited below. If you are missing a tokenizer, you can implement your own, the description of the api can be found in the [API](#API) section.

- [Chinese (using `jieba-wasm`)](https://github.com/LelouchHe/silversearch-chinese-tokenizer)

## API
To integrate Silversearch with SpaceLua, use the following syscalls:

- `silversearch.search(searchTerm: string, options: { singleFilePath?: string, silent?: boolean }): Promise<ResultPage[]>`: Searches the database using the `searchTerm`, which supports all functions the normal search also supports (e.g. `ext`, etc.). If `singleFilePath` is provided it will only search the provided file. If `silent` is true, it will not show any notifications when a reindex happens. The function will return an array of [`ResultPage`](https://github.com/MrMugame/silversearch/blob/5c4a3b57a8f92336c5e2b1ae29ff9d4b668cd470/shared/global.ts#L6)
- `silversearch.openSearch(defaultQuery: string = ""): void`: This opens the search modal. If a default query is provided it will be inserted into the search field.
- `silversearch.reindex(silent: boolean = false): void`: Rebuilds the search database. If `silent` is true it will not show any notifications.

When Silversearch indexes a document, it will fire the `silversearch:index` event to query the content. SpaceLua or plugs can respond with content. If nobody responds, the document won't be indexed. If multiple listeners respond, an error will be thrown and the document also won't be indexed. The return type for listeners looks like this

```ts
type ExtractionResult = {
  // The document content as a string, this should be fairly straightforward
  content: string:
  // If a document took a lot of processing power to generate, it makes
  // sense to store it across reloads. The default is "session"
  cacheMode?: "persistent" | "session";
  // This type is defined in shared/global.ts. It's used to map an offset in
  // the document content to a link tail (i.e `@42`, `#foo`). If a document
  // viewer implements navigation based on that, it can navigate the offset of
  // a search result to the correct place.
  navigationMap?: NavigationMap;
};
```

Silversearch can load custom tokenizers. These aren't plugs for the sole reason that minisearch can't handle asynchronous tokenization. They are rather ESM Javascript files, which are directly loaded by Silversearch to tokenize content. The generaly api looks as follows

```ts
export async function init(config: Record<string, any>) {
  // `config` is the object passed to the settings option of this tokenizer
  console.log(config);

  // Do Initialization stuff
}

export function isTokenizable(text: string): boolean {
  // If this returns true for a given piece of string, Silversearch will call `tokenize()` to get tokens from the text
  return true;
}

export function tokenize(text: string): string[] {
  // This should return the tokenized text
  return text.split(" ");
}
```

## LICENSE
Silversearch is licensed under [GPL-3](https://tldrlegal.com/license/gnu-general-public-license-v3-(gpl-3)).
