import { useState } from "react";

export default function DownloadButton({ onDownload }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onDownload();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button className="btn-primary" onClick={handleClick} disabled={loading}>
      {loading ? "Generating PDF…" : "Download PDF"}
    </button>
  );
}
