import type { CueCard } from "@/types/exam";

export interface Part1Topic {
  id: string;
  /** How the examiner introduces the topic. */
  intro: string;
  questions: string[];
}

export interface Part2Task {
  id: string;
  cueCard: CueCard;
  /** Short question after the long turn. */
  roundingOff: string;
  /** Part 3 discussion theme and questions linked to this card. */
  theme: string;
  part3: string[];
}

/** The first Part 1 topic is always work or study, as in the real test. */
export const WORK_OR_STUDY: Part1Topic = {
  id: "work-study",
  intro: "Let's talk about what you do.",
  questions: ["Do you work or are you a student?", "Why did you choose that job or subject?", "What do you enjoy most about it?"],
};

export const PART1_TOPICS: Part1Topic[] = [
  {
    id: "hometown",
    intro: "Now let's talk about your hometown.",
    questions: ["What do you like most about your hometown?", "Is there anything you would like to change about it?", "Do you think you will live there in the future?"],
  },
  {
    id: "reading",
    intro: "Let's move on to the topic of reading.",
    questions: ["Do you enjoy reading books?", "What kind of books did you read when you were a child?", "Do you prefer reading on paper or on a screen?"],
  },
  {
    id: "weather",
    intro: "I'd like to talk about the weather.",
    questions: ["What kind of weather do you like best?", "Does the weather ever change your plans?", "Has the weather in your country changed in recent years?"],
  },
  {
    id: "technology",
    intro: "Let's talk about technology.",
    questions: ["How often do you use your phone each day?", "What apps do you use the most?", "Do you think you spend too much time online?"],
  },
];

export const PART2_TASKS: Part2Task[] = [
  {
    id: "inspiring-person",
    cueCard: {
      topic: "Describe a person who has inspired you to learn something new.",
      points: ["who this person is", "how you know this person", "what they inspired you to learn", "and explain why this person inspired you."],
    },
    roundingOff: "Do you still keep in touch with this person?",
    theme: "learning and education",
    part3: [
      "What qualities make a good teacher?",
      "Do you think people learn better from a teacher or from the internet?",
      "How do you think education might change in the future?",
      "Should schools focus more on practical skills?",
    ],
  },
  {
    id: "memorable-trip",
    cueCard: {
      topic: "Describe a trip you took that you remember well.",
      points: ["where you went", "who you went with", "what you did there", "and explain why you remember this trip so well."],
    },
    roundingOff: "Would you like to go there again?",
    theme: "travel and tourism",
    part3: [
      "Why do you think people enjoy travelling?",
      "What are the effects of tourism on local communities?",
      "Is it better to travel alone or in a group?",
      "How might travel change in the next twenty years?",
    ],
  },
  {
    id: "useful-object",
    cueCard: {
      topic: "Describe an object you use every day that is important to you.",
      points: ["what the object is", "when you got it", "how you use it", "and explain why it is important to you."],
    },
    roundingOff: "Would you ever replace it with a newer one?",
    theme: "possessions and consumerism",
    part3: [
      "Why do people like to buy new things?",
      "Do you think people today own too many things?",
      "How has technology changed the things people own?",
      "Should products be designed to last longer?",
    ],
  },
];
