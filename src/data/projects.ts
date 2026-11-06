export type Project = { slug: string; title: string; line: string; metrics: string[]; role?: string };

export const projects: Project[] = [
  { slug: 'doom-drive', title: 'Doom Drive', line: 'A USB drive with an offline library and an offline AI that shows the exact sentences it used', metrics: ['40 emergency guides', 'Works with no internet'], role: 'Side project, with a teammate' },
  { slug: 'nutrigene', title: 'SPADE at NutriGene AI', line: 'Plans stem-cell manufacturing experiments, and knows when to hold off', metrics: ['10-round quality in 5', '92,400 simulated evaluations'], role: 'Applied AI Intern' },
  { slug: 'kwungfund', title: 'KwungFund', line: 'Reporting for one-person funds: the AI drafts, a person signs', metrics: ['Nothing auto-sends'], role: 'Product, research and code' },
  { slug: 'aikonic', title: 'Aikonic search', line: 'Multilingual enterprise search that cites the exact timestamp in the source', metrics: ['10,000+ users', '21 agent tools'], role: 'Software Engineering Intern' },
];
