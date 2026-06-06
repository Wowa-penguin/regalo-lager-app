import { StyleSheet } from "react-native";

const tabStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F0ED",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD3",
    backgroundColor: "#fff",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  headerSub: {
    fontSize: 13,
    color: "#aaa",
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2DAD3",
    backgroundColor: "#fff",
  },
  searchInput: {
    backgroundColor: "#F7F5F2",
    borderWidth: 1,
    borderColor: "#E2DAD3",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    color: "#1a1a1a",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  errorText: {
    color: "#C0392B",
    fontSize: 15,
    textAlign: "center",
  },
  retryButton: {
    borderWidth: 1.5,
    borderColor: "#208AEF",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: "#208AEF",
    fontSize: 15,
    fontWeight: "600",
  },
  emptyText: {
    color: "#aaa",
    fontSize: 15,
    textAlign: "center",
  },
  list: {
    padding: 14,
    gap: 10,
    flexGrow: 1,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2DAD3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    elevation: 1,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  productMeta: {
    fontSize: 13,
    color: "#aaa",
  },
  errorBanner: {
    backgroundColor: "#FDECEA",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#F5C6CB",
  },
  errorBannerText: {
    color: "#C0392B",
    fontSize: 14,
    textAlign: "center",
  },
});

export default tabStyles;
