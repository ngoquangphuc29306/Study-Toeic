/**
 * Collection Service Errors
 *
 * Dedicated error types for Collection operations during Phase 2C transitional period.
 */

/**
 * Thrown when attempting to delete a Collection that still has child Topics or Vocabularies
 * in localStorage (Phase 2C transitional state).
 */
export class CollectionHasChildrenError extends Error {
  constructor() {
    super('Collection vẫn còn chủ đề hoặc từ vựng.');
    this.name = 'CollectionHasChildrenError';
  }
}
