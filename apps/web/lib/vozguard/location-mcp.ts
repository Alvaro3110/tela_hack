import type { EmergencyCategory, EmergencyOccurrence, SupportPoint } from "./types";

const knownLocations = [
  {
    match: ["rua das flores", "centro sao paulo", "sao paulo", "centro, sao paulo"],
    estimatedAddress: "Rua das Flores, Centro — São Paulo/SP",
    city: "São Paulo",
    state: "SP",
    lat: -23.5505,
    lng: -46.6333,
    referencePoints: ["Centro de São Paulo", "Praça da Sé", "Estação Sé"]
  },
  {
    match: ["praca da se", "estacao se", "catedral da se"],
    estimatedAddress: "Praça da Sé — São Paulo/SP",
    city: "São Paulo",
    state: "SP",
    lat: -23.5505,
    lng: -46.6333,
    referencePoints: ["Estação Sé", "Catedral da Sé"]
  },
  {
    match: ["rodoviaria novo rio", "avenida francisco bicalho", "francisco bicalho"],
    estimatedAddress: "Rodoviária Novo Rio — Rio de Janeiro/RJ",
    city: "Rio de Janeiro",
    state: "RJ",
    lat: -22.8991,
    lng: -43.2096,
    referencePoints: ["Avenida Francisco Bicalho", "Área de embarque"]
  },
  {
    match: ["mercado modelo", "praca visconde de cayru", "elevador lacerda"],
    estimatedAddress: "Mercado Modelo — Salvador/BA",
    city: "Salvador",
    state: "BA",
    lat: -12.9747,
    lng: -38.5134,
    referencePoints: ["Praça Visconde de Cayru", "Elevador Lacerda"]
  },
  {
    match: ["parque da redencao", "brique da redencao", "parque farroupilha"],
    estimatedAddress: "Parque da Redenção — Porto Alegre/RS",
    city: "Porto Alegre",
    state: "RS",
    lat: -30.0346,
    lng: -51.2177,
    referencePoints: ["Brique da Redenção", "Parque Farroupilha"]
  }
] as const;

const supportPointsByCity: Record<string, Omit<SupportPoint, "distanceKm">[]> = {
  "São Paulo": [
    { name: "Hospital Municipal Sé", kind: "hospital", city: "São Paulo", state: "SP", priority: "critica" },
    { name: "Base PM Centro", kind: "base_policial", city: "São Paulo", state: "SP", priority: "alta" },
    { name: "Estação Sé", kind: "estacao", city: "São Paulo", state: "SP", priority: "media" }
  ],
  "Rio de Janeiro": [
    { name: "Hospital Souza Aguiar", kind: "hospital", city: "Rio de Janeiro", state: "RJ", priority: "critica" },
    { name: "Base PM Novo Rio", kind: "base_policial", city: "Rio de Janeiro", state: "RJ", priority: "alta" },
    { name: "Terminal Novo Rio", kind: "terminal", city: "Rio de Janeiro", state: "RJ", priority: "media" }
  ],
  Salvador: [
    { name: "Hospital Geral do Estado", kind: "hospital", city: "Salvador", state: "BA", priority: "critica" },
    { name: "Base Guarda Municipal Comércio", kind: "base_policial", city: "Salvador", state: "BA", priority: "alta" },
    { name: "Ponto Elevador Lacerda", kind: "ponto_publico", city: "Salvador", state: "BA", priority: "media" }
  ],
  "Porto Alegre": [
    { name: "Hospital de Pronto Socorro", kind: "hospital", city: "Porto Alegre", state: "RS", priority: "critica" },
    { name: "Base Guarda Municipal Redenção", kind: "base_policial", city: "Porto Alegre", state: "RS", priority: "alta" },
    { name: "Farmácia 24h Centro", kind: "farmacia", city: "Porto Alegre", state: "RS", priority: "baixa" }
  ]
};

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function getMatches(text: string) {
  const n = normalize(text);
  return knownLocations
    .map((location) => {
      const score = location.match.reduce((acc, token) => (n.includes(token) ? acc + 1 : acc), 0);
      return { location, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

export async function geocodeFromTranscript(
  transcript: string,
  metadata?: {
    cityHint?: string | null;
    stateHint?: string | null;
    countryHint?: string | null;
    zipHint?: string | null;
  }
): Promise<EmergencyOccurrence["location"]> {
  const matches = getMatches(transcript);

  if (!matches.length) {
    return {
      rawText: transcript,
      estimatedAddress: "Localização não confirmada",
      city: metadata?.cityHint ?? undefined,
      state: metadata?.stateHint ?? undefined,
      lat: undefined,
      lng: undefined,
      confidence: "desconhecida",
      source: metadata?.cityHint || metadata?.stateHint ? "metadata" : "none",
      referencePoints: []
    };
  }

  const best = matches[0];
  const confidence: EmergencyOccurrence["location"]["confidence"] = best.score >= 3 ? "alta" : best.score === 2 ? "media" : "baixa";

  return {
    rawText: transcript,
    estimatedAddress: best.location.estimatedAddress,
    city: best.location.city,
    state: best.location.state,
    lat: best.location.lat,
    lng: best.location.lng,
    confidence,
    source: "mcp",
    referencePoints: [...best.location.referencePoints]
  };
}

export async function validateLocation(occurrence: EmergencyOccurrence) {
  const text = `${occurrence.clientTranscript}\n${occurrence.transcript}`;
  const matches = getMatches(text);
  const matchedCities = [...new Set(matches.map((entry) => entry.location.city))];
  const divergences: string[] = [];

  if (!matches.length) {
    divergences.push("Nenhuma referência de localização confiável foi encontrada no relato.");
  }

  if (matchedCities.length > 1) {
    divergences.push(`Foram citadas cidades diferentes no relato: ${matchedCities.join(", ")}.`);
  }

  return {
    consistent: divergences.length === 0,
    divergences,
    confidence: divergences.length === 0 ? "alta" : matchedCities.length > 1 ? "baixa" : "media"
  } as const;
}

export async function getNearbySupportPoints(
  location: EmergencyOccurrence["location"],
  category: EmergencyCategory
): Promise<SupportPoint[]> {
  if (!location.city) return [];

  const base = supportPointsByCity[location.city] ?? [];
  const firstDistance = category === "emergencia_medica" ? 0.3 : category === "violencia_domestica" ? 0.5 : 0.8;

  return base.slice(0, 3).map((point, index) => ({
    ...point,
    distanceKm: Number((firstDistance + index * 0.6).toFixed(1))
  }));
}
