import { ArticleLength, Tone } from '../../ai/ai.service';

export interface PlanItemInput {
  title: string;
  targetKeyword?: string;
  keywords?: string[];
  // Optional ISO date the planner can set; defaults to the next cadence slot.
  scheduledFor?: string;
}

export class CreateContentPlanDto {
  title: string;
  topic: string;
  audience?: string;
  tone?: Tone;
  length?: ArticleLength;
  category?: string;
  // daily | every_3_days | weekly | biweekly | monthly
  cadence?: string;
  // How many ideas to brainstorm when `items` isn't supplied.
  articleCount?: number;
  // Cap on total articles ever generated. Defaults to the number of ideas;
  // pass null for an open-ended (never-completing) plan.
  totalTarget?: number | null;
  autoPublish?: boolean;
  // Cluster seed keywords, used to steer the brainstorm and attached to items.
  targetKeyword?: string;
  relatedKeywords?: string[];
  // Explicit ideas — when present, skips the AI brainstorm.
  items?: PlanItemInput[];
  // Dispatch the first article on the next scheduler tick (default true).
  startNow?: boolean;
}
