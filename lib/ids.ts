/**
 * Форматы ID занятия. Без зависимостей — используется и в хранилище, и в proxy.ts.
 *  - editId — секретный: 32 символа base64url (24 случайных байта);
 *  - slug — публичный: 10 символов [a-z0-9].
 * Форматы не пересекаются, поэтому slug никогда не подойдёт как editId.
 */
export const EDIT_ID_LENGTH = 32;
export const SLUG_LENGTH = 10;

const EDIT_ID_RE = new RegExp(`^[A-Za-z0-9_-]{${EDIT_ID_LENGTH}}$`);
const SLUG_RE = new RegExp(`^[a-z0-9]{${SLUG_LENGTH}}$`);

export const isEditId = (value: string) => EDIT_ID_RE.test(value);
export const isSlug = (value: string) => SLUG_RE.test(value);
