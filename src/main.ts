// main.ts
import { AutoLineReveal } from './auto-line-reveal';

const reveal = new AutoLineReveal({
  root: document,
  selector: '[data-split-lines]',
});

reveal.init({ bindResize: true });

//window.reveal = reveal;
