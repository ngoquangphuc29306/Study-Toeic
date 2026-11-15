// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Collection, Topic, Vocabulary } from '../../../lib/types';
import { mapVocabularyToSynonymItems } from '../services/synonymPracticeService';
import * as service from '../services/synonymPracticeService';
import { SynonymPracticeSetup } from './SynonymPracticeSetup';
import { button, change, click, mount } from './test-utils/dom';

let dom: Awaited<ReturnType<typeof mount>>;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); });
afterEach(async () => { if (dom) await dom.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('memoizes real eligibility until mode, filters or source items change', async () => {
  const eligibility = vi.spyOn(service, 'getEligibleSynonymItems');
  const items = mapVocabularyToSynonymItems(Array.from({ length: 6 }, (_, i) => ({
    id: `${i}`, word: `word${i}`, synonyms: `syn${i}`, meaning: '', topic_id: 't',
  })), [], []);
  const props = { items, topics: [], collections: [], mode: 'multiple-choice' as const,
    filters: { collectionId: 'all', topicId: 'all' }, questionCount: 10,
    onFiltersChange() {}, onQuestionCountChange() {}, onStart() {}, onBack() {},
  };
  dom = await mount(<SynonymPracticeSetup {...props} />);
  await dom.render(<SynonymPracticeSetup {...props} filters={{ ...props.filters }} questionCount={20} />);
  expect(eligibility).toHaveBeenCalledTimes(1);
  expect(dom.container.textContent).toContain('Vocabulary đủ điều kiện6 từ');
  await dom.render(<SynonymPracticeSetup {...props} mode="select-all" />);
  expect(eligibility).toHaveBeenCalledTimes(2);
  await dom.render(<SynonymPracticeSetup {...props} filters={{ collectionId: 'all', topicId: 'missing' }} />);
  expect(eligibility).toHaveBeenCalledTimes(3);
  expect(button(dom.container, 'Bắt đầu luyện tập').disabled).toBe(true);
  await dom.render(<SynonymPracticeSetup {...props} items={items.slice(0, 3)} />);
  expect(eligibility).toHaveBeenCalledTimes(4);
  expect(dom.container.textContent).toContain('Vocabulary đủ điều kiện0 từ');
  await dom.render(<SynonymPracticeSetup {...props} filters={{ collectionId: 'missing', topicId: 'all' }} />);
  expect(eligibility).toHaveBeenCalledTimes(5);
  expect(button(dom.container, 'Bắt đầu luyện tập').disabled).toBe(true);
});

it.each([
  { words: ['rapid', 'swift'], synonyms: ['fast', ' FAST '] },
  { words: ['rapid', ' RAPID '], synonyms: ['fast', 'quick'] },
])('disables an impossible matching setup: %j', async ({ words, synonyms }) => {
  const source: Vocabulary[] = words.map((word, i) => ({ id: `${i}`, word, synonyms: synonyms[i], meaning: '', topic_id: 't' }));
  let started = false;
  const render = (vocabulary: Vocabulary[]) => <SynonymPracticeSetup
    items={mapVocabularyToSynonymItems(vocabulary, [], [])} topics={[]} collections={[]} mode="matching"
    filters={{ collectionId: 'all', topicId: 'all' }} questionCount={10}
    onFiltersChange={() => {}} onQuestionCountChange={() => {}} onBack={() => {}} onStart={() => { started = true; }}
  />;
  dom = await mount(render(source));
  expect(button(dom.container, 'Bắt đầu luyện tập').disabled).toBe(true);
  expect(dom.container.textContent).toContain('0 từ');
  await click(button(dom.container, 'Bắt đầu luyện tập'));
  expect(started).toBe(false);
  await dom.render(render([...source, { id: 'partner', word: 'large', synonyms: 'big', meaning: '', topic_id: 't' }]));
  expect(button(dom.container, 'Bắt đầu luyện tập').disabled).toBe(false);
  expect(dom.container.textContent).toContain('3 từ');
  await click(button(dom.container, 'Bắt đầu luyện tập'));
  expect(started).toBe(true);
});


it('offers ninth and empty topics with eight quick chips and collection-scoped counts', async () => {
  const collections: Collection[] = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }];
  const topics: Topic[] = Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, title: `Topic ${i + 1}`, collection_id: i === 9 ? 'b' : 'a', description: '', icon: '' }));
  const words: Vocabulary[] = [
    { id: 'ninth', word: 'rapid', synonyms: 'fast', meaning: '', topic_id: 't8' },
    { id: 'other', word: 'large', synonyms: 'big', meaning: '', topic_id: 't9' },
  ];
  function Fixture() {
    const [filters, setFilters] = useState({ collectionId: 'a', topicId: 'all' });
    return <SynonymPracticeSetup items={mapVocabularyToSynonymItems(words, topics, collections)} topics={topics} collections={collections}
      mode="typing" filters={filters} questionCount={10} onFiltersChange={setFilters}
      onQuestionCountChange={() => {}} onStart={() => {}} onBack={() => {}} />;
  }
  dom = await mount(<Fixture />);
  const label = [...dom.container.querySelectorAll('label')].find(element => element.textContent?.startsWith('Chọn từ tất cả học phần'));
  expect(label).toBeDefined();
  const chooser = label!.querySelector('select')!;
  expect(button(dom.container, /^Tất cả /).textContent).toBe('Tất cả 1');
  expect([...dom.container.querySelectorAll('button')].filter(element => element.textContent?.startsWith('Topic '))).toHaveLength(8);
  expect([...chooser.options].map(option => option.value)).toEqual(['all', 't0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8']);
  await change(chooser, 't8');
  expect(dom.container.textContent).toContain('Vocabulary đủ điều kiện1 từ');
  expect(button(dom.container, 'Bắt đầu luyện tập').disabled).toBe(false);
  await change(chooser, 't0');
  expect(chooser.value).toBe('t0');
  expect(dom.container.textContent).toContain('Vocabulary đủ điều kiện0 từ');
  expect(button(dom.container, 'Bắt đầu luyện tập').disabled).toBe(true);
  await change(dom.container.querySelector('select')!, 'b');
  expect(chooser.value).toBe('all');
  expect([...chooser.options].map(option => option.value)).toEqual(['all', 't9']);
  expect(button(dom.container, 'Bắt đầu luyện tập').disabled).toBe(false);
});
