import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../database/schemas';
import {
  GamePlayer,
  GameRoom,
  DropEvent,
  ScavengerCoupon,
  MAP_REGISTRY,
  ZAYCOIN_CONFIG,
} from './game.types';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  // Estado en memoria — no va a MongoDB
  private rooms = new Map<string, GameRoom>();
  private drops = new Map<string, DropEvent>();
  private scavengerCoupons = new Map<string, ScavengerCoupon>();

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    this.initRooms();
  }

  // ---------------------------------------------------------------------------
  // ROOMS / WORLD
  // ---------------------------------------------------------------------------

  private initRooms() {
    for (const map of MAP_REGISTRY) {
      this.rooms.set(map.id, {
        id: map.id,
        players: new Map(),
      });
    }
    this.logger.log(`Initialized ${this.rooms.size} game rooms`);
  }

  getRoom(mapId: string): GameRoom | undefined {
    return this.rooms.get(mapId);
  }

  getAllRooms(): GameRoom[] {
    return Array.from(this.rooms.values());
  }

  // ---------------------------------------------------------------------------
  // PLAYERS
  // ---------------------------------------------------------------------------

  async createPlayer(
    socketId: string,
    mapId: string,
    userId: string | null,
    username: string,
  ): Promise<GamePlayer> {
    const map = MAP_REGISTRY.find((m) => m.id === mapId) ?? MAP_REGISTRY[0];
    let zaycoins = 0;
    let isStarSeller = false;
    let activeSkin: string | null = null;

    if (userId) {
      const user = await this.userModel.findById(userId).select('+zaycoins +activeAvatarSkin +isStarSeller').lean();
      if (user) {
        zaycoins = (user as any).zaycoins ?? 0;
        isStarSeller = (user as any).isStarSeller ?? false;
        activeSkin = (user as any).activeAvatarSkin ?? null;
      }
    }

    const player: GamePlayer = {
      socketId,
      userId,
      username,
      x: map.spawnPoint.x,
      y: map.spawnPoint.y,
      direction: 'down',
      animation: 'idle',
      activeSkin,
      isStarSeller,
      zaycoins,
      mapId: map.id,
      joinedAt: new Date(),
    };

    const room = this.rooms.get(map.id);
    if (room) {
      room.players.set(socketId, player);
    }

    this.logger.log(`Player ${username} (${userId ?? 'guest'}) joined ${map.id}`);
    return player;
  }

  removePlayer(socketId: string): { player: GamePlayer; mapId: string } | null {
    for (const room of this.rooms.values()) {
      const player = room.players.get(socketId);
      if (player) {
        room.players.delete(socketId);
        return { player, mapId: room.id };
      }
    }
    return null;
  }

  getPlayer(socketId: string): GamePlayer | null {
    for (const room of this.rooms.values()) {
      const player = room.players.get(socketId);
      if (player) return player;
    }
    return null;
  }

  updatePlayerPosition(
    socketId: string,
    x: number,
    y: number,
    direction: string,
    animation: string,
  ): GamePlayer | null {
    const player = this.getPlayer(socketId);
    if (!player) return null;
    player.x = x;
    player.y = y;
    player.direction = direction as GamePlayer['direction'];
    player.animation = animation;
    return player;
  }

  getPlayersInRoom(mapId: string): GamePlayer[] {
    const room = this.rooms.get(mapId);
    if (!room) return [];
    return Array.from(room.players.values());
  }

  // ---------------------------------------------------------------------------
  // ZAYCOINS
  // ---------------------------------------------------------------------------

  async addZaycoins(socketId: string, amount: number, reason: string): Promise<number> {
    const player = this.getPlayer(socketId);
    if (!player) return 0;

    player.zaycoins += amount;

    // Persistir en MongoDB si el jugador está logueado
    if (player.userId) {
      await this.userModel.findByIdAndUpdate(player.userId, {
        $inc: { zaycoins: amount },
      });
      this.logger.log(`+${amount} Zaycoins a ${player.username} por ${reason}`);
    }

    return player.zaycoins;
  }

  async redeemZaycoins(
    socketId: string,
    tier: keyof typeof ZAYCOIN_CONFIG.redemption,
  ): Promise<{ success: boolean; couponCode?: string; newBalance?: number; error?: string }> {
    const player = this.getPlayer(socketId);
    if (!player || !player.userId) {
      return { success: false, error: 'Debes iniciar sesión para canjear Zaycoins' };
    }

    const cost = ZAYCOIN_CONFIG.redemption[tier];
    if (player.zaycoins < cost) {
      return {
        success: false,
        error: `Necesitás ${cost} Zaycoins (tenés ${player.zaycoins})`,
      };
    }

    // Generar código cupón único
    const couponCode = `ZAYCOIN-${tier.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    // Descontar coins y persistir
    player.zaycoins -= cost;
    await this.userModel.findByIdAndUpdate(player.userId, {
      $inc: { zaycoins: -cost },
    });

    // TODO Fase 3: crear cupón real en CouponService via inyección o evento interno

    return { success: true, couponCode, newBalance: player.zaycoins };
  }

  // ---------------------------------------------------------------------------
  // DROPS
  // ---------------------------------------------------------------------------

  createDrop(drop: DropEvent) {
    this.drops.set(drop.id, drop);
    this.logger.log(`Drop ${drop.id} creado en mapa ${drop.mapId}`);
  }

  claimDrop(dropId: string, userId: string | null, socketId: string): {
    success: boolean;
    reward?: DropEvent['reward'];
    remaining?: number;
    error?: string;
  } {
    const drop = this.drops.get(dropId);
    if (!drop) return { success: false, error: 'Drop no encontrado' };
    if (new Date() > drop.expiresAt) return { success: false, error: 'Drop expirado' };

    const claimKey = userId ?? socketId;
    if (drop.claims.includes(claimKey)) return { success: false, error: 'Ya reclamaste este drop' };
    if (drop.claims.length >= drop.maxClaims) return { success: false, error: 'Drop agotado' };

    drop.claims.push(claimKey);
    const remaining = drop.maxClaims - drop.claims.length;

    if (remaining === 0) {
      this.drops.delete(dropId); // limpieza
    }

    return { success: true, reward: drop.reward, remaining };
  }

  getActiveDrop(mapId: string): DropEvent | undefined {
    for (const drop of this.drops.values()) {
      if (drop.mapId === mapId && new Date() < drop.expiresAt) {
        return drop;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // SCAVENGER HUNT
  // ---------------------------------------------------------------------------

  spawnScavengerCoupon(coupon: ScavengerCoupon) {
    this.scavengerCoupons.set(coupon.id, coupon);
  }

  checkScavengerFind(socketId: string, x: number, y: number, mapId: string): ScavengerCoupon | null {
    for (const coupon of this.scavengerCoupons.values()) {
      if (coupon.mapId !== mapId) continue;
      if (coupon.foundBy.includes(socketId)) continue;
      if (new Date() > coupon.expiresAt) continue;

      const dist = Math.sqrt(Math.pow(x - coupon.x, 2) + Math.pow(y - coupon.y, 2));
      if (dist <= coupon.radius) {
        coupon.foundBy.push(socketId);
        return coupon;
      }
    }
    return null;
  }

  cleanExpiredEntities() {
    const now = new Date();
    for (const [id, drop] of this.drops) {
      if (now > drop.expiresAt) this.drops.delete(id);
    }
    for (const [id, coupon] of this.scavengerCoupons) {
      if (now > coupon.expiresAt) this.scavengerCoupons.delete(id);
    }
  }

  // ---------------------------------------------------------------------------
  // AVATAR / SKIN
  // ---------------------------------------------------------------------------

  async equipSkin(socketId: string, sku: string): Promise<boolean> {
    const player = this.getPlayer(socketId);
    if (!player || !player.userId) return false;

    // TODO: validar que el usuario realmente compró ese SKU (consulta a orders)
    player.activeSkin = sku;
    await this.userModel.findByIdAndUpdate(player.userId, { activeAvatarSkin: sku });
    return true;
  }
}
