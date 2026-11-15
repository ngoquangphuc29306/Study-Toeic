// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { button, click, mount } from './test-utils/dom';
import { SynonymSessionHeader } from './SynonymSessionHeader';

let dom: Awaited<ReturnType<typeof mount>>;
beforeEach(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));
afterEach(async () => { await dom.unmount(); vi.unstubAllGlobals(); });

it('names and operates exit when its responsive text is hidden on mobile', async () => {
  let exited = false;
  dom = await mount(<SynonymSessionHeader title="Typing" current={1} total={2} onExit={() => { exited = true; }} />);
  const exit = button(dom.container, 'Thoát session');
  exit.querySelector('span')!.style.display = 'none';
  expect(exit.getAttribute('aria-label')).toBe('Thoát session');
  await click(exit);
  expect(exited).toBe(true);
});
