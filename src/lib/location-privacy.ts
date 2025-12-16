export function safeLocationLabel(opts: {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
}) {
  const name = (opts.name ?? "").trim();
  const city = (opts.city ?? "").trim();

  if (name) return name;
  if (city) return city;

  return "Nearby";
}

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function encodeGeohash(lat: number, lng: number, precision = 6): string {
  let latMin = -90,
    latMax = 90;
  let lngMin = -180,
    lngMax = 180;
  let hash = "";
  let bit = 0;
  let ch = 0;
  let isEven = true;

  while (hash.length < precision) {
    if (isEven) {
      const mid = (lngMin + lngMax) / 2;
      if (lng > mid) {
        ch |= 1 << (4 - bit);
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat > mid) {
        ch |= 1 << (4 - bit);
        latMin = mid;
      } else {
        latMax = mid;
      }
    }

    isEven = !isEven;
    bit++;

    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

export function obfuscateCoordinates(
  lat: number,
  lng: number,
  jitterMeters = 100
): { lat: number; lng: number } {
  const earthRadius = 6371000;
  const latJitter = (Math.random() - 0.5) * 2 * jitterMeters;
  const lngJitter = (Math.random() - 0.5) * 2 * jitterMeters;

  const newLat = lat + (latJitter / earthRadius) * (180 / Math.PI);
  const newLng =
    lng +
    ((lngJitter / earthRadius) * (180 / Math.PI)) /
      Math.cos((lat * Math.PI) / 180);

  return {
    lat: parseFloat(newLat.toFixed(6)),
    lng: parseFloat(newLng.toFixed(6)),
  };
}

export function getProximityLabel(distanceMeters: number): string {
  if (distanceMeters < 50) return "Right here";
  if (distanceMeters < 100) return "Very close";
  if (distanceMeters < 500) return "Nearby";
  if (distanceMeters < 1000) return "Close by";
  if (distanceMeters < 5000) return "In the area";
  return "Far away";
}