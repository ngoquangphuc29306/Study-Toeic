import type { Collection, Topic, Vocabulary } from '@/lib/types';

export interface ToeicVocabularyDestination {
  id: string;
  title: string;
}

export interface SaveToeicVocabularyInput {
  word: string;
  meaningVi: string | null;
  partOfSpeech: string | null;
  collectionId: string;
  sectionId: string;
  source?: string;
}

export type SaveToeicVocabularyResult =
  | { status: 'created'; vocabulary: Vocabulary }
  | { status: 'duplicate'; vocabulary: Vocabulary };

export type ToeicVocabularyAdapterErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_INPUT'
  | 'COLLECTION_NOT_FOUND'
  | 'SECTION_NOT_FOUND'
  | 'DUPLICATE'
  | 'READ_FAILED'
  | 'SAVE_FAILED';

export class ToeicVocabularyAdapterError extends Error {
  readonly code: ToeicVocabularyAdapterErrorCode;
  constructor(code: ToeicVocabularyAdapterErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ToeicVocabularyAdapterError';
    this.code = code;
  }
}

export interface ToeicVocabularyAdapterDependencies {
  getCollections: () => Promise<Collection[]>;
  getTopics: (collectionId: string) => Promise<Topic[]>;
  getVocabByTopic: (topicId: string) => Promise<Vocabulary[]>;
  addVocabulary: (vocabulary: Omit<Vocabulary, 'id'>) => Promise<Vocabulary>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateInput(input: SaveToeicVocabularyInput): void {
  if (!input.word.trim() || !input.meaningVi?.trim() || !UUID_PATTERN.test(input.collectionId) || !UUID_PATTERN.test(input.sectionId)) {
    throw new ToeicVocabularyAdapterError('INVALID_INPUT', 'Vui lòng chọn từ, nghĩa, Collection và Section hợp lệ.');
  }
}

export function normalizeToeicVocabularyWord(word: string): string {
  return word.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}

export function createToeicVocabularyAdapter(dependencies: ToeicVocabularyAdapterDependencies) {
  return {
    async listCollections(): Promise<ReadonlyArray<ToeicVocabularyDestination>> {
      try {
        const values = await dependencies.getCollections();
        return values.map((item) => ({ id: item.id, title: item.title }));
      } catch (cause) {
        throw new ToeicVocabularyAdapterError('READ_FAILED', 'Không thể tải Collection.', { cause });
      }
    },
    async listSections(collectionId: string): Promise<ReadonlyArray<ToeicVocabularyDestination>> {
      if (!UUID_PATTERN.test(collectionId)) throw new ToeicVocabularyAdapterError('INVALID_INPUT', 'Collection không hợp lệ.');
      try {
        const values = await dependencies.getTopics(collectionId);
        return values.filter((item) => item.collection_id === collectionId).map((item) => ({ id: item.id, title: item.title }));
      } catch (cause) {
        throw new ToeicVocabularyAdapterError('READ_FAILED', 'Không thể tải Section.', { cause });
      }
    },
    async saveVocabulary(input: SaveToeicVocabularyInput): Promise<SaveToeicVocabularyResult> {
      validateInput(input);
      try {
        const meaningVi = input.meaningVi?.trim();
        if (!meaningVi) throw new ToeicVocabularyAdapterError('INVALID_INPUT', 'Nghĩa tiếng Việt không được để trống.');
        const collections = await dependencies.getCollections();
        if (!collections.some((item) => item.id === input.collectionId)) {
          throw new ToeicVocabularyAdapterError('COLLECTION_NOT_FOUND', 'Collection không tồn tại hoặc bạn không có quyền truy cập.');
        }
        const sections = await dependencies.getTopics(input.collectionId);
        if (!sections.some((item) => item.id === input.sectionId && item.collection_id === input.collectionId)) {
          throw new ToeicVocabularyAdapterError('SECTION_NOT_FOUND', 'Section không tồn tại hoặc không thuộc Collection đã chọn.');
        }
        const existing = await dependencies.getVocabByTopic(input.sectionId);
        const normalized = normalizeToeicVocabularyWord(input.word);
        const duplicate = existing.find((item) => normalizeToeicVocabularyWord(item.word) === normalized);
        if (duplicate) return { status: 'duplicate', vocabulary: duplicate };

        const vocabulary = await dependencies.addVocabulary({
          topic_id: input.sectionId,
          word: input.word.trim(),
          part_of_speech: input.partOfSpeech?.trim() || 'noun',
          meaning: meaningVi,
        });
        return { status: 'created', vocabulary };
      } catch (cause) {
        if (cause instanceof ToeicVocabularyAdapterError) throw cause;
        throw new ToeicVocabularyAdapterError('SAVE_FAILED', 'Không thể lưu từ vựng. Vui lòng thử lại.', { cause });
      }
    },
  };
}

async function getBrowserAdapter() {
  const { addVocabulary, getCollections, getTopics, getVocabByTopic } = await import('@/services/vocabService');
  return createToeicVocabularyAdapter({ getCollections, getTopics, getVocabByTopic, addVocabulary });
}

export async function listToeicVocabularyCollections(): Promise<ReadonlyArray<ToeicVocabularyDestination>> {
  return (await getBrowserAdapter()).listCollections();
}

export async function listToeicVocabularySections(collectionId: string): Promise<ReadonlyArray<ToeicVocabularyDestination>> {
  return (await getBrowserAdapter()).listSections(collectionId);
}

export async function saveToeicVocabulary(input: SaveToeicVocabularyInput): Promise<SaveToeicVocabularyResult> {
  return (await getBrowserAdapter()).saveVocabulary(input);
}
