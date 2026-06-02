export class UpdatePlanItemDto {
  // ISO date to move a planned article to; null parks it (never auto-dispatched).
  scheduledFor?: string | null;
  title?: string;
}
