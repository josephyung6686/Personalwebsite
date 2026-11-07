// The box holds five crayons, one per main section. Draw mode offers the full set of eight colours.
export const JUMPS = [
  { name: 'About', href: '/#about', art: 'purple', y: 6 },
  { name: 'Featured', href: '/#tuck', art: 'blue', y: 5 },
  { name: 'Projects', href: '/#projects', art: 'red', y: 1 },
  { name: 'Experience', href: '/#experience', art: 'green', y: 3 },
  { name: 'Hackathons', href: '/#wins', art: 'orange', y: 0 },
] as const;

export const COLORS = [
  { color: 'Blue', art: 'blue', hex: '#1f5fd0' },
  { color: 'Red', art: 'red', hex: '#d8332a' },
  { color: 'Green', art: 'green', hex: '#23894a' },
  { color: 'Yellow', art: 'yellow', hex: '#f2b518' },
  { color: 'Purple', art: 'purple', hex: '#6f3fb0' },
  { color: 'Brown', art: 'brown', hex: '#8a4b22' },
  { color: 'Orange', art: 'orange', hex: '#ef7b12' },
  { color: 'White', art: 'white', hex: '#fffdf6' },
] as const;
