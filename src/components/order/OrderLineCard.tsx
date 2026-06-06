import { OrderLine } from "@/types/order";
import { Product } from "@/types/product";
import * as WebBrowser from "expo-web-browser";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
  line: OrderLine;
  picked: number;
  missing: number;
  isBarcodeMapped: boolean;
  product: Product | undefined;
  onPressStatus: () => void;
}

export default function OrderLineCard({
  line,
  picked,
  missing,
  isBarcodeMapped,
  product,
  onPressStatus,
}: Props) {
  const isComplete = picked >= line.quantity;
  const isPartial = picked > 0 && !isComplete;
  const isMissingAll = missing > 0 && picked === 0;
  const isMissingPartial = missing > 0 && picked > 0 && !isComplete;

  return (
    <View
      style={[
        styles.lineCard,
        isPartial && styles.lineCardPartial,
        isMissingPartial && styles.lineCardMissingPartial,
        isMissingAll && styles.lineCardMissingAll,
        isComplete && styles.lineCardComplete,
      ]}
    >
      <View style={styles.lineLeft}>
        <Pressable
          onPress={onPressStatus}
          hitSlop={6}
          style={[
            styles.statusRing,
            isComplete && styles.statusRingComplete,
            isPartial && styles.statusRingPartial,
          ]}
        >
          <Text
            style={[
              styles.statusIcon,
              isComplete && styles.statusIconComplete,
              isPartial && styles.statusIconPartial,
            ]}
          >
            {isComplete ? "✓" : isPartial ? "…" : "+"}
          </Text>
        </Pressable>
        <View style={styles.lineInfo}>
          <Text
            style={[
              styles.description,
              isComplete && styles.descriptionComplete,
            ]}
          >
            {line.description || line.item_code}
          </Text>
          {product?.total_quantity != null ? (
            <Text style={styles.itemCode}>
              {line.item_code} - magn: {product.total_quantity}
            </Text>
          ) : (
            <Text style={styles.itemCode}>{line.item_code}</Text>
          )}
        </View>
      </View>

      <View style={styles.lineRight}>
        <Text
          style={[
            styles.progress,
            isComplete && styles.progressComplete,
            isPartial && styles.progressPartial,
          ]}
        >
          {picked}/{line.quantity} {line.unit}
        </Text>
        {missing > 0 && (
          <View style={styles.missingBadge}>
            <Text style={styles.missingBadgeText}>{missing} vantar</Text>
          </View>
        )}
        <Pressable
          onPress={() =>
            WebBrowser.openBrowserAsync(
              `https://regalo.is/leit?q=${encodeURIComponent(line.item_code)}&page=1&pageIndex=0&pageSize=25`,
            )
          }
          hitSlop={8}
        >
          <Text style={styles.linkIcon}>↗</Text>
        </Pressable>
        <Text style={styles.checkmark}>{isBarcodeMapped ? "✅" : "❌"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lineCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2DAD3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 1,
    minHeight: 72,
  },
  lineCardComplete: {
    backgroundColor: "#F0FFF4",
    borderColor: "#C3E6CB",
  },
  lineCardPartial: {
    backgroundColor: "#EBF5FF",
    borderColor: "#BEE3F8",
  },
  lineCardMissingPartial: {
    backgroundColor: "#FFFDE7",
    borderColor: "#FFE082",
  },
  lineCardMissingAll: {
    backgroundColor: "#FFF0F0",
    borderColor: "#F5C6CB",
  },
  lineLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  statusRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#D0D0D0",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statusRingComplete: {
    backgroundColor: "#27AE60",
    borderColor: "#27AE60",
  },
  statusRingPartial: {
    borderColor: "#208AEF",
  },
  statusIcon: {
    fontSize: 15,
    color: "#C0C0C0",
  },
  statusIconComplete: {
    color: "#fff",
    fontWeight: "700",
  },
  statusIconPartial: {
    color: "#208AEF",
    fontWeight: "700",
  },
  lineInfo: {
    flex: 1,
    gap: 3,
  },
  description: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    lineHeight: 22,
  },
  descriptionComplete: {
    color: "#27AE60",
  },
  itemCode: {
    fontSize: 12,
    color: "#aaa",
  },
  lineRight: {
    alignItems: "flex-end",
    gap: 6,
    marginLeft: 8,
  },
  progress: {
    fontSize: 15,
    fontWeight: "700",
    color: "#C0C0C0",
    flexShrink: 0,
  },
  progressComplete: {
    color: "#27AE60",
  },
  progressPartial: {
    color: "#208AEF",
  },
  missingBadge: {
    backgroundColor: "#FDECEA",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: "flex-end",
  },
  missingBadgeText: {
    color: "#C0392B",
    fontSize: 12,
    fontWeight: "600",
  },
  linkIcon: {
    fontSize: 16,
    color: "#208AEF",
    fontWeight: "600",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  checkmark: {
    fontSize: 10,
  },
});
