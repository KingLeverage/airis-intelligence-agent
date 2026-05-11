/**
 * Printing Press CLI families shown in **Pre-Set Widgets → CLI catalog** flyout.
 * `id` values must match `familyId` from `GET …/cli-tools/catalog`.
 */
export const CLI_CATALOG_MENU_FAMILIES = [
  { id: "coingecko", label: "CoinGecko", emoji: "🪙", program: "coingecko-pp-cli" },
  { id: "docker-hub", label: "Docker Hub", emoji: "🐳", program: "docker-hub-pp-cli" },
  { id: "espn", label: "ESPN", emoji: "🏀", program: "espn-pp-cli" },
  { id: "flight-goat", label: "Flight Goat", emoji: "✈️", program: "flight-goat-pp-cli" },
  { id: "movie-goat", label: "Movie Goat", emoji: "🎬", program: "movie-goat-pp-cli" },
  { id: "pypi", label: "PyPI", emoji: "📦", program: "pypi-pp-cli" },
  { id: "recipe-goat", label: "Recipe Goat", emoji: "🍰", program: "recipe-goat-pp-cli" },
  { id: "twilio", label: "Twilio", emoji: "📱", program: "twilio-pp-cli" },
  { id: "x-twitter", label: "X (Twitter)", emoji: "𝕏", program: "x-twitter-pp-cli" },
] as const;

export type CliCatalogMenuFamilyId = (typeof CLI_CATALOG_MENU_FAMILIES)[number]["id"];
