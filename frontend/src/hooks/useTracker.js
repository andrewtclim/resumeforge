import { useState, useCallback, useEffect } from "react";
import {
  getApplications,
  createApplication,
  updateApplication,
  deleteApplication,
} from "../api/client";

export function useTracker() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getApplications();
      setApplications(data);
    } catch (err) {
      setError(err.message || "Failed to load applications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(async (entry) => {
    const created = await createApplication(entry);
    setApplications((prev) => [created, ...prev]);
    return created;
  }, []);

  const update = useCallback(async (id, patch) => {
    const updated = await updateApplication(id, patch);
    setApplications((prev) => prev.map((a) => (a.id === id ? updated : a)));
    return updated;
  }, []);

  const remove = useCallback(async (id) => {
    await deleteApplication(id);
    setApplications((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { applications, loading, error, load, add, update, remove };
}
