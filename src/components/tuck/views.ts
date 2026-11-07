/* On their own so TuckDemo.astro can read them without pulling the phone version into the page's module graph. */
export type View = 'app' | 'onboarding';
export const VIEWS: Record<View, { src: string; poster: string; alt: string; minW: number; minH: number }> = {
  app: { src: '/work/tuck/app/brain.html', poster: '/work/tuck/poster-app.webp', alt: 'Tuck Brain: a map of your files, grouped into the parts of your life', minW: 1240, minH: 720 },
  onboarding: { src: '/work/tuck/onboarding/index.html', poster: '/work/tuck/poster-onboarding.webp', alt: 'Tuck onboarding: a question on the left, the folders it is building on the right', minW: 1100, minH: 720 },
};
