import React from "react";
import styles from "../../styles/Skeleton.module.css";

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, width, height, borderRadius, style }) => {
  return (
    <div
      className={`${styles.skeleton} ${className || ""}`}
      style={{
        width,
        height,
        borderRadius: borderRadius || "var(--radius)",
        ...style,
      }}
    />
  );
};
