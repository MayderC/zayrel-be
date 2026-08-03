/**
 * Banco de preguntas de trivia.
 * Para agregar preguntas: solo añadir objetos a este array.
 * Categorías: 'anime' | 'manga' | 'general'
 */

export interface TriviaQuestion {
  id: string;
  category: 'anime' | 'manga' | 'general';
  question: string;
  options: [string, string, string, string];
  correctIndex: number; // 0-3
  difficulty: 'easy' | 'medium' | 'hard';
}

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  // --- ANIME FÁCIL ---
  {
    id: 'a-e-001',
    category: 'anime',
    difficulty: 'easy',
    question: '¿En qué anime aparece el personaje Naruto Uzumaki?',
    options: ['Dragon Ball', 'Naruto', 'Bleach', 'One Piece'],
    correctIndex: 1,
  },
  {
    id: 'a-e-002',
    category: 'anime',
    difficulty: 'easy',
    question: '¿Cuál es el nombre del demonio de "Demon Slayer"?',
    options: ['Muzan Kibutsuji', 'Giyu Tomioka', 'Zenitsu Agatsuma', 'Inosuke Hashibira'],
    correctIndex: 0,
  },
  {
    id: 'a-e-003',
    category: 'anime',
    difficulty: 'easy',
    question: '¿De qué color es el cabello de Goku en Super Saiyan Blue?',
    options: ['Amarillo', 'Rojo', 'Azul', 'Blanco'],
    correctIndex: 2,
  },
  {
    id: 'a-e-004',
    category: 'anime',
    difficulty: 'easy',
    question: '¿Qué fruta comió Monkey D. Luffy?',
    options: ['Fruta Mera Mera', 'Fruta Gomu Gomu', 'Fruta Hie Hie', 'Fruta Ope Ope'],
    correctIndex: 1,
  },
  {
    id: 'a-e-005',
    category: 'anime',
    difficulty: 'easy',
    question: '¿Cuál es el ataque más famoso de Goku?',
    options: ['Rasengan', 'Kamehameha', 'Bankai', 'Chidori'],
    correctIndex: 1,
  },

  // --- ANIME MEDIO ---
  {
    id: 'a-m-001',
    category: 'anime',
    difficulty: 'medium',
    question: '¿Cuántos Pilares Hashira existen en Demon Slayer?',
    options: ['7', '8', '9', '10'],
    correctIndex: 2,
  },
  {
    id: 'a-m-002',
    category: 'anime',
    difficulty: 'medium',
    question: '¿Qué tipo de poder usa Tanjiro como "respiración"?',
    options: ['Agua', 'Fuego', 'Sol', 'Trueno'],
    correctIndex: 0,
  },
  {
    id: 'a-m-003',
    category: 'anime',
    difficulty: 'medium',
    question: '¿En qué isla nació Monkey D. Luffy?',
    options: ['Isla Dawn', 'Isla Whole Cake', 'Isla Skypiea', 'Nueva Mar'],
    correctIndex: 0,
  },
  {
    id: 'a-m-004',
    category: 'anime',
    difficulty: 'medium',
    question: '¿Qué significa "Attack on Titan" en japonés?',
    options: ['Shingeki no Kyojin', 'Zankoku na Tenshi', 'Hajime no Ippo', 'Mononoke Hime'],
    correctIndex: 0,
  },
  {
    id: 'a-m-005',
    category: 'anime',
    difficulty: 'medium',
    question: '¿Cuál es el quirk de Izuku Midoriya en My Hero Academia?',
    options: ['Explosion', 'Zero Gravity', 'One For All', 'Half-Cold Half-Hot'],
    correctIndex: 2,
  },

  // --- ANIME DIFÍCIL ---
  {
    id: 'a-h-001',
    category: 'anime',
    difficulty: 'hard',
    question:
      '¿Cuántos episodios tiene la primera temporada original de "Neon Genesis Evangelion"?',
    options: ['24', '25', '26', '28'],
    correctIndex: 2,
  },
  {
    id: 'a-h-002',
    category: 'anime',
    difficulty: 'hard',
    question: '¿Qué estudio animó "Fullmetal Alchemist: Brotherhood"?',
    options: ['Bones', 'MAPPA', 'Studio Ghibli', 'A-1 Pictures'],
    correctIndex: 0,
  },
  {
    id: 'a-h-003',
    category: 'anime',
    difficulty: 'hard',
    question: '¿En qué año se publicó el primer capítulo del manga original de One Piece?',
    options: ['1995', '1997', '1999', '2001'],
    correctIndex: 1,
  },
];

/**
 * Retorna 5 preguntas aleatorias para una sesión de trivia.
 */
export function getRandomQuestions(count = 5): TriviaQuestion[] {
  const shuffled = [...TRIVIA_QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
