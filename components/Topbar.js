export default function Topbar({ onToggleSidebar = () => {} }) {
  return (
    <header className="topbar-container" style={styles.topbar}>
      {/* Left: Mobile Toggle + Title */}
      <div style={styles.leftSection}>
        <button
          onClick={onToggleSidebar}
          className="mobile-menu-btn"
          aria-label="Toggle Navigation Menu"
        >
          ☰
        </button>

        <div>
          <h1 style={styles.title}>OPERATIONS DASHBOARD</h1>
          <p className="topbar-subtitle" style={styles.subtitle}>
            Sayyarah Platform • Master Control Console
          </p>
        </div>
      </div>

      {/* Right: Status Pill & Admin Profile */}
      <div style={styles.rightSection}>
        {/* Status Chip */}
        <div className="env-chip" style={styles.statusChip}>
          <span style={styles.statusDot} />
          <span>Realtime Sync</span>
        </div>

        {/* Profile Pill */}
        <div style={styles.profileChip}>
          <div style={styles.avatar}>A</div>
          <div style={styles.profileMeta}>
            <div style={styles.name}>Admin</div>
            <div style={styles.role}>Super Admin</div>
          </div>
        </div>
      </div>
    </header>
  );
}

const styles = {
  topbar: {
    height: "72px",
    backgroundColor: "rgba(24, 24, 24, 0.88)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderBottom: "1px solid #282828",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 32px",
    position: "sticky",
    top: 0,
    zIndex: 30,
    userSelect: "none",
  },
  leftSection: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  title: {
    fontSize: "16px",
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: "0.8px",
    margin: 0,
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: "12px",
    color: "#9E9E9E",
    margin: "3px 0 0 0",
  },
  rightSection: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  statusChip: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 14px",
    borderRadius: "20px",
    backgroundColor: "rgba(0, 180, 216, 0.12)",
    border: "1px solid rgba(0, 180, 216, 0.4)",
    color: "#00E5FF",
    fontSize: "12px",
    fontWeight: "bold",
    letterSpacing: "0.4px",
    whiteSpace: "nowrap",
  },
  statusDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    backgroundColor: "#00E5FF",
    boxShadow: "0 0 8px #00E5FF",
  },
  profileChip: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "4px 12px 4px 4px",
    backgroundColor: "#222222",
    borderRadius: "24px",
    border: "1px solid rgba(255, 255, 255, 0.08)",
  },
  avatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    backgroundColor: "#00B4D8",
    color: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: "13px",
  },
  profileMeta: {
    display: "flex",
    flexDirection: "column",
  },
  name: {
    fontSize: "12px",
    fontWeight: "bold",
    color: "#FFFFFF",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  },
  role: {
    fontSize: "10px",
    color: "#00B4D8",
    fontWeight: "600",
    whiteSpace: "nowrap",
  },
};
