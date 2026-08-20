export type ThemeId =
  | "fig"
  | "ember"
  | "ocean"
  | "forest"
  | "royal"
  | "graphite"
  | "sunset"
  | "rose"
  | "ice"
  | "gold"
  | "burgundy"
  | "aqua"
  | "lilac"
  | "mint"
  | "sand"
  | "crimson"
  | "teal"
  | "pink"
  | "kiwi"
  | "watermelon"
  | "midnight"
  | "lavender"
  | "coral"
  | "sage"
  | "copper"
  | "nordic"
  | "cherry"
  | "carbon"
  | "slate"
  | "amber"
  | "plum"
  | "seafoam"
  | "tangerine"
  | "wine"
  | "petrol"
  | "olive"
  | "mocha"
  | "sky"
  | "grape"
  | "cobalt"
  | "brick"
  | "denim"
  | "peach"
  | "indigo"
  | "avocado"
  | "sapphire"
  | "tulip"
  | "honey"
  | "moss"
  | "storm"
  | "fuchsia"
  | "rust"
  | "jade"
  | "orchid";

export type ThemeDef = {
  id: ThemeId;
  label: string;
  description: string;
  swatch: string[];
};

export const DEFAULT_THEME: ThemeId = "fig";

export const THEME_STORAGE_KEY = "fig.theme";

export const THEMES: ThemeDef[] = [
  {
    id: "fig",
    label: "Fig",
    description: "Deep plum with warm stone neutrals.",
    swatch: ["#9b3f68", "#421a2e", "#faf8f3"],
  },
  {
    id: "ember",
    label: "Ember",
    description: "The classic fiery orange on cool grey.",
    swatch: ["#ff5018", "#c1380d", "#f9f9f9"],
  },
  {
    id: "ocean",
    label: "Ocean",
    description: "Calm blues on soft slate.",
    swatch: ["#3b6ee0", "#182c53", "#f8fafc"],
  },
  {
    id: "forest",
    label: "Forest",
    description: "Fresh greens on warm stone.",
    swatch: ["#3a9d4c", "#183f23", "#fafaf7"],
  },
  {
    id: "royal",
    label: "Royal",
    description: "Regal violet with plum-grey neutrals.",
    swatch: ["#7a4fc4", "#311e53", "#faf8fa"],
  },
  {
    id: "graphite",
    label: "Graphite",
    description: "Clean charcoal greys with a steel blue accent.",
    swatch: ["#3f5b84", "#0d1117", "#f6f8fa"],
  },
  {
    id: "sunset",
    label: "Sunset",
    description: "Warm coral and amber on soft sand.",
    swatch: ["#f97316", "#c2410c", "#fff7ed"],
  },
  {
    id: "rose",
    label: "Rose",
    description: "Soft pink accents on gentle cream.",
    swatch: ["#e11d48", "#881337", "#fff1f2"],
  },
  {
    id: "ice",
    label: "Ice",
    description: "Frosty cyan-blue on light slate.",
    swatch: ["#0891b2", "#164e63", "#ecfeff"],
  },
  {
    id: "gold",
    label: "Gold",
    description: "Luxe amber on warm ivory.",
    swatch: ["#d97706", "#92400e", "#fefce8"],
  },
  {
    id: "burgundy",
    label: "Burgundy",
    description: "Rich wine red on soft porcelain.",
    swatch: ["#b91c1c", "#7f1d1d", "#fef2f2"],
  },
  {
    id: "aqua",
    label: "Aqua",
    description: "Fresh aqua teal on pale mist.",
    swatch: ["#0d9488", "#115e59", "#f0fdfa"],
  },
  {
    id: "lilac",
    label: "Lilac",
    description: "Gentle lilac on pale lavender.",
    swatch: ["#8b5cf6", "#6d28d9", "#f5f3ff"],
  },
  {
    id: "mint",
    label: "Mint",
    description: "Cool mint green on soft white.",
    swatch: ["#059669", "#065f46", "#ecfdf5"],
  },
  {
    id: "sand",
    label: "Sand",
    description: "Warm earthy tan on pale linen.",
    swatch: ["#b45309", "#78350f", "#fbf7ef"],
  },
  {
    id: "crimson",
    label: "Crimson",
    description: "Bold scarlet on ivory.",
    swatch: ["#dc2626", "#991b1b", "#fef2f2"],
  },
  {
    id: "teal",
    label: "Teal",
    description: "Deep teal on soft sea mist.",
    swatch: ["#0f766e", "#134e4a", "#f0fdfa"],
  },
  {
    id: "pink",
    label: "Pink",
    description: "Bright pink on blush.",
    swatch: ["#ec4899", "#9d174d", "#fdf2f8"],
  },
  {
    id: "kiwi",
    label: "Kiwi",
    description: "Fresh lime green on soft cream.",
    swatch: ["#84cc16", "#365314", "#f7fee7"],
  },
  {
    id: "watermelon",
    label: "Watermelon",
    description: "Juicy pink-red on cream.",
    swatch: ["#f43f5e", "#4c0519", "#fdfbf7"],
  },
  {
    id: "midnight",
    label: "Midnight",
    description: "Deep navy on dark charcoal.",
    swatch: ["#1e3a5f", "#0c1929", "#f0f4f8"],
  },
  {
    id: "lavender",
    label: "Lavender",
    description: "Soft lavender on pale wisteria.",
    swatch: ["#a78bfa", "#7c3aed", "#faf5ff"],
  },
  {
    id: "coral",
    label: "Coral",
    description: "Warm coral on soft peach.",
    swatch: ["#fb7185", "#be123c", "#fff1f2"],
  },
  {
    id: "sage",
    label: "Sage",
    description: "Muted sage green on warm linen.",
    swatch: ["#86a88a", "#4a6e50", "#f4f7f4"],
  },
  {
    id: "copper",
    label: "Copper",
    description: "Rich copper on warm clay.",
    swatch: ["#c77a3c", "#8b4513", "#fdf6ee"],
  },
  {
    id: "nordic",
    label: "Nordic",
    description: "Cool Scandinavian blue on crisp white.",
    swatch: ["#5b8fb9", "#2c4a6e", "#f5f8fb"],
  },
  {
    id: "cherry",
    label: "Cherry",
    description: "Deep cherry red on soft rose.",
    swatch: ["#c2185b", "#880e4f", "#fce4ec"],
  },
  {
    id: "carbon",
    label: "Carbon",
    description: "Dark carbon with electric blue accent.",
    swatch: ["#3b82f6", "#111827", "#f9fafb"],
  },
  {
    id: "slate",
    label: "Slate",
    description: "Professional blue-grey on light ash.",
    swatch: ["#64748b", "#334155", "#f8fafc"],
  },
  {
    id: "amber",
    label: "Amber",
    description: "Rich amber on warm cream.",
    swatch: ["#f59e0b", "#b45309", "#fffbeb"],
  },
  {
    id: "plum",
    label: "Plum",
    description: "Deep plum purple on warm lavender.",
    swatch: ["#9d4d80", "#462037", "#faf9fa"],
  },
  {
    id: "seafoam",
    label: "Seafoam",
    description: "Soft seafoam green on light aqua.",
    swatch: ["#26c08e", "#0f513f", "#effdf7"],
  },
  {
    id: "tangerine",
    label: "Tangerine",
    description: "Bright tangerine on warm cream.",
    swatch: ["#f97a12", "#7a310e", "#fdfbf8"],
  },
  {
    id: "wine",
    label: "Wine",
    description: "Deep wine on soft rose.",
    swatch: ["#bd4566", "#5c1f32", "#fcf4f6"],
  },
  {
    id: "petrol",
    label: "Petrol",
    description: "Deep petrol teal-blue on light grey.",
    swatch: ["#2d8793", "#213d47", "#f8fafb"],
  },
  {
    id: "olive",
    label: "Olive",
    description: "Olive green on warm sand.",
    swatch: ["#8c9d4f", "#3a4228", "#fbfaf6"],
  },
  {
    id: "mocha",
    label: "Mocha",
    description: "Rich mocha brown on warm cream.",
    swatch: ["#a96f49", "#4e3129", "#fdfbf8"],
  },
  {
    id: "sky",
    label: "Sky",
    description: "Bright sky blue on crisp white.",
    swatch: ["#2597ff", "#144684", "#fafbfc"],
  },
  {
    id: "grape",
    label: "Grape",
    description: "Vibrant grape purple on pale grey.",
    swatch: ["#8f63d9", "#4a2c6d", "#faf9fb"],
  },
  {
    id: "cobalt",
    label: "Cobalt",
    description: "Bold cobalt blue on slate.",
    swatch: ["#2e7bff", "#153884", "#f8fafc"],
  },
  {
    id: "brick",
    label: "Brick",
    description: "Terracotta brick on warm grey.",
    swatch: ["#bc5f3c", "#602b20", "#faf9f8"],
  },
  {
    id: "denim",
    label: "Denim",
    description: "Denim blue on soft blue-grey.",
    swatch: ["#497db2", "#263b55", "#f8fafc"],
  },
  {
    id: "peach",
    label: "Peach",
    description: "Soft peach on warm ivory.",
    swatch: ["#f95f32", "#7e2716", "#fdfbf8"],
  },
  {
    id: "indigo",
    label: "Indigo",
    description: "Deep indigo on light slate.",
    swatch: ["#6366f1", "#312e81", "#f8fafc"],
  },
  {
    id: "avocado",
    label: "Avocado",
    description: "Avocado green on warm cream.",
    swatch: ["#90a143", "#3c4322", "#fbfaf7"],
  },
  {
    id: "sapphire",
    label: "Sapphire",
    description: "Sapphire blue on deep navy.",
    swatch: ["#2597ff", "#144384", "#f4f7fb"],
  },
  {
    id: "tulip",
    label: "Tulip",
    description: "Tulip red on soft cream.",
    swatch: ["#f93333", "#801616", "#fdfbf9"],
  },
  {
    id: "honey",
    label: "Honey",
    description: "Honey gold on warm white.",
    swatch: ["#f9b61a", "#7a4114", "#fdfcf8"],
  },
  {
    id: "moss",
    label: "Moss",
    description: "Moss green on pale stone.",
    swatch: ["#64894f", "#2c3a27", "#fafaf7"],
  },
  {
    id: "storm",
    label: "Storm",
    description: "Stormy blue-grey on light grey.",
    swatch: ["#718690", "#3a4248", "#fafafa"],
  },
  {
    id: "fuchsia",
    label: "Fuchsia",
    description: "Vivid fuchsia on pale pink.",
    swatch: ["#d946ef", "#6a1576", "#fbf9fb"],
  },
  {
    id: "rust",
    label: "Rust",
    description: "Rust orange-red on warm beige.",
    swatch: ["#b85d47", "#5a2e28", "#fbfaf7"],
  },
  {
    id: "jade",
    label: "Jade",
    description: "Jade green on pale green-grey.",
    swatch: ["#14b589", "#0e4c3e", "#f7faf9"],
  },
  {
    id: "orchid",
    label: "Orchid",
    description: "Orchid purple on pale lavender.",
    swatch: ["#c25cc4", "#5c265c", "#faf9fb"],
  },
] as const;