import { Module, OnModuleInit } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User, UserSchema } from '../database/schemas';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { GameEventsService } from './game-events.service';
import { TriviaService } from './minigames/trivia/trivia.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [GameGateway, GameService, GameEventsService, TriviaService],
  exports: [GameService, GameEventsService],
})
export class GameModule implements OnModuleInit {
  constructor(
    private readonly eventsService: GameEventsService,
    private readonly gateway: GameGateway,
  ) {}

  // Inyectar el gateway en el service después de que ambos estén listos
  // Evita dependencia circular Gateway ↔ EventsService
  onModuleInit() {
    this.eventsService.setGateway(this.gateway);
  }
}
