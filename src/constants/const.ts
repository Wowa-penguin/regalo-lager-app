import { Platform } from "react-native";

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
