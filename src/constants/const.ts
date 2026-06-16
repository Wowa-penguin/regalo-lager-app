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
};

export default constants;
