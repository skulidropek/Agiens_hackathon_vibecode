import React from "react";
import styles from "./SplitPanelLayout.module.css";

interface SplitPanelLayoutProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

const SplitPanelLayout: React.FC<SplitPanelLayoutProps> = ({ left, right }) => (
  <div className={styles.splitPanelRoot}>
    <div className={styles.leftPanel}>{left}</div>
    <div className={styles.rightPanel}>{right}</div>
  </div>
);

export default SplitPanelLayout; 