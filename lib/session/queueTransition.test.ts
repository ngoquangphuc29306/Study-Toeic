import { expect, it } from 'vitest';
import { applyRatingToQueue } from './queueTransition';

it.each([
  { name: 'five intervening cards', queue: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], index: 0, next: ['a', 'b', 'c', 'd', 'e', 'f', 'a', 'g'] },
  { name: 'short remaining queue', queue: ['a', 'b', 'c'], index: 0, next: ['a', 'b', 'c', 'a'] },
  { name: 'pending duplicate and preserved history', queue: ['a', 'b', 'a', 'c', 'b', 'd'], index: 1, next: ['a', 'b', 'a', 'c', 'd', 'b'] },
  { name: 'last card', queue: ['a', 'b'], index: 1, next: ['a', 'b', 'b'] },
  { name: 'single card', queue: ['a'], index: 0, next: ['a', 'a'] },
])('Again requeues without completion: $name', ({ queue, index, next }) => {
  const original = [...queue];
  Object.freeze(queue);
  expect(applyRatingToQueue('again', queue, index, queue[index])).toEqual({
    queue: next, currentIndex: index + 1, isComplete: false,
  });
  expect(queue).toEqual(original);
});

it.each(['hard', 'good', 'easy', 'mastered'] as const)('%s advances once and completes only at the end', rating => {
  const queue = ['a', 'b'];
  Object.freeze(queue);
  expect(applyRatingToQueue(rating, queue, 0, 'a')).toEqual({ queue: ['a', 'b'], currentIndex: 1, isComplete: false });
  expect(applyRatingToQueue(rating, queue, 1, 'b')).toEqual({ queue: ['a', 'b'], currentIndex: 2, isComplete: true });
  expect(applyRatingToQueue(rating, ['a'], 0, 'a')).toEqual({ queue: ['a'], currentIndex: 1, isComplete: true });
  expect(queue).toEqual(['a', 'b']);
});
