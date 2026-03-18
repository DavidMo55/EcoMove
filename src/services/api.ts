import { Platform } from 'react-native';

const API_PROD = 'https://ecomove-api.victoriousstone-478a0c94.eastus.azurecontainerapps.io/api';

const DEV_BASE = Platform.OS === 'android'
  ? 'http://10.0.2.2:3001/api'
  : 'http://localhost:3001/api';

const USE_PROD = true;
const BASE = USE_PROD ? API_PROD : DEV_BASE;

let _token: string | null = null;

export function setToken(token: string | null) {
  _token = token;
}

export function getToken(): string | null {
  return _token;
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (_token) {
    headers['Authorization'] = `Bearer ${_token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }

  return data as T;
}

// ─── Auth ───
export const auth = {
  register: (body: { email: string; password: string; name: string; phone?: string; role: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  me: () => request('/auth/me'),
};

// ─── Rides (User) ───
export const rides = {
  request: (body: {
    fromLat: number; fromLng: number; fromLabel: string;
    toLat: number; toLng: number; toLabel: string;
    service?: string; tier?: string; pet?: boolean; promo?: string;
    payment?: string; distanceKm?: number; durationMin?: number; price?: number;
  }) => request('/rides/request', { method: 'POST', body: JSON.stringify(body) }),

  active: () => request('/rides/active'),

  cancel: (rideId: string) =>
    request(`/rides/${rideId}/cancel`, { method: 'PUT' }),

  rate: (rideId: string, body: { stars: number; tip?: number; comment?: string }) =>
    request(`/rides/${rideId}/rate`, { method: 'POST', body: JSON.stringify(body) }),

  history: () => request('/rides/history'),
};

// ─── Driver ───
export const driver = {
  onboard: (body: {
    curp: string; phone: string; carModel: string; plate: string;
    documents: Array<{ type: string; folio: string }>;
  }) => request('/driver/onboard', { method: 'POST', body: JSON.stringify(body) }),

  updateLocation: (lat: number, lng: number) =>
    request('/driver/location', { method: 'PUT', body: JSON.stringify({ lat, lng }) }),

  setOnline: (online: boolean) =>
    request('/driver/online', { method: 'PUT', body: JSON.stringify({ online }) }),

  stats: () => request('/driver/stats'),

  incoming: () => request('/driver/incoming'),

  accept: (rideId: string) =>
    request(`/driver/accept/${rideId}`, { method: 'PUT' }),

  updateRideStatus: (rideId: string, status: string) =>
    request(`/driver/ride/${rideId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
};

// ─── Admin ───
export const admin = {
  fleet: () => request('/admin/fleet'),
  lockVehicle: (id: string) => request(`/admin/fleet/${id}/lock`, { method: 'PUT' }),
  shopVehicle: (id: string) => request(`/admin/fleet/${id}/shop`, { method: 'PUT' }),
  rechargeVehicle: (id: string) => request(`/admin/fleet/${id}/recharge`, { method: 'PUT' }),
  drivers: () => request('/admin/drivers'),
  stats: () => request('/admin/stats'),
  seedFleet: () => request('/admin/fleet/seed', { method: 'POST' }),
};
