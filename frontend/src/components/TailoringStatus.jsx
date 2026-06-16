import { useEffect, useState } from "react";

const DOTS = ["", ".", "..", "..."];

export default function TailoringStatus({ message }) {
  const [dotIndex, setDotIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setDotIndex((i) => (i + 1) % DOTS.length), 400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="status-container">
      <div className="status-spinner" aria-hidden="true" />
      <p className="status-message">
        {message}
        <span style={{ display: "inline-block", width: "2ch" }}>{DOTS[dotIndex]}</span>
      </p>
      <p className="status-hint">This usually takes 15–30 seconds.</p>
    </div>
  );
}
