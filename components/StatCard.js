export default function StatCard({ label, value, icon, change, color = "#00B4D8" }) {
  return (
    <div
      className="stat-card"
      style={{
        border: `1px solid ${color}40`,
      }}
    >
      {/* Top Row: Label and Icon Badge */}
      <div style={styles.cardTop}>
        <span style={styles.cardLabel}>{label}</span>
        <div
          style={{
            ...styles.cardIconBox,
            backgroundColor: `${color}25`,
          }}
        >
          <span style={styles.cardIcon}>{icon}</span>
        </div>
      </div>

      {/* Big Bold Stat Value */}
      <div style={{ ...styles.cardValue, color: color }}>
        {value}
      </div>

      {/* Description / Subtitle */}
      <div style={styles.cardChange}>{change}</div>
    </div>
  );
}

const styles = {
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  },
  cardLabel: {
    fontSize: "12px",
    color: "#A0AEC0",
    fontWeight: "bold",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  cardIconBox: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cardIcon: {
    fontSize: "18px",
    lineHeight: 1,
  },
  cardValue: {
    fontSize: "34px",
    fontWeight: "900",
    lineHeight: 1.1,
    marginBottom: "6px",
    letterSpacing: "-0.5px",
  },
  cardChange: {
    fontSize: "12px",
    color: "#9E9E9E",
    fontWeight: "500",
  },
};
