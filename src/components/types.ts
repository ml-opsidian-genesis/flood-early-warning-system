export type LocationScore = {
  id: string;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  score: number | null;
  riskLevel: string | null;
  weatherRegime: string | null;
};

export type Shelter = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  capacity: number | null;
  facilities: string[];
  contactInfo: string | null;
  description: string | null;
  status: string;
};
