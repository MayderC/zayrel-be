/**
 * Tipos compartidos para el módulo de juego (Zayrel Plaza).
 * Estado en memoria — nada de esto persiste en MongoDB directamente.
 */

export interface GamePlayer {
  socketId: string;
  userId: string | null;   // null = invitado
  username: string;
  x: number;
  y: number;
  direction: 'down' | 'up' | 'left' | 'right';
  animation: string;
  activeSkin: string | null;  // SKU de camiseta equipada, null = default
  isStarSeller: boolean;
  zaycoins: number;
  mapId: string;
  joinedAt: Date;
}

export interface GameRoom {
  id: string;          // 'plaza' | 'anime-zone' | etc.
  players: Map<string, GamePlayer>; // socketId → player
}

export interface DropEvent {
  id: string;
  mapId: string;
  x: number;
  y: number;
  maxClaims: number;
  claims: string[];    // userIds que ya reclamaron
  expiresAt: Date;
  reward: DropReward;
}

export interface DropReward {
  type: 'coupon' | 'zaycoins' | 'design_unlock';
  value: string | number; // código cupón o cantidad de coins
  label: string;          // "15% de descuento"
}

export interface ScavengerCoupon {
  id: string;
  mapId: string;
  x: number;
  y: number;
  radius: number;       // píxeles de rango de "encuentro"
  couponCode: string;
  discount: string;     // "15%"
  expiresAt: Date;
  foundBy: string[];    // socketIds que ya lo encontraron (uno por coupon)
}

export interface ZaycoinConfig {
  rewards: Record<string, number>;
  redemption: Record<string, number>;
}

export const ZAYCOIN_CONFIG: ZaycoinConfig = {
  rewards: {
    trivia_4_of_5: 200,
    trivia_5_of_5: 500,
    football_win: 500,
    scavenger_find: 150,
    fashion_battle_win: 800,
    daily_login: 50,
    drop_claim: 300,
  },
  redemption: {
    free_shipping: 1000,
    discount_20pct: 2500,
    free_shirt: 5000,
  },
};

// Configuración de mapas disponibles
export interface MapZone {
  id: string;
  type: 'shop' | 'minigame' | 'secret' | 'vip' | 'spawn';
  rect: [number, number, number, number]; // x, y, w, h
  linkTo?: string;   // URL para zonas tipo 'shop'
  minigameId?: string;
}

export interface MapConfig {
  id: string;
  name: string;
  jsonUrl: string;   // Ruta al archivo Tiled JSON en /public
  spawnPoint: { x: number; y: number };
  zones: MapZone[];
}

// Registro de mapas — para añadir un mapa, solo agregar una entrada aquí
export const MAP_REGISTRY: MapConfig[] = [
  {
    id: 'plaza',
    name: 'Zayrel Plaza',
    jsonUrl: '/game/maps/plaza.json',
    spawnPoint: { x: 400, y: 300 },
    zones: [
      {
        id: 'perchero-anime',
        type: 'shop',
        rect: [100, 100, 200, 200],
        linkTo: '/store/shop?category=anime',
      },
      {
        id: 'perchero-regular',
        type: 'shop',
        rect: [350, 100, 200, 200],
        linkTo: '/store/shop',
      },
      {
        id: 'minigames-zone',
        type: 'minigame',
        rect: [600, 200, 300, 250],
      },
      {
        id: 'cueva',
        type: 'secret',
        rect: [800, 400, 150, 150],
      },
    ],
  },
];
