/** Неизменяемые операции со списками — для редактора материалов. */

export function replaceAt<T>(list: T[], index: number, item: T): T[] {
  return list.map((current, i) => (i === index ? item : current));
}

export function removeAt<T>(list: T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

/** Сдвигает элемент на offset позиций (-1 — вверх, +1 — вниз). За границы не выходит. */
export function moveItem<T>(list: T[], index: number, offset: number): T[] {
  const target = index + offset;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}
