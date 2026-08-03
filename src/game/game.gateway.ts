import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GameService } from './game.service';
import { GamePlayer } from './game.types';
import {
  PlayerMoveDto,
  ChatMessageDto,
  JoinMinigameDto,
  ClaimDropDto,
  EquipSkinDto,
} from './dto/game.dto';
import { TriviaService } from './minigames/trivia/trivia.service';

@WebSocketGateway({
  namespace: '/game',
  cors: {
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : ['http://localhost:3000'],
    credentials: true,
  },
})
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly gameService: GameService,
    private readonly jwtService: JwtService,
    private readonly triviaService: TriviaService,
  ) {}

  // ---------------------------------------------------------------------------
  // CONNECTION LIFECYCLE
  // ---------------------------------------------------------------------------

  async handleConnection(client: Socket) {
    try {
      // Extraer JWT del handshake (query param o header Authorization)
      const token =
        (client.handshake.auth?.token as string) || (client.handshake.query?.token as string);

      let userId: string | null = null;
      let username = `Jugador-${Math.floor(Math.random() * 9999)}`;

      if (token) {
        try {
          const payload = this.jwtService.verify(token);
          userId = payload.sub;
          username = payload.email.split('@')[0]; // "cortesdavid381"
        } catch {
          // Token inválido → continuar como invitado
          this.logger.warn(`Token inválido de ${client.id} — entrando como invitado`);
        }
      }

      const mapId = (client.handshake.query?.map as string) ?? 'plaza';
      const player = await this.gameService.createPlayer(client.id, mapId, userId, username);

      // Unir al room de Socket.IO correspondiente al mapa
      await client.join(`map:${mapId}`);

      // Enviar al nuevo jugador el estado actual del mundo
      const existingPlayers = this.gameService
        .getPlayersInRoom(mapId)
        .filter((p) => p.socketId !== client.id)
        .map(this.serializePlayer);

      client.emit('world:state', {
        self: this.serializePlayer(player),
        players: existingPlayers,
        activeDrop: this.gameService.getActiveDrop(mapId) ?? null,
      });

      // Notificar a los demás del nuevo jugador
      client.to(`map:${mapId}`).emit('player:joined', this.serializePlayer(player));

      this.logger.log(`✅ ${username} conectado al mapa ${mapId} (${client.id})`);
    } catch (err) {
      this.logger.error(`Error en conexión ${client.id}:`, err);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const result = this.gameService.removePlayer(client.id);
    if (result) {
      this.server.to(`map:${result.mapId}`).emit('player:left', { id: client.id });
      this.logger.log(`❌ ${result.player.username} desconectado`);
    }
  }

  // ---------------------------------------------------------------------------
  // MOVIMIENTO
  // ---------------------------------------------------------------------------

  @SubscribeMessage('player:move')
  handleMove(@ConnectedSocket() client: Socket, @MessageBody() dto: PlayerMoveDto) {
    const player = this.gameService.updatePlayerPosition(
      client.id,
      dto.x,
      dto.y,
      dto.direction,
      dto.animation,
    );
    if (!player) return;

    // Broadcast a todos en el mismo mapa (excepto quien lo emitió)
    client.to(`map:${player.mapId}`).emit('player:moved', {
      id: client.id,
      x: dto.x,
      y: dto.y,
      direction: dto.direction,
      animation: dto.animation,
    });

    // Scavenger hunt: revisar si el jugador está cerca de un cupón oculto
    const found = this.gameService.checkScavengerFind(client.id, dto.x, dto.y, player.mapId);
    if (found) {
      client.emit('scavenger:found', {
        couponCode: found.couponCode,
        discount: found.discount,
        message: `¡Encontraste un ${found.discount} off! Válido por 30 minutos.`,
      });
      this.gameService.addZaycoins(client.id, 150, 'scavenger_find');
    }
  }

  // ---------------------------------------------------------------------------
  // CHAT
  // ---------------------------------------------------------------------------

  @SubscribeMessage('chat:send')
  handleChat(@ConnectedSocket() client: Socket, @MessageBody() dto: ChatMessageDto) {
    const player = this.gameService.getPlayer(client.id);
    if (!player) return;

    const message = dto.message.trim().slice(0, 200); // límite 200 chars
    if (!message) return;

    this.server.to(`map:${player.mapId}`).emit('chat:received', {
      from: client.id,
      username: player.username,
      message,
      zone: dto.zone ?? null,
      isStarSeller: player.isStarSeller,
    });
  }

  // ---------------------------------------------------------------------------
  // DROPS
  // ---------------------------------------------------------------------------

  @SubscribeMessage('drop:claim')
  async handleClaimDrop(@ConnectedSocket() client: Socket, @MessageBody() dto: ClaimDropDto) {
    const player = this.gameService.getPlayer(client.id);
    if (!player) return;

    const result = this.gameService.claimDrop(dto.dropId, player.userId, client.id);

    if (!result.success) {
      client.emit('drop:error', { error: result.error });
      return;
    }

    // Recompensar en Zaycoins
    const newBalance = await this.gameService.addZaycoins(client.id, 300, 'drop_claim');

    client.emit('drop:claimed_self', {
      reward: result.reward,
      zaycoins: newBalance,
    });

    // Notificar a todos cuántos quedan
    this.server.to(`map:${player.mapId}`).emit('drop:claimed', {
      by: player.username,
      remaining: result.remaining,
    });

    if (result.remaining === 0) {
      this.server.to(`map:${player.mapId}`).emit('drop:exhausted', { dropId: dto.dropId });
    }
  }

  // ---------------------------------------------------------------------------
  // MINIJUEGOS
  // ---------------------------------------------------------------------------

  @SubscribeMessage('game:join_trivia')
  handleJoinTrivia(@ConnectedSocket() client: Socket) {
    const player = this.gameService.getPlayer(client.id);
    if (!player) return;

    const result = this.triviaService.joinSession(client.id, player.username);
    client.join(`trivia:${result.sessionId}`);
    client.emit('game:trivia_joined', result);
  }

  @SubscribeMessage('game:trivia_answer')
  async handleTriviaAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { questionId: string; answerIndex: number },
  ) {
    const result = await this.triviaService.submitAnswer(
      client.id,
      dto.questionId,
      dto.answerIndex,
    );
    if (!result) return;

    client.emit('game:trivia_answer_result', result);

    // Si terminó la sesión, procesar resultados y recompensar
    if (result.sessionEnded) {
      const { score, maxScore = 5 } = result;
      let reward = 0;
      let reward_key = '';

      if (score === maxScore) {
        reward = 500;
        reward_key = 'trivia_5_of_5';
        // Cupón de ₡5,000 generado en Fase 3
      } else if (score >= maxScore - 1) {
        reward = 200;
        reward_key = 'trivia_4_of_5';
      }

      if (reward > 0) {
        const newBalance = await this.gameService.addZaycoins(client.id, reward, reward_key);
        client.emit('coins:updated', { balance: newBalance, earned: reward, reason: reward_key });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // AVATAR
  // ---------------------------------------------------------------------------

  @SubscribeMessage('avatar:equip_skin')
  async handleEquipSkin(@ConnectedSocket() client: Socket, @MessageBody() dto: EquipSkinDto) {
    const success = await this.gameService.equipSkin(client.id, dto.sku);
    if (!success) {
      client.emit('avatar:error', { error: 'No podés equipar esa skin' });
      return;
    }

    const player = this.gameService.getPlayer(client.id);
    if (!player) return;

    // Notificar a todos para que actualicen el sprite
    this.server.to(`map:${player.mapId}`).emit('player:skin_changed', {
      id: client.id,
      sku: dto.sku,
    });
  }

  // ---------------------------------------------------------------------------
  // BROADCAST HELPERS (llamados desde GameEventsService)
  // ---------------------------------------------------------------------------

  broadcastDropAlert(mapId: string, dropId: string, countdown: number) {
    this.server.to(`map:${mapId}`).emit('drop:alert', { dropId, countdown });
  }

  broadcastDropSpawn(mapId: string, drop: { id: string; x: number; y: number; reward: unknown }) {
    this.server.to(`map:${mapId}`).emit('drop:spawned', drop);
  }

  broadcastToMap(mapId: string, event: string, data: unknown) {
    this.server.to(`map:${mapId}`).emit(event, data);
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  private serializePlayer(player: GamePlayer) {
    return {
      id: player.socketId,
      username: player.username,
      x: player.x,
      y: player.y,
      direction: player.direction,
      animation: player.animation,
      activeSkin: player.activeSkin,
      isStarSeller: player.isStarSeller,
      zaycoins: player.zaycoins,
    };
  }
}
