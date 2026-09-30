export interface CueCard {
  topic: string;
  points: string[];
}

export interface Step {
  part: 0 | 1 | 2 | 3;
  /** What the examiner says out loud. */
  say: string;
  /** If set, the student answers after the examiner finishes speaking. */
  answer?: { maxMs: number; silenceMs: number };
  /** Part 2: show the cue card and run the preparation timer before the next step. */
  cueCard?: CueCard;
  prepMs?: number;
}

export const examiner = {
  name: "Muslima",
  title: "IELTS Speaking Examiner",
  // Put your licensed media in public/examiner/. Missing files fall back gracefully:
  // room scene → idle + talking videos → live-animated photo (needs face.json) → photo with subtle motion → silhouette.
  // Seated behind the desk in the exam room; only her face and head are animated.
  scene: {
    image: "/examiner/room-scene.jpg",
    data: "/examiner/scene.json",
    // Centre on her; zoom in more on phones so her face stays readable.
    framing: { focus: [0.54, 0.5] as [number, number], zoomWide: 1.1, zoomTall: 1.5 },
  },
  photo: "/examiner/photo.jpg",
  faceData: "/examiner/face.json",
  idleVideo: "/examiner/idle.mp4",
  talkingVideo: "/examiner/talking.mp4",
};

const short = { maxMs: 30_000, silenceMs: 3_000 };
const medium = { maxMs: 60_000, silenceMs: 3_500 };
const long = { maxMs: 120_000, silenceMs: 6_000 };

export const cueCard: CueCard = {
  topic: "Describe a person who has inspired you to learn something new.",
  points: ["who this person is", "how you know this person", "what they inspired you to learn", "and explain why this person inspired you."],
};

export const examScript: Step[] = [
  { part: 0, say: `Good afternoon. My name is ${examiner.name}, and I'll be your examiner today. Can you tell me your full name, please?`, answer: short },
  { part: 0, say: "Thank you. And where are you from?", answer: short },

  { part: 1, say: "Now, in this first part, I'd like to ask you some questions about yourself. Let's talk about your hometown. What do you like most about your hometown?", answer: medium },
  { part: 1, say: "Is there anything you would like to change about it?", answer: medium },
  { part: 1, say: "Let's move on to the topic of reading. Do you enjoy reading books?", answer: medium },
  { part: 1, say: "What kind of books did you read when you were a child?", answer: medium },

  {
    part: 2,
    say: "Now I'm going to give you a topic, and I'd like you to talk about it for one to two minutes. Before you talk, you'll have one minute to think about what you're going to say. You can make some notes if you wish. Here is your topic.",
    cueCard,
    prepMs: 60_000,
  },
  { part: 2, say: "All right? Remember, you have one to two minutes for this, so don't worry if I stop you. I'll tell you when the time is up. Can you start speaking now, please?", answer: long },
  { part: 2, say: "Thank you. Do you still keep in touch with this person?", answer: short },

  { part: 3, say: "We've been talking about a person who inspired you. I'd like to discuss with you one or two more general questions related to this. First, what qualities make a good teacher?", answer: medium },
  { part: 3, say: "Do you think people learn better from a teacher or from the internet?", answer: medium },
  { part: 3, say: "How do you think education might change in the future?", answer: medium },

  { part: 3, say: "Thank you. That is the end of the speaking test." },
];
