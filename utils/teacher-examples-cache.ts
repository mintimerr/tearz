import type { TeacherVocabWordCard } from '@/types/companion-chat-api';

const cache = new Map<string, TeacherVocabWordCard[]>();

export function getCachedTeacherExamples(messageId: string): TeacherVocabWordCard[] | undefined {
  return cache.get(messageId);
}

export function setCachedTeacherExamples(messageId: string, words: TeacherVocabWordCard[]): void {
  if (words.length === 0) return;
  cache.set(messageId, words);
}
