import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status || "SIN_RESPUESTA";
    const url = error.config?.url || "URL_DESCONOCIDA";
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Error desconocido";

    console.error("[API]", status, url, message);

    return Promise.reject(error);
  },
);

export default api;
