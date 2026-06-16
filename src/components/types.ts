export type LocationScore = {
  id: string;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  score: number | null;
  riskLevel: string | null;
  weatherRegime: string | null;
  scoredFor: string | null;
};
