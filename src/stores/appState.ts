export interface FleetUnit {
  id: string;
  name: string;
  car: string;
  plate: string;
  rating: number;
  bat: number;
  status: 'ok' | 'low' | 'bad';
  lat: number;
  lng: number;
  locked: boolean;
}

export type ServiceType = 'ride' | 'food' | 'market' | 'pack';
export type TierType = 'economy' | 'comfort' | 'xl';

export const SERVICE_INFO: Record<ServiceType, { icon: string; title: string; sub: string; reqTitle: string; reqSub: string }> = {
  ride: { icon: 'electric-car', title: 'Viaje', sub: 'Ruta + conductor + pago', reqTitle: 'Solicitar viaje', reqSub: 'Origen / destino + estimación real' },
  food: { icon: 'restaurant', title: 'Comida', sub: 'Pedidos (simulación)', reqTitle: 'Pedir comida', reqSub: 'Restaurantes + carrito (simulación)' },
  market: { icon: 'shopping-cart', title: 'Despensa', sub: 'Entrega (simulación)', reqTitle: 'Comprar despensa', reqSub: 'Productos + entrega (simulación)' },
  pack: { icon: 'local-shipping', title: 'Paquetes', sub: 'Envío (simulación)', reqTitle: 'Enviar paquete', reqSub: 'Recolección + destino (simulación)' },
};

const MXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

export function formatMXN(value: number): string {
  return MXN.format(value);
}

export function computePrice(km: number, minutes: number, tier: TierType, pet: boolean, promo: boolean): number {
  const baseRide = 28, perKm = 9.8, perMin = 1.8;
  const mult = tier === 'economy' ? 1 : tier === 'comfort' ? 1.25 : 1.55;
  const petFee = pet ? 15 : 0;
  const promoDiscount = promo ? 0.10 : 0;
  let est = (baseRide + perKm * km + perMin * minutes) * mult + petFee;
  est = est * (1 - promoDiscount);
  return Math.round(est / 5) * 5;
}

// Toast state
let _toastCallback: ((msg: string) => void) | null = null;

export function setToastCallback(cb: (msg: string) => void) {
  _toastCallback = cb;
}

export function showToast(msg: string) {
  _toastCallback?.(msg);
}
