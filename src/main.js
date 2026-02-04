// main.js
import { AutoLineReveal } from './auto-line-reveal.js';

const reveal = new AutoLineReveal({
  root: document,
  selector: '[data-split-lines]',
});

reveal.init({ bindResize: true });

window.reveal = reveal;
