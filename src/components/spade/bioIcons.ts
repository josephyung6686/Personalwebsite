// Phosphor icons for the NutriGene page and card. SPADE is backend work with no screen of its own, so these carry the biology.
import dna from '@phosphor-icons/core/assets/duotone/dna-duotone.svg?raw';
import flask from '@phosphor-icons/core/assets/duotone/flask-duotone.svg?raw';
import testTube from '@phosphor-icons/core/assets/duotone/test-tube-duotone.svg?raw';
import microscope from '@phosphor-icons/core/assets/duotone/microscope-duotone.svg?raw';
import dnaFill from '@phosphor-icons/core/assets/fill/dna-fill.svg?raw';
import flaskFill from '@phosphor-icons/core/assets/fill/flask-fill.svg?raw';
import testTubeFill from '@phosphor-icons/core/assets/fill/test-tube-fill.svg?raw';
import microscopeFill from '@phosphor-icons/core/assets/fill/microscope-fill.svg?raw';
import dropFill from '@phosphor-icons/core/assets/fill/drop-fill.svg?raw';

/** The row in the page header and the card, and one icon per at-a-glance tile, in tile order. */
export const bioRow = [dna, flask, microscope, testTube];

/** One icon per section heading on the page, drawn through a mask so it takes the theme's accent colour. */
const sectionIcons = [dnaFill, flaskFill, microscopeFill, testTubeFill, dropFill];
export const bioSectionCss = sectionIcons.map((svg, i) =>
  `.cs[data-theme="nutrigene"] .prose h2:nth-of-type(${i + 1})::before{content:"";display:block;width:30px;height:30px;padding:0;background:var(--accent);` +
  `-webkit-mask:url("data:image/svg+xml,${encodeURIComponent(svg)}") center/contain no-repeat;mask:url("data:image/svg+xml,${encodeURIComponent(svg)}") center/contain no-repeat}`,
).join('');
