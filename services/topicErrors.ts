/**
 * Topic Service Errors
 *
 * Dedicated error types for Topic operations during Phase 2D transitional period.
 */

/**
 * Thrown when attempting to delete a Topic that still has Vocabularies
 * in localStorage (Phase 2D transitional state).
 */
export class TopicHasVocabulariesError extends Error {
  constructor() {
    super('Không thể xóa học phần này vì vẫn còn từ vựng. Hãy xóa từ vựng bên trong trước.');
    this.name = 'TopicHasVocabulariesError';
  }
}
