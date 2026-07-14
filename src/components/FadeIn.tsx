import { useEffect, useState, type ReactNode } from "react";

export function FadeIn({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className={`space-y-4 transition-opacity duration-500 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      {children}
    </div>
  );
}
