export const PROMPTS: string[] = [
  'What made you smile today?',
  'Describe a moment of unexpected beauty you witnessed recently.',
  'What are you learning about yourself this season?',
  'What would you tell your younger self right now?',
  'Write about a small thing that brought you comfort today.',
  'What conversation are you avoiding, and why?',
  'Describe the last time you felt truly at peace.',
  'What does your ideal quiet morning look like?',
  'What are you holding onto that you might need to release?',
  'Write about someone who shaped who you are today.',
  'What does home mean to you right now?',
  'Describe a texture, smell, or sound that calms you.',
  'What is one thing you did today that you are proud of?',
  'What fear would you face if you knew you could not fail?',
  'Write about a memory that always makes you feel warm.',
  'What are you most curious about right now?',
  'Describe your energy today in weather terms.',
  'What would you do with a completely free day?',
  'Write a letter to the version of you from one year ago.',
  'What is something you have been overthinking?',
  'Describe the last meal that felt nourishing in every sense.',
  'What part of your routine brings you the most satisfaction?',
  'Who do you want to reach out to, and what would you say?',
  'Write about a place you have never been but feel drawn to.',
  'What does rest mean to you, and are you getting enough?',
  'What is something you want to remember about this period of your life?',
  'Describe the feeling you are chasing right now.',
  'What boundaries are you learning to honor?',
  'What small act of kindness can you offer yourself today?',
  'Write about a time you surprised yourself.',
];

export const getDailyPrompt = (): string => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return PROMPTS[dayOfYear % PROMPTS.length];
};
