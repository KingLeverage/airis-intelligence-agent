import { parseGoogleMapsResults } from "./maps-parser.js";

const SAMPLE = `Results
Example Plumbing
4.5(123)
Plumber · 123 Main St
Open 24 hours · (208) 555-1234
"Great service"

Website

Directions
Book online`;

const parsed = parseGoogleMapsResults(SAMPLE);
console.log(JSON.stringify(parsed, null, 2));

if (parsed.length < 1) {
  console.error("expected at least 1 record");
  process.exit(1);
}
const first = parsed[0];
if (first.name !== "Example Plumbing") {
  console.error("bad name", first.name);
  process.exit(1);
}
if (first.rating !== 4.5) {
  console.error("bad rating", first.rating);
  process.exit(1);
}
if (first.reviewCount !== 123) {
  console.error("bad reviewCount", first.reviewCount);
  process.exit(1);
}
if (!first.phone || !String(first.phone).includes("555-1234")) {
  console.error("bad phone", first.phone);
  process.exit(1);
}
if (first.website !== null) {
  console.error("expected website null from text-only parser", first.website);
  process.exit(1);
}

console.log("maps-parser.test.ts: all assertions passed");
