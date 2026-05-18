import { StyleSheet } from "react-native";
import constants from "@/constants/const";

const globalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: constants.defaultBackgroundColor,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: constants.cardBackground,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: constants.defaultBorderColor,
  },
  text: {
    fontSize: constants.defaultTextSize,
    fontFamily: constants.font,
  },
  smallText: {
    fontSize: constants.smallTextSize,
    fontFamily: constants.font,
  },
});

export default globalStyles;
