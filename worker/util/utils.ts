import { SearchMatch } from "../../shared/global";
import { excerptAfter } from "./global";

const japaneseDiacritics = ['\\u30FC', '\\u309A', '\\u3099'];
const regexpExclude = japaneseDiacritics.join('|');
const diacriticsRegex = new RegExp(`(?!${regexpExclude})\\p{Diacritic}`, 'gu');

export function stripMarkdownCharacters(text: string): string {
    return text.replace(/(\*|_)+(.+?)(\*|_)+/g, (_match, _p1, p2) => p2)
}

export function splitCamelCase(text: string): string[] {
    // if no camel case found, do nothing
    if (!/[a-z][A-Z]/.test(text)) {
        return [];
    }
    const splittedText = text
        .replace(/([a-z](?=[A-Z]))/g, '$1 ')
        .split(' ')
        .filter(t => t);
    return splittedText;
}

export function splitHyphens(text: string): string[] {
    if (!text.includes('-')) {
        return [];
    }
    return text.split('-').filter(t => t);
}

export function removeDiacritics(str: string, arabic = false): string {
    if (str === null || str === undefined) {
        return '';
    }

    if (arabic) {
        // Arabic diacritics
        // https://stackoverflow.com/a/40959537
        str = str
            .replace(/([^\u0621-\u063A\u0641-\u064A\u0660-\u0669a-zA-Z 0-9])/g, '')
            .replace(/(آ|إ|أ)/g, 'ا')
            .replace(/(ة)/g, 'ه')
            .replace(/(ئ|ؤ)/g, 'ء')
            .replace(/(ى)/g, 'ي');
        for (let i = 0; i < 10; i++) {
            str.replace(String.fromCharCode(0x660 + i), String.fromCharCode(48 + i));
        }
    }

    // Keep backticks for code blocks, because otherwise they are removed by the .normalize() function
    // https://stackoverflow.com/a/36100275
    str = str.replaceAll('`', '[__silversearch__backtick__]');
    // Keep caret same as above
    str = str.replaceAll('^', '[__silversearch__caret__]');
    // To keep right form of Korean character, NFC normalization is necessary
    str = str.normalize('NFD').replace(diacriticsRegex, '').normalize('NFC');
    str = str.replaceAll('[__silversearch__backtick__]', '`');
    str = str.replaceAll('[__silversearch__caret__]', '^');
    return str;
}

export function removeStrayDiacritics(str: string): string {
    return str.replace(new RegExp(`(?!\\^|\`)${diacriticsRegex.source}`, "gu"), "");
}

export function getGroups(matches: SearchMatch[]): SearchMatch[][] {
    const groups: SearchMatch[][] = [];
    let lastOffset = -1;
    let count = 0; // Avoid infinite loops
    while (++count < 100) {
        const group = getGroupedMatches(matches, lastOffset, excerptAfter);
        if (!group.length) break;
        lastOffset = group.at(-1)!.offset;
        groups.push(group);
    }
    return groups;
}

function getGroupedMatches(
    matches: SearchMatch[],
    offsetFrom: number,
    maxLen: number
): SearchMatch[] {
    const first = matches.find(m => m.offset > offsetFrom);
    if (!first) return [];
    return matches.filter(
        m => m.offset > offsetFrom && m.offset <= first.offset + maxLen
    );
}