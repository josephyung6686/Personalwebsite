import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const work = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    role: z.string(),
    summary: z.string(),
    chips: z.array(z.string()),
    draft: z.boolean().default(false),
    demo: z.enum(['tuck', 'spade', 'aikonic']).optional(),
    link: z.object({ label: z.string(), href: z.string() }).optional(),
    glance: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  }),
});

export const collections = { work };
