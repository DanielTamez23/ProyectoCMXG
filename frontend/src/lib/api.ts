import axios from "axios";

const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_BASE_URL = rawBaseUrl.replace(/\/$/, "");

export const api = axios.create({
  baseURL: API_BASE_URL,
});
