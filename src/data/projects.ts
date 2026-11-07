export type Project = { slug: string; title: string; line: string; metrics: string[]; role?: string };

export const projects: Project[] = [
  { slug: 'doom-drive', title: 'Doom Drive', line: 'Pocket hardware that runs AI locally on your laptop or phone, and shows the exact sentences it used', metrics: ['Runs with no internet', '40 emergency guides'], role: 'Side project, with a teammate' },
  { slug: 'nutrigene', title: 'SPADE at NutriGene AI', line: 'Plans stem-cell manufacturing experiments, and knows when to hold off', metrics: ['10-round quality in 5', '92,400 simulated evaluations'], role: 'Applied AI Intern' },
  { slug: 'kwungfund', title: 'KwungFund', line: 'Reporting for one-person funds: the AI drafts, a person signs', metrics: ['Nothing auto-sends'], role: 'Product, research and code' },
    { slug: 'aikonic', title: 'Aikonic', line: 'Hybrid search, 21 agent tools, a podcast pipeline and desktop work for a voice notes product', metrics: ['10,000+ users', '21 agent tools', 'About 3x faster text-to-speech'], role: 'Software Engineering Intern' },
];
