import type { EmergencyOccurrence, SupportPoint } from "./types";

const knownLocations = [
  {
    match: ["rua das flores", "centro sao paulo", "são paulo", "centro, sao paulo"],
    estimatedAddress: "Rua das Flores, Centro — São Paulo/SP",
    city: "São Paulo",
    state: "SP",
    lat: -23.5505,
    lng: -46.6333,
    referencePoints: ["Centro de São Paulo", "Praça da Sé", "Estação Sé"]
  },
  {
    match: ["praça da sé", "praca da se", "estação sé", "estacao se", "catedral da sé", "catedral da se"],
    estimatedAddress: "Praça da Sé — São Paulo/SP",
    city: "São Paulo",
    state: "SP",
    lat: -23.5505,
    lng: -46.6333,
    referencePoints: ["Estação Sé", "Catedral da Sé"]
  },
  {
    match: ["rodoviária novo rio", "rodoviaria novo rio", "avenida francisco bicalho", "francisco bicalho"],
    estimatedAddress: "Rodoviária Novo Rio — Rio de Janeiro/RJ",
    city: "Rio de Janeiro",
    state: "RJ",
    lat: -22.8991,
    lng: -43.2096,
    referencePoints: ["Avenida Francisco Bicalho", "Área de embarque"]
  },
  {
    match: ["mercado modelo", "praça visconde de cayru", "praca visconde de cayru", "elevador lacerda"],
    estimatedAddress: "Mercado Modelo — Salvador/BA",
    city: "Salvador",
    state: "BA",
    lat: -12.9747,
    lng: -38.5134,
    referencePoints: ["Praça Visconde de Cayru", "Elevador Lacerda"]
  },
  {
    match: ["parque da redenção", "parque da redencao", "brique da redenção", "brique da redencao", "parque farroupilha"],
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
    { name: "Terminal Rodoviário Novo Rio", kind: "terminal", city: "Rio de Janeiro", state: "RJ", priority: "media" }
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

function getMatches(transcript: string) {
  const normalized = normalize(transcript);
  return knownLocations
    .map((location) => {
      const score = location.match.reduce((acc, token) => {
        return normalized.includes(normalize(token)) ? acc + 1 : acc;
      }, 0);
      return { location, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
}

export async function geocodeFromTranscript(transcript: string, metadata?: { cityHint?: string }) {
  const matches = getMatches(transcript);

  if (matches.length === 0) {
    const cityHint = metadata?.cityHint;
    return {
      rawText: transcript,
      estimatedAddress: "Localização não confirmada",
      city: cityHint,
      state: undefined,
      lat: undefined,
      lng: undefined,
      confidence: "desconhecida" as const,
      source: cityHint ? ("metadata" as const) : ("transcript" as const),
      referencePoints: []
    };
  }

  const best = matches[0];
  const confidence = best.score >= 3 ? "alta" : best.score === 2 ? "media" : "baixa";

  return {
    rawText: transcript,
    estimatedAddress: best.location.estimatedAddress,
    city: best.location.city,
    state: best.location.state,
    lat: best.location.lat,
    lng: best.location.lng,
    confidence,
    source: "mcp" as const,
    referencePoints: best.location.referencePoints
  };
}

export async function validateLocation(occurrence: EmergencyOccurrence) {
  const matches = getMatches(occurrence.transcript);
  const matchedCities = Array.from(new Set(matches.map((entry) => entry.location.city)));
  const divergences: string[] = [];

  if (!matches.length) {
    divergences.push("Nenhuma referência de localização confiável foi encontrada no relato.");
  }

  if (matchedCities.length > 1) {
    divergences.push(`Foram citadas cidades diferentes no relato: ${matchedCities.join(", ")}.`);
  }

  if (occurrence.location.city && matchedCities.length > 0 && !matchedCities.includes(occurrence.location.city)) {
    divergences.push(`Cidade detectada (${occurrence.location.city}) difere das referências do texto.`);
  }

  return {
    consistent: divergences.length === 0,
    divergences,
    confidence: divergences.length === 0 ? "alta" : matchedCities.length > 1 ? "baixa" : "media"
  } as const;
}

export async function getNearbySupportPoints(location: EmergencyOccurrence["location"], category: string): Promise<SupportPoint[]> {
  if (!location.city) return [];

  const base = supportPointsByCity[location.city] ?? [];
  const firstDistance = category === "emergencia_medica" ? 0.3 : category === "violencia_domestica" ? 0.5 : 0.8;

  return base.slice(0, 3).map((point, index) => ({
    ...point,
    distanceKm: Number((firstDistance + index * 0.6).toFixed(1))
  }));
}
