import { Product } from "@/types/product";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
  wrongProduct: { productId: string; barcode: string } | null;
  products: Product[];
  onClose: () => void;
}

export default function WrongOrderModal({ wrongProduct, products, onClose }: Props) {
  const name =
    products.find((p) => p.product_id === wrongProduct?.productId)?.name ||
    wrongProduct?.productId;

  return (
    <Modal
      visible={wrongProduct !== null}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Ekki rétt vara</Text>
          {wrongProduct && (
            <>
              <Text style={styles.product}>{name}</Text>
              <Text style={styles.body}>
                Þessi vara er skráð í kerfinu en er{" "}
                <Text style={styles.bold}>ekki hluti af þessari pöntun</Text>.
              </Text>
            </>
          )}
          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Áfram</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  sheet: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  icon: {
    fontSize: 44,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
  },
  product: {
    fontSize: 16,
    fontWeight: "600",
    color: "#555",
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  bold: {
    fontWeight: "700",
    color: "#C0392B",
  },
  button: {
    marginTop: 8,
    backgroundColor: "#C0392B",
    borderRadius: 12,
    paddingHorizontal: 36,
    paddingVertical: 15,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});
