import { IsString, IsNumber, IsOptional, Min, Max, IsIn } from 'class-validator';

export class PlayerMoveDto {
  @IsNumber() @Min(0) x: number;
  @IsNumber() @Min(0) y: number;
  @IsIn(['down', 'up', 'left', 'right']) direction: string;
  @IsString() animation: string; // 'walk' | 'idle'
}

export class ChatMessageDto {
  @IsString() message: string;
  @IsOptional() @IsString() zone?: string; // zona del mapa, ej: 'perchero-anime'
}

export class InteractDto {
  @IsString() objectId: string; // id del objeto en el mapa (ej: 'perchero-001')
}

export class JoinMinigameDto {
  @IsString() minigameId: string; // 'trivia' | 'football' | 'scavenger'
}

export class TriviaAnswerDto {
  @IsString() questionId: string;
  @IsNumber() @Min(0) @Max(3) answerIndex: number;
}

export class ClaimDropDto {
  @IsString() dropId: string;
}

export class EquipSkinDto {
  @IsString() sku: string; // SKU de la camiseta comprada
}
