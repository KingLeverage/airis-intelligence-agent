/**
 * Index of the 100 agentic widget build prompts (id, category, title).
 * Use with SFT / eval: pair each row with the full natural-language prompt body
 * (see repo `docs/widget-build-prompt-catalog.md`).
 */
export type WidgetBuildPromptCategory =
  | "music-audio"
  | "games-play"
  | "notes-writing"
  | "news-information"
  | "productivity-time"
  | "calculators-tools"
  | "visual-creative"
  | "data-charts"
  | "social-communication"
  | "developer-utilities"
  | "wellness-lifestyle"
  | "maps-location";

export type WidgetBuildPromptIndexEntry = {
  readonly id: number;
  readonly category: WidgetBuildPromptCategory;
  readonly title: string;
};

export const WIDGET_BUILD_PROMPT_INDEX: readonly WidgetBuildPromptIndexEntry[] = [
  { id: 1, category: "music-audio", title: "Two-Row Drum Machine" },
  { id: 2, category: "music-audio", title: "Piano Roll Mini Sequencer" },
  { id: 3, category: "music-audio", title: "Chord Progression Generator" },
  { id: 4, category: "music-audio", title: "Looping Audio Recorder" },
  { id: 5, category: "music-audio", title: "Metronome with Visual Pulse" },
  { id: 6, category: "music-audio", title: "Synthesizer Keyboard" },
  { id: 7, category: "music-audio", title: "Audio Visualizer" },
  { id: 8, category: "music-audio", title: "Spotify-Style Mini Player" },
  { id: 9, category: "music-audio", title: "Karaoke Lyric Display" },
  { id: 10, category: "music-audio", title: "Guitar Tuner" },
  { id: 11, category: "games-play", title: "Simple Snake Game" },
  { id: 12, category: "games-play", title: "Tic-Tac-Toe with AI" },
  { id: 13, category: "games-play", title: "Memory Match Card Game" },
  { id: 14, category: "games-play", title: "2048 Puzzle" },
  { id: 15, category: "games-play", title: "Whack-a-Mole" },
  { id: 16, category: "games-play", title: "Hangman" },
  { id: 17, category: "games-play", title: "Rock Paper Scissors" },
  { id: 18, category: "games-play", title: "Connect Four" },
  { id: 19, category: "games-play", title: "Minesweeper" },
  { id: 20, category: "games-play", title: "Reaction Time Tester" },
  { id: 21, category: "games-play", title: "Typing Speed Test" },
  { id: 22, category: "games-play", title: "Pong" },
  { id: 23, category: "notes-writing", title: "WYSIWYG Notes Editor" },
  { id: 24, category: "notes-writing", title: "Markdown Live Editor" },
  { id: 25, category: "notes-writing", title: "Sticky Notes Board" },
  { id: 26, category: "notes-writing", title: "Daily Journal" },
  { id: 27, category: "notes-writing", title: "Pomodoro Notes" },
  { id: 28, category: "notes-writing", title: "Mind Map Builder" },
  { id: 29, category: "notes-writing", title: "Outliner" },
  { id: 30, category: "notes-writing", title: "Quick Snippet Manager" },
  { id: 31, category: "notes-writing", title: "Voice-to-Text Notes" },
  { id: 32, category: "notes-writing", title: "Distraction-Free Writer" },
  { id: 33, category: "news-information", title: "International News Feed" },
  { id: 34, category: "news-information", title: "Hacker News Reader" },
  { id: 35, category: "news-information", title: "Reddit Subreddit Viewer" },
  { id: 36, category: "news-information", title: "Crypto Price Ticker" },
  { id: 37, category: "news-information", title: "Stock Watchlist" },
  { id: 38, category: "news-information", title: "Weather Forecast Card" },
  { id: 39, category: "news-information", title: "Wikipedia Random Article" },
  { id: 40, category: "news-information", title: "GitHub Trending Repos" },
  { id: 41, category: "productivity-time", title: "Kanban Board" },
  { id: 42, category: "productivity-time", title: "To-Do List with Categories" },
  { id: 43, category: "productivity-time", title: "Habit Tracker" },
  { id: 44, category: "productivity-time", title: "Calendar Widget" },
  { id: 45, category: "productivity-time", title: "Countdown Timer" },
  { id: 46, category: "productivity-time", title: "Pomodoro Timer Pro" },
  { id: 47, category: "productivity-time", title: "Time Zone Converter" },
  { id: 48, category: "productivity-time", title: "Eisenhower Matrix" },
  { id: 49, category: "productivity-time", title: "Goal Tracker" },
  { id: 50, category: "productivity-time", title: "Daily Schedule Planner" },
  { id: 51, category: "productivity-time", title: "Meeting Cost Calculator" },
  { id: 52, category: "productivity-time", title: "Focus Session Tracker" },
  { id: 53, category: "calculators-tools", title: "Scientific Calculator" },
  { id: 54, category: "calculators-tools", title: "Unit Converter" },
  { id: 55, category: "calculators-tools", title: "Tip Calculator" },
  { id: 56, category: "calculators-tools", title: "Mortgage Calculator" },
  { id: 57, category: "calculators-tools", title: "BMI Calculator" },
  { id: 58, category: "calculators-tools", title: "Color Picker & Palette Generator" },
  { id: 59, category: "calculators-tools", title: "Password Generator" },
  { id: 60, category: "calculators-tools", title: "QR Code Generator" },
  { id: 61, category: "calculators-tools", title: "Regex Tester" },
  { id: 62, category: "calculators-tools", title: "JSON Formatter & Validator" },
  { id: 63, category: "visual-creative", title: "Canvas Drawing Pad" },
  { id: 64, category: "visual-creative", title: "Pixel Art Editor" },
  { id: 65, category: "visual-creative", title: "Gradient Generator" },
  { id: 66, category: "visual-creative", title: "Logo Mockup Previewer" },
  { id: 67, category: "visual-creative", title: "Image Filter Studio" },
  { id: 68, category: "visual-creative", title: "Typography Pairing Tool" },
  { id: 69, category: "visual-creative", title: "SVG Icon Library" },
  { id: 70, category: "visual-creative", title: "Mood Board Builder" },
  { id: 71, category: "visual-creative", title: "CSS Box Shadow Generator" },
  { id: 72, category: "visual-creative", title: "Animated Loader Gallery" },
  { id: 73, category: "data-charts", title: "Live Bar Chart Builder" },
  { id: 74, category: "data-charts", title: "Pie/Donut Chart Maker" },
  { id: 75, category: "data-charts", title: "CSV Viewer & Sorter" },
  { id: 76, category: "data-charts", title: "Polling Widget" },
  { id: 77, category: "data-charts", title: "Heatmap Calendar" },
  { id: 78, category: "data-charts", title: "Word Cloud Generator" },
  { id: 79, category: "data-charts", title: "Sankey Diagram Builder" },
  { id: 80, category: "data-charts", title: "Survey Builder" },
  { id: 81, category: "social-communication", title: "Live Chat Widget" },
  { id: 82, category: "social-communication", title: "Comment Thread" },
  { id: 83, category: "social-communication", title: "Tweet Composer Mockup" },
  { id: 84, category: "social-communication", title: "Emoji Reaction Bar" },
  { id: 85, category: "social-communication", title: "Username Availability Checker" },
  { id: 86, category: "social-communication", title: "Group Voting Tool" },
  { id: 87, category: "developer-utilities", title: "API Request Tester" },
  { id: 88, category: "developer-utilities", title: "Lorem Ipsum Generator" },
  { id: 89, category: "developer-utilities", title: "Diff Viewer" },
  { id: 90, category: "developer-utilities", title: "UUID / Hash Generator" },
  { id: 91, category: "developer-utilities", title: "Cron Expression Builder" },
  { id: 92, category: "developer-utilities", title: "Base64 Encoder/Decoder" },
  { id: 93, category: "wellness-lifestyle", title: "Breathing Exercise Guide" },
  { id: 94, category: "wellness-lifestyle", title: "Water Intake Tracker" },
  { id: 95, category: "wellness-lifestyle", title: "Mood Tracker" },
  { id: 96, category: "wellness-lifestyle", title: "Recipe Card Display" },
  { id: 97, category: "maps-location", title: "Interactive Map Pin Drop" },
  { id: 98, category: "maps-location", title: "Distance Calculator" },
  { id: 99, category: "maps-location", title: "Country Explorer" },
  { id: 100, category: "maps-location", title: "Live ISS Tracker" },
] as const;

export function widgetBuildPromptMeta(
  id: number,
): WidgetBuildPromptIndexEntry | undefined {
  return WIDGET_BUILD_PROMPT_INDEX.find((e) => e.id === id);
}
