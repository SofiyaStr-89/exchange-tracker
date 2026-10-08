// Создание элементов только через textContent: названия и адреса приходят с чужих сайтов.

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { className?: string; text?: string } = {},
  ...children: (Node | null)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.className) node.className = props.className;
  if (props.text !== undefined) node.textContent = props.text;
  for (const child of children) if (child) node.append(child);
  return node;
}
