import axios from "axios";

const api = axios.create({
  // In dev Vite runs on :5173 and the backend on :8000.
  // In production the frontend is served by FastAPI, so same origin.
  baseURL: import.meta.env.DEV ? "http://localhost:8000" : "",
  timeout: 90000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("app_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the token is rejected, clear it so the login screen reappears.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("app_token");
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export const getCv = () =>
  api.get("/api/cv").then((r) => r.data.content);

export const saveCv = (content) =>
  api.post("/api/cv", { content }).then((r) => r.data);

export const scrapeJob = (url) =>
  api.post("/api/scrape", { url }).then((r) => r.data.text);

export const tailorResume = (payload) =>
  api.post("/api/tailor", payload).then((r) => r.data);

export const refineResume = (payload) =>
  api.post("/api/refine", payload).then((r) => r.data);

export const renderPdf = (resume) =>
  api
    .post("/api/render", { resume }, { responseType: "blob" })
    .then((r) => r.data);

export const verifyToken = (token) =>
  axios.get(
    import.meta.env.DEV ? "http://localhost:8000/api/ping" : "/api/ping",
    { headers: { Authorization: `Bearer ${token}` } }
  );

export const getApplications = () =>
  api.get("/api/applications").then((r) => r.data);

export const createApplication = (app) =>
  api.post("/api/applications", app).then((r) => r.data);

export const updateApplication = (id, patch) =>
  api.put(`/api/applications/${id}`, patch).then((r) => r.data);

export const deleteApplication = (id) =>
  api.delete(`/api/applications/${id}`);
