/**
 * Vocabulary Service Error Types
 *
 * Phase 2E: Custom error types for vocabulary operations
 */

/**
 * Thrown when vocabulary validation fails
 */
export class VocabularyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VocabularyValidationError';
  }
}
