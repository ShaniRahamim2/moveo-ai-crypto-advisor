/**
 * Title-cases for display only. The stored value is never rewritten: some names
 * are deliberately lowercase, and overwriting what someone typed is not ours to
 * do.
 *
 * Each part of a hyphenated or apostrophised name is capitalised, so "anna-maria"
 * renders as "Anna-Maria" and "o'brien" as "O'Brien". A part that is already
 * mixed case is left alone apart from its first letter, which keeps "McDonald"
 * intact while still fixing "SHANI" and "shani".
 */
export function toTitleCase(value: string): string {
  return value
    .split(/(\s+)/)
    .map((chunk) => (/^\s+$/.test(chunk) ? chunk : capitaliseParts(chunk)))
    .join('')
    .trim();
}

function capitaliseParts(word: string): string {
  return word
    .split(/([-'’])/)
    .map((part) => {
      if (part.length === 0 || /^[-'’]$/.test(part)) return part;
      const rest = part === part.toLocaleUpperCase() ? part.slice(1).toLocaleLowerCase() : part.slice(1);
      return part.charAt(0).toLocaleUpperCase() + rest;
    })
    .join('');
}
