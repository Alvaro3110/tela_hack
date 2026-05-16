import type { EmergencyOccurrence } from "../../lib/vozguard/types";

type MapMockProps = {
  location: EmergencyOccurrence["location"];
};

export function MapMock({ location }: MapMockProps) {
  if (!location.lat || !location.lng) {
    return (
      <div
        style={{
          border: "1px dashed #34516e",
          borderRadius: 14,
          height: 220,
          display: "grid",
          placeItems: "center",
          color: "#9ab2ca",
          background:
            "linear-gradient(180deg, rgba(21,33,48,0.95), rgba(14,24,38,0.95)), repeating-linear-gradient(0deg, rgba(120,157,194,0.08), rgba(120,157,194,0.08) 1px, transparent 1px, transparent 24px), repeating-linear-gradient(90deg, rgba(120,157,194,0.08), rgba(120,157,194,0.08) 1px, transparent 1px, transparent 24px)"
        }}
      >
        Localização não confirmada.
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid #2f4863",
        borderRadius: 14,
        overflow: "hidden",
        background: "#0f1a2a"
      }}
    >
      <div
        style={{
          position: "relative",
          height: 220,
          background:
            "linear-gradient(180deg, rgba(17,31,48,0.96), rgba(14,24,38,0.94)), repeating-linear-gradient(0deg, rgba(133,168,203,0.1), rgba(133,168,203,0.1) 1px, transparent 1px, transparent 25px), repeating-linear-gradient(90deg, rgba(133,168,203,0.1), rgba(133,168,203,0.1) 1px, transparent 1px, transparent 25px)"
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 120,
            height: 120,
            marginLeft: -60,
            marginTop: -60,
            borderRadius: "50%",
            border: "2px solid rgba(255,87,87,0.45)",
            animation: "vgPulse 2.2s ease-out infinite"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 16,
            height: 16,
            marginLeft: -8,
            marginTop: -8,
            borderRadius: "50%",
            background: "#ff5a5a",
            boxShadow: "0 0 20px rgba(255,90,90,0.7)"
          }}
        />
      </div>
      <div style={{ padding: 12, color: "#ccd8e6", fontSize: 12, lineHeight: 1.5 }}>
        <div style={{ fontWeight: 700, color: "#eef5ff" }}>{location.estimatedAddress ?? "Local detectado"}</div>
        <div>
          Coordenadas mock: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
        </div>
        {location.referencePoints.length ? <div>Referências: {location.referencePoints.join(" • ")}</div> : null}
      </div>
      <style>{`@keyframes vgPulse { 0% { transform: scale(0.7); opacity: 1; } 100% { transform: scale(1.2); opacity: 0.05; } }`}</style>
    </div>
  );
}
