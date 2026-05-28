import { ArticleLength, Tone } from '../ai.service';

export class GenerateArticleDto {
  topic: string;
  targetKeyword?: string;
  relatedKeywords?: string[];
  tone?: Tone;
  length?: ArticleLength;
  audience?: string;
  category?: string;
}
