import type { EditorWorkDetail } from './editorOwn.js';
export type EditorialReviewKind = 'chapter' | 'manuscript' | 'titles';
export interface EditorialReviewMetadata {
  kind: EditorialReviewKind;
  version: number;
  requestKey: string;
  chapterNumber?: number;
  proposedTitles?: string[];
}
export interface EditorialReviewResponse {
  feedbackFile?: { id: string; name: string; url: string; mimeType: string; revisionId: string };
  selectedTitle?: string;
}
export interface EditorialReviewVersion {
  id: string;
  status: 'pending' | 'approved' | 'changes_requested' | 'cancelled';
  metadata: EditorialReviewMetadata;
  response: EditorialReviewResponse | null;
  feedback: string | null;
  requestedAt: string;
  decidedAt: string | null;
  file: { name: string; url: string } | null;
}
export interface EditorialReviewGuide {
  projectId: string;
  title: string;
  authors: string;
  serviceCode: string;
  currentStep: 'interviews' | 'chapters' | 'manuscript' | 'titles' | 'complete';
  blockedReason: string | null;
  authorHasAccount: boolean;
  chapters: { number: number; latest: EditorialReviewVersion | null; history: EditorialReviewVersion[] }[];
  manuscript: EditorialReviewVersion | null;
  titles: EditorialReviewVersion | null;
  history: EditorialReviewVersion[];
  selectedTitle: string | null;
  extraction?: EditorWorkDetail['extraction'];
}
export interface EditorialReviewFile { name: string; contentBase64: string }
export interface SubmitEditorialReview {
  kind: EditorialReviewKind;
  chapterNumber?: number;
  expectedVersion: number;
  requestKey: string;
  file?: EditorialReviewFile;
  proposedTitles?: string[];
  chaptersConfirmed?: boolean;
}
