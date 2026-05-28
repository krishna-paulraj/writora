export class SaveKeywordDto {
  keyword: string;
  searchVolume?: number | null;
  difficulty?: number | null;
  competition?: number | null;
  cpc?: number | null;
  seed?: string | null;
}
