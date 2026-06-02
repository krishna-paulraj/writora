export class UpdateContentPlanDto {
  title?: string;
  // active | paused | completed
  status?: string;
  cadence?: string;
  autoPublish?: boolean;
  totalTarget?: number | null;
}
