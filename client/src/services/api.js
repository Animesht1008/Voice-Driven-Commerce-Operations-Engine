import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

export const createOrder = (payload) => api.post("/orders", payload);
export const fetchOrders = () => api.get("/orders");
export const fetchCallLogs = () => api.get("/calls");
export const simulateOrder = (orderId, payload) => api.post(`/orders/${orderId}/simulate`, payload);
export const deleteOrder = (orderId) => api.delete(`/orders/${orderId}`);

export default api;
