import { createRequestCoordinator } from './requestCoordinator';

describe('request coordinator', () => {
  test('shares one promise for identical in-flight keys', async () => {
    const coordinator = createRequestCoordinator<number>();
    let calls = 0;
    let resolveRequest: ((value: number) => void) | undefined;

    const factory = () => {
      calls += 1;
      return new Promise<number>((resolve) => {
        resolveRequest = resolve;
      });
    };

    const first = coordinator.getOrCreate('user-a', factory);
    const second = coordinator.getOrCreate('user-a', factory);

    expect(second).toBe(first);
    await Promise.resolve();
    expect(calls).toBe(1);

    resolveRequest?.(42);
    await expect(first).resolves.toBe(42);
    expect(coordinator.has('user-a')).toBe(false);
  });

  test('does not share requests between users', async () => {
    const coordinator = createRequestCoordinator<string>();
    const first = coordinator.getOrCreate('user-a', async () => 'a');
    const second = coordinator.getOrCreate('user-b', async () => 'b');

    await expect(first).resolves.toBe('a');
    await expect(second).resolves.toBe('b');
    expect(first).not.toBe(second);
  });

  test('removes rejected requests so retry is possible', async () => {
    const coordinator = createRequestCoordinator<string>();
    let calls = 0;

    await expect(
      coordinator.getOrCreate('user-a', async () => {
        calls += 1;
        throw new Error('temporary');
      })
    ).rejects.toThrow('temporary');

    await expect(
      coordinator.getOrCreate('user-a', async () => {
        calls += 1;
        return 'recovered';
      })
    ).resolves.toBe('recovered');

    expect(calls).toBe(2);
  });
});
