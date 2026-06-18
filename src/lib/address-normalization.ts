export function normalizeUnitAddress(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(street)\b/g, "st")
    .replace(/\b(avenue)\b/g, "ave")
    .replace(/\b(road)\b/g, "rd")
    .replace(/\b(drive)\b/g, "dr")
    .replace(/\b(court)\b/g, "ct")
    .replace(/\b(lane)\b/g, "ln")
    .replace(/\b(place)\b/g, "pl")
    .replace(/\b(circle)\b/g, "cir")
    .replace(/\b(north)\b/g, "n")
    .replace(/\b(south)\b/g, "s")
    .replace(/\b(east)\b/g, "e")
    .replace(/\b(west)\b/g, "w")
    .replace(/\b(apartment|apt|unit|suite|ste)\b/g, "#")
    .replace(/[^a-z0-9#]+/g, " ")
    .replace(/\s*#\s*/g, " #")
    .replace(/\s+/g, " ")
    .trim();
}
