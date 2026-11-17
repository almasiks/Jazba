/**
 * Похоже ли значение на код (`[1, 2, 3]`, `map(n => n * 2)`, `undefined`)?
 * Такие варианты ответа показываем моноширинным шрифтом, как в дизайне.
 */
export function looksLikeCode(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (/[[\]{}();=<>]|=>|\.\w+\(/.test(text)) return true;
  return /^(undefined|null|true|false|NaN|-?\d+(\.\d+)?)$/.test(text);
}
