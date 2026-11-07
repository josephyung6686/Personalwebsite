export const site = {
  name: 'Joseph Yung',
  location: 'New York',
  roles: ['CS + Financial Engineering', 'Columbia University'],
  email: 'hjy2114@columbia.edu',
  linkedin: 'https://www.linkedin.com/in/joseph-yung-397a892a4',
  github: 'https://github.com/josephyung6686',
  devpost: 'https://devpost.com/josephyung33',
  languages: 'English, Cantonese, Mandarin',
  interests: 'Guitar, fencing, volleyball, scuba, skiing, wakesurfing',
  bio: {
    intro: "I study computer science and financial engineering at Columbia, and I like solving hard problems in fields I don't know yet",
    why: 'That has taken me from biotech (stem-cell manufacturing, embryo imaging) to consumer apps (an AI brain for your files, an offline emergency drive), with enterprise search, fund reporting and nonprofit consulting along the way',
    business: "I've also worked on the business side, in EY's Strategy & Transactions practice in Hong Kong, on go-to-market recommendations and M&A screening",
    howLead: "The field changes, but how I work doesn't:",
    how: [
      "I start with the person using it. AudioSight's users are blind and low-vision people who need to hear an obstacle as they reach it, so depth inference runs on the phone, which took end-to-end latency from 250 ms to about 50 ms",
      'I go down to the layer where the problem lives. When Aikonic transcripts in Japanese produced useless timestamps, the cause was chunking code that split text on spaces, so that is what I worked on',
      "I decide with evidence. SPADE was benchmarked across 92,400 simulated evaluations, and Tuck's sorting is checked against sample home folders with answer keys",
      'I design for the moment the AI is wrong. In Doom Drive, emergencies and doses never reach the model, and in Tuck nothing moves on disk, so every answer can be undone',
    ],
    outro: 'Always happy to talk about biotech, consumer products, AI agents or markets, so feel free to reach out!',
  },
} as const;
