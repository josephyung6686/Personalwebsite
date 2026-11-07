// logo is the square mark for the rail. logoHead is a wider version for the page header, where there is room for it.
export type Job = { slug: string; org: string; title: string; where: string; when: string; logo: string; logoHead?: string };

export const experience: Job[] = [
  { slug: 'nutrigene', org: 'NutriGene AI', title: 'Applied AI Intern', where: 'Hong Kong', when: '2026 to now', logo: '/work/logos/nutrigene.png' },
  { slug: 'ey', org: 'Ernst & Young', title: 'Strategy & Transactions Intern', where: 'Hong Kong', when: '2026', logo: '/work/logos/ey.svg' },
  { slug: 'aikonic', org: 'Aikonic', title: 'Software Engineering Intern', where: 'Singapore', when: '2026', logo: '/work/logos/aikonic.png', logoHead: '/work/logos/aikonic-wordmark.svg' },
  { slug: 'grc', org: 'Global Research & Consulting Group', title: 'Global Director of Client Success', where: 'Global', when: '2026 to now', logo: '/work/logos/grc.png' },
  { slug: 'morphogenesis', org: 'Morphogenesis Lab, Columbia', title: 'Research Assistant', where: 'New York', when: '2025 to 2026', logo: '/work/logos/columbia-crown.png', logoHead: '/work/logos/columbia-wordmark.svg' },
];
