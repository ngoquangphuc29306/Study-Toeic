import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

/** Test-only driver for real React roots; callers use the jsdom environment. */
export async function mount(node: ReactNode) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const render = async (next: ReactNode) => { await act(async () => root.render(next)); };
  await render(node);
  return {
    container,
    render,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

export function button(container: HTMLElement, name: string | RegExp): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(element =>
    typeof name === 'string' ? element.textContent?.trim() === name : name.test(element.textContent || ''),
  );
  if (!found) throw new Error(`Button missing: ${name}`);
  return found;
}

export async function click(element: HTMLElement) {
  await act(async () => element.click());
}

export async function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    // Bypass React's value tracker so input events reflect an actual user edit.
    const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLInputElement ? 'input' : 'change', { bubbles: true }));
  });
}
