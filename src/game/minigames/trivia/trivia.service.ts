import { Injectable, Logger } from '@nestjs/common';
import { getRandomQuestions, TriviaQuestion } from './trivia.questions';
import { v4 as uuidv4 } from 'uuid';

interface TriviaSession {
  id: string;
  players: Map<string, TriviaPlayerState>; // socketId → state
  questions: TriviaQuestion[];
  currentQuestionIndex: number;
  startedAt: Date;
  status: 'waiting' | 'active' | 'finished';
}

interface TriviaPlayerState {
  socketId: string;
  username: string;
  score: number;
  answers: (number | null)[]; // null = no respondió
}

const QUESTION_COUNT = 5;
const QUESTIONS_PER_PLAYER = QUESTION_COUNT; // mismo set para todos

@Injectable()
export class TriviaService {
  private readonly logger = new Logger(TriviaService.name);
  private sessions = new Map<string, TriviaSession>();
  // Índice: socketId → sessionId (para búsqueda rápida)
  private playerSession = new Map<string, string>();

  // ---------------------------------------------------------------------------
  // UNIRSE A SESIÓN
  // ---------------------------------------------------------------------------

  joinSession(
    socketId: string,
    username: string,
  ): {
    sessionId: string;
    questions: { id: string; question: string; options: string[] }[];
    totalQuestions: number;
  } {
    // Buscar sesión en estado 'waiting' con espacio
    let session: TriviaSession | undefined;
    for (const s of this.sessions.values()) {
      if (s.status === 'waiting' && s.players.size < 10) {
        session = s;
        break;
      }
    }

    // Crear nueva sesión si no hay ninguna disponible
    if (!session) {
      session = {
        id: uuidv4(),
        players: new Map(),
        questions: getRandomQuestions(QUESTION_COUNT),
        currentQuestionIndex: 0,
        startedAt: new Date(),
        status: 'active', // arranca inmediatamente (no espera, cada uno responde a su ritmo)
      };
      this.sessions.set(session.id, session);
      this.logger.log(`Nueva sesión de trivia: ${session.id}`);
    }

    session.players.set(socketId, {
      socketId,
      username,
      score: 0,
      answers: new Array(QUESTION_COUNT).fill(null),
    });
    this.playerSession.set(socketId, session.id);

    // Retornar preguntas sin revelar respuesta correcta
    return {
      sessionId: session.id,
      totalQuestions: QUESTION_COUNT,
      questions: session.questions.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options as unknown as string[],
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // RESPONDER PREGUNTA
  // ---------------------------------------------------------------------------

  submitAnswer(
    socketId: string,
    questionId: string,
    answerIndex: number,
  ): {
    correct: boolean;
    correctIndex: number;
    score: number;
    sessionEnded: boolean;
    maxScore?: number;
  } | null {
    const sessionId = this.playerSession.get(socketId);
    if (!sessionId) return null;

    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const playerState = session.players.get(socketId);
    if (!playerState) return null;

    const qIndex = session.questions.findIndex((q) => q.id === questionId);
    if (qIndex === -1) return null;

    // Evitar responder dos veces la misma pregunta
    if (playerState.answers[qIndex] !== null) return null;

    const question = session.questions[qIndex];
    const correct = answerIndex === question.correctIndex;

    playerState.answers[qIndex] = answerIndex;
    if (correct) playerState.score++;

    // Verificar si el jugador respondió todas las preguntas
    const sessionEnded = playerState.answers.every((a) => a !== null);

    if (sessionEnded) {
      this.logger.log(
        `${playerState.username} terminó trivia: ${playerState.score}/${QUESTION_COUNT}`,
      );
    }

    return {
      correct,
      correctIndex: question.correctIndex,
      score: playerState.score,
      sessionEnded,
      maxScore: sessionEnded ? QUESTION_COUNT : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // LIMPIEZA
  // ---------------------------------------------------------------------------

  cleanOldSessions() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    for (const [id, session] of this.sessions) {
      if (session.startedAt < oneHourAgo) {
        for (const p of session.players.keys()) {
          this.playerSession.delete(p);
        }
        this.sessions.delete(id);
      }
    }
  }
}
