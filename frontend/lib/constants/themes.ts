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
  | "amber";

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
] as const;