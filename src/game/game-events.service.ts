import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { MAP_REGISTRY } from './game.types';
import { v4 as uuidv4 } from 'uuid';

/**
 * GameEventsService — maneja eventos programados del juego:
 * - Drops (cofres con recompensas)
 * - Scavenger Hunt (cupones ocultos en el mapa)
 *
 * Para programar un drop manual, llamar a scheduleManualDrop() desde
 * el dashboard de admin (Fase 3).
 */
@Injectable()
export class GameEventsService {
  private readonly logger = new Logger(GameEventsService.name);
  private gateway: GameGateway | null = null;

  constructor(private readonly gameService: GameService) {}

  // Inyección tardía para evitar dependencia circular Gateway ↔ EventsService
  setGateway(gateway: GameGateway) {
    this.gateway = gateway;
  }

  // ---------------------------------------------------------------------------
  // DROPS AUTOMÁTICOS — cada 6 horas
  // ---------------------------------------------------------------------------

  @Cron('0 */6 * * *') // cada 6 horas
  async handleScheduledDrop() {
    this.logger.log('🎁 Iniciando drop programado...');

    for (const map of MAP_REGISTRY) {
      await this.triggerDrop(map.id, {
        type: 'coupon',
        value: `DROP-${Date.now().toString(36).toUpperCase()}`,
        label: '20% de descuento',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // SCAVENGER HUNT — cada hora
  // ---------------------------------------------------------------------------

  @Cron(CronExpression.EVERY_HOUR)
  handleScavengerHunt() {
    this.logger.log('🗺️ Spawneando cupones de Scavenger Hunt...');

    for (const map of MAP_REGISTRY) {
      // Spawnear 3 cupones en posiciones aleatorias del mapa
      for (let i = 0; i < 3; i++) {
        const id = uuidv4();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

        const discounts = ['10%', '15%', '20%'];
        const discount = discounts[Math.floor(Math.random() * discounts.length)];

        this.gameService.spawnScavengerCoupon({
          id,
          mapId: map.id,
          x: Math.random() * 800 + 50,
          y: Math.random() * 500 + 50,
          radius: 40, // píxeles
          couponCode: `HUNT-${id.slice(0, 6).toUpperCase()}`,
          discount,
          expiresAt,
          foundBy: [],
        });
      }

      this.logger.log(`3 cupones spawneados en ${map.id}`);
    }
  }

  // ---------------------------------------------------------------------------
  // LIMPIEZA — cada 10 minutos
  // ---------------------------------------------------------------------------

  @Cron('*/10 * * * *')
  handleCleanup() {
    this.gameService.cleanExpiredEntities();
  }

  // ---------------------------------------------------------------------------
  // TRIGGER MANUAL / DESDE ADMIN
  // ---------------------------------------------------------------------------

  async triggerDrop(
    mapId: string,
    reward: { type: 'coupon' | 'zaycoins'; value: string | number; label: string },
    countdownSeconds = 300, // 5 min de aviso
  ) {
    const dropId = uuidv4();
    const expiresAt = new Date(Date.now() + (countdownSeconds + 60) * 1000);

    // 1. Aviso anticipado
    this.gateway?.broadcastDropAlert(mapId, dropId, countdownSeconds);
    this.logger.log(`🔔 Drop alert en ${mapId} — en ${countdownSeconds}s`);

    // 2. Esperar el countdown y hacer spawn
    setTimeout(() => {
      const x = Math.random() * 700 + 50;
      const y = Math.random() * 400 + 50;

      this.gameService.createDrop({
        id: dropId,
        mapId,
        x,
        y,
        maxClaims: 20,
        claims: [],
        expiresAt,
        reward,
      });

      this.gateway?.broadcastDropSpawn(mapId, { id: dropId, x, y, reward });
      this.logger.log(
        `🎁 Drop ${dropId} spawneado en (${x.toFixed(0)}, ${y.toFixed(0)}) en ${mapId}`,
      );
    }, countdownSeconds * 1000);
  }
}
