import { Platform } from "react-native";

// Physical warehouse shelf order — categories listed top-to-bottom as they appear
// in the warehouse. Edit this list whenever the layout changes.
// Any category not listed here will appear after the listed ones, sorted alphabetically.
export const CATEGORY_ORDER: string[] = [
  "32",
  "43",
  "42",
  "44",
  "57",
  "11",
  "24",
  "35",
  "08",
  "28",
  "58",
  "05",
  "33",
  "34",
  "55",
  "07",
  "31",
  "38",
  "36",
  "37",
  "56",
  "20",
];

// Human-readable names for category codes — edit this whenever you want a
// category to display as something other than its raw code.
export const CATEGORY_NAMES: Record<string, string> = {
  // "32": "Þurrmat",
  "32": "Matrix Litir",
  "43": "RK litir",
  "42": "Rk",
  "44": "Mor Litir",
  "57": "Waterclouds",
  "11": "Tigi litir",
  "24": "Mor",
  "35": "Ker",
  "08": "Tigi",
  "28": "Maria Nila",
  "58": "HC",
  "05": "Mor Body",
  "33": "Loréal",
  "34": "Majirel",
  "55": "Dr.J",
  "07": "Trontveit",
  "31": "Matrix",
  "36": "Joico",
  "37": "Joico litir",
  "56": "UK lass",
  "20": "Lycon",
};

export const getCategoryName = (code: string): string =>
  CATEGORY_NAMES[code] ?? code;

const constants = {
  appName: "Regalo Lager",
  smallTextSize: 12,
  defaultTextSize: 16,
  bigText: 30,
  defaultBackgroundColor: "#F7F5F2",
  defaultBorderColor: "#E2DAD3",
  cardBackground: "#FFFFFF",
  subtleBorder: "#EDE8E2",
  font: Platform.OS === "ios" ? "System" : "monospace",
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "",
  appSecret: process.env.EXPO_PUBLIC_APP_SECRET ?? "",
};

export default constants;
