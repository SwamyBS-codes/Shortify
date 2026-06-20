import axios from 'axios'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? 'https://urlshortner-api.duckdns.org/api' : '/api')

const httpClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

export function setAuthToken(token) {
  if (token) {
    httpClient.defaults.headers.common.Authorization = `Bearer ${token}`
  } else {
    delete httpClient.defaults.headers.common.Authorization
  }
}

export default httpClient
