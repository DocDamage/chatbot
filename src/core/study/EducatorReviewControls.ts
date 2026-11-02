/**
 * Educator & Reviewer Controls (PX15-T10)
 *
 * Implements educator review workflows, item approval/rejection, answer key locking,
 * and collection assignment with audit logging.
 */

import { EducatorReviewAction, Flashcard, QuizQuestion, StructuredNote } from './StudyTypes';

export class EducatorReviewControls {
  private auditLog: EducatorReviewAction[] = [];
  private lockedAnswerKeyQuestionIds: Set<string> = new Set();
  private assignedCollections: Map<string, Array<{ assignedTo: string; assignedAt: string }>> =
    new Map();

  /**
   * Reviews and updates status of a study item.
   */
  public reviewItem(
    itemId: string,
    itemType: 'note' | 'flashcard' | 'quiz_question',
    action: 'approved' | 'rejected' | 'modified',
    educatorId: string,
    notes?: string
  ): EducatorReviewAction {
    const record: EducatorReviewAction = {
      itemId,
      itemType,
      action,
      educatorId,
      timestamp: new Date().toISOString(),
      notes
    };

    this.auditLog.push(record);
    return record;
  }

  /**
   * Locks a quiz question's answer key to prevent further modifications.
   */
  public lockAnswerKey(questionId: string, educatorId: string): boolean {
    this.lockedAnswerKeyQuestionIds.add(questionId);
    this.auditLog.push({
      itemId: questionId,
      itemType: 'quiz_question',
      action: 'approved',
      educatorId,
      timestamp: new Date().toISOString(),
      notes: 'Answer key locked by educator.'
    });
    return true;
  }

  /**
   * Checks if a question's answer key is locked.
   */
  public isAnswerKeyLocked(questionId: string): boolean {
    return this.lockedAnswerKeyQuestionIds.has(questionId);
  }

  /**
   * Modifies a flashcard with educator approval.
   */
  public modifyFlashcard(
    card: Flashcard,
    updates: { frontPrompt?: string; backAnswer?: string; difficulty?: 'easy' | 'medium' | 'hard' },
    educatorId: string
  ): Flashcard {
    if (updates.frontPrompt) card.frontPrompt = updates.frontPrompt;
    if (updates.backAnswer) card.backAnswer = updates.backAnswer;
    if (updates.difficulty) card.difficulty = updates.difficulty;
    card.reviewedByEducator = true;

    this.reviewItem(card.id, 'flashcard', 'modified', educatorId, 'Updated prompt and answer');
    return card;
  }

  /**
   * Assigns a study collection to a local student or team member.
   */
  public assignCollection(collectionId: string, assignedTo: string): void {
    const list = this.assignedCollections.get(collectionId) || [];
    list.push({ assignedTo, assignedAt: new Date().toISOString() });
    this.assignedCollections.set(collectionId, list);
  }

  /**
   * Retrieves assignments for a collection.
   */
  public getAssignments(collectionId: string): Array<{ assignedTo: string; assignedAt: string }> {
    return this.assignedCollections.get(collectionId) || [];
  }

  /**
   * Retrieves audit log history.
   */
  public getAuditLog(): EducatorReviewAction[] {
    return [...this.auditLog];
  }
}
