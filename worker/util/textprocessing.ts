import { excerptAfter, excerptBefore } from "./global";
import { Query } from "./query";
import { getPlugConfig } from "./settings";
import { removeDiacritics } from "./utils";
import { ResultExcerpt, SearchMatch } from "../../shared/global";

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stringsToRegex(strings: string[]): RegExp {
    if (!strings.length) return /^$/g;

    // sort strings by decreasing length, so that longer strings are matched first
    strings.sort((a, b) => b.length - a.length);

    const joined = `(${strings
        .map(s => `\\b${escapeRegExp(s)}\\b|${escapeRegExp(s)}`)
        .join('|')})`;

    return new RegExp(`${joined}`, 'gui');
}

function processTextForDisplay(text: string, options: { renderLineReturnInExcerpts: boolean }): string {
    text = escapeHTML(text);

    if (options.renderLineReturnInExcerpts) {
        // Remove doubled line returns
        const lineReturn = new RegExp(/(?:\r\n|\r|\n)/g);
        text = text
            .split(lineReturn)
            .filter(l => l)
            .join('\n');

        text = text.replaceAll("\n", "<br>");
    }

    return text.trim();
}

export async function getMatches(
    text: string,
    words: string[],
    query?: Query
): Promise<SearchMatch[]> {
    const settings = await getPlugConfig();

    words = words.map(escapeHTML);
    const reg = stringsToRegex(words);
    const originalText = text;

    if (settings.ignoreDiacritics) {
        text = removeDiacritics(text, settings.ignoreArabicDiacritics);
    }

    const startTime = new Date().getTime();
    let match: RegExpExecArray | null = null;
    const matches: SearchMatch[] = [];
    let count = 0;
    while ((match = reg.exec(text)) !== null) {
        // Avoid infinite loops, stop looking after 100 matches or if we're taking too much time
        if (++count >= 100 || new Date().getTime() - startTime > 50) break;

        const matchStartIndex = match.index;
        const matchEndIndex = matchStartIndex + match[0].length;
        const originalMatch = originalText
            .substring(matchStartIndex, matchEndIndex)
            .trim();

        if (originalMatch && match.index >= 0) {
            matches.push({ match: originalMatch, offset: match.index });
        }
    }

    // If the query is more than 1 token and can be found "as is" in the text, put this match first
    if (query && (query.query.text.length > 1 || query.getExactTerms().length > 0)) {
        const best = text.indexOf(query.getBestStringForExcerpt());
        if (best > -1 && matches.find(m => m.offset === best)) {
            matches.unshift({
                offset: best,
                match: query.getBestStringForExcerpt(),
            });
        }
    }

    return matches.map(match => ({
        ...match,
        match: processTextForDisplay(match.match, { renderLineReturnInExcerpts: settings.renderLineReturnInExcerpts })
    }));
}

export async function makeExcerpt(content: string, offset: number): Promise<ResultExcerpt> {
    const settings = await getPlugConfig();

    try {
        const from = Math.max(0, offset - excerptBefore);
        const to = Math.min(content.length, offset + excerptAfter);

        content =
            (from > 0 ? '…' : '') +
            content.slice(from, to).trim() +
            (to < content.length - 1 ? '…' : '');

        if (settings.renderLineReturnInExcerpts) {
            const last = content.lastIndexOf('\n', offset - from);
            if (last > 0) {
                content = content.slice(last + 1);
            }
        }

        return { excerpt: processTextForDisplay(content, { renderLineReturnInExcerpts: settings.renderLineReturnInExcerpts }), offset: offset };
    } catch (e) {
        console.error("[Silversearch] Error while creating excerpt", e);
        return { excerpt: "", offset: 0 };
    }
}

export function escapeHTML(html: string): string {
    return html
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;')
}