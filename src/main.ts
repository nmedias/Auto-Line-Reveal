// main.ts

import { defineAutoLineRevealElement } from './auto-line-reveal-element';

//import { AutoLineReveal } from './auto-line-reveal';
// const reveal = new AutoLineReveal({
//   root: document,
//   selector: '[data-split-lines]',
// });
//
// reveal.init({ bindResize: true });

defineAutoLineRevealElement({
  root: document,
  bindResize: true,
  tagName: 'auto-line-reveal',
});
