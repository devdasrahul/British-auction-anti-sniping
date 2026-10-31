import axios from 'axios';

function toCamelCase(str) {
  return str.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}

function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function isObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date);
}

export function keysToCamel(data) {
  if (Array.isArray(data)) {
    return data.map((item) => keysToCamel(item));
  }
  if (isObject(data)) {
    const result = {};
    for (const [key, val] of Object.entries(data)) {
      const camelKey = toCamelCase(key);
      const transformedVal = keysToCamel(val);
      result[key] = transformedVal;
      result[camelKey] = transformedVal;
    }
    return result;
  }
  return data;
}

export function keysToSnake(data) {
  if (Array.isArray(data)) {
    return data.map((item) => keysToSnake(item));
  }
  if (isObject(data)) {
    const result = {};
    for (const [key, val] of Object.entries(data)) {
      result[toSnakeCase(key)] = keysToSnake(val);
    }
    return result;
  }
  return data;
}

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token and convert outgoing body to snake_case
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && token !== 'undefined' && token !== 'null') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data && !(config.data instanceof FormData)) {
    config.data = keysToSnake(config.data);
  }
  return config;
});

// Convert response data to include camelCase aliases and handle 401
api.interceptors.response.use(
  (res) => {
    if (res.data) {
      res.data = keysToCamel(res.data);
    }
    return res;
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
