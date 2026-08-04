export interface RequestGeneration {
  userId: string;
  generation: number;
  contextKey?: string;
}

export function isCurrentRequest(
  expected: RequestGeneration,
  current: RequestGeneration
): boolean {
  return expected.userId === current.userId &&
    expected.generation === current.generation &&
    (expected.contextKey === undefined || expected.contextKey === current.contextKey);
}
