export function qs<T extends Element>(selector: string): T | null {
  return document.querySelector<T>(selector);
}

export function qsa<T extends Element>(selector: string): T[] {
  return Array.from(document.querySelectorAll<T>(selector));
}
