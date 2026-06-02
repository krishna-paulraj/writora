export class QuickAddDto {
  title: string;
  // ISO date the article should generate/publish on.
  scheduledFor: string;
  targetKeyword?: string;
  keywords?: string[];
}
