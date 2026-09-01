/**
 * Normalizes CRLF and lone-CR line endings to LF.
 *
 * Source-contract assertions compare against multi-line fragments written with
 * `\n`. A Windows checkout (or any checkout without the repository
 * `.gitattributes` normalization) materializes `\r\n`, which would make those
 * assertions fail for reasons unrelated to the contract being checked.
 */
export function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}
