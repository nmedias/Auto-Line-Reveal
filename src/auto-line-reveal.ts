// Auto Line Split Reveal (class-based, multi-instance capable)
// Usage:
//   const r = new AutoLineReveal({ root: document, selector: '[data-split-lines]' });
//   r.init({ bindResize: false });
//   window.addEventListener('resize', debounce(() => r.rebuild(), 150));
//   // later: r.destroy();

/** @internal */
type RevealMode = 'linear' | 'immediate';
/** @internal */
type LinearPolicy = 'strict' | 'skip-unseen';
/** @internal */
type LineAnim = 'slide-clip' | 'fade' | 'blur-in' | 'diag-slice';

/** @internal */
type BlockConfig = {
  mode: RevealMode;
  group: string;
  policy: LinearPolicy;
  anim: LineAnim;
  animMs: number | null;
  intensity: number;
  debug: boolean;
};

/** @internal */
type GroupState = {
  ready: boolean;
  started: boolean;
  done: boolean;
};

/** @internal */
type GroupQueue = {
  blocks: HTMLElement[];
  state: WeakMap<HTMLElement, GroupState>;
};

/** @internal */
type AutoLineRevealOptions = {
  root?: Document | Element;
  selector?: string;
  debounceMs?: number;
};

/** @internal */
type InitOptions = {
  bindResize?: boolean;
};

export class AutoLineReveal {
  root: Document | Element;
  selector: string;
  prefersReducedMotion: boolean;
  _blockObserver: IntersectionObserver | null;
  _running: WeakMap<HTMLElement, AbortController>;
  _groupQueues: Map<string, GroupQueue>;
  _resizeHandler: ((...args: unknown[]) => void) | null;
  _debounceMs: number;

  /**
   * Create a new AutoLineReveal instance scoped to a root container.
   * @param {AutoLineRevealOptions} options Root, selector, and debounce configuration.
   * @param {Document | Element} options.root Root element or document to scope queries.
   * @param {string} options.selector Selector for reveal blocks.
   * @param {number} options.debounceMs Debounce delay for resize handling.
   */
  constructor({
    root = document,
    selector = '[data-split-lines]',
    debounceMs = 150,
  }: AutoLineRevealOptions = {}) {
    this.root = root;
    this.selector = selector;

    this.prefersReducedMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this._blockObserver = null;
    this._running = new WeakMap(); // block -> AbortController
    this._groupQueues = new Map(); // groupName -> { blocks, state }
    this._resizeHandler = null;
    this._debounceMs = debounceMs;
  }

  // ---------- Public API ----------

  /**
   * Initialize the instance by splitting lines and optionally binding resize.
   * @param {InitOptions} options Initialization options.
   * @param {boolean} options.bindResize Whether to bind a resize listener.
   */
  init({ bindResize = false }: InitOptions = {}) {
    this.rebuild();

    if (bindResize) {
      this._resizeHandler = this._debounce(() => this.rebuild(), this._debounceMs);
      window.addEventListener('resize', this._resizeHandler);
    }
  }

  /**
   * Re-split all matching blocks and rebuild observers/queues.
   */
  rebuild() {
    // Abort any running animations inside this instance scope
    this._abortAllRunning();

    // Re-split and apply classes
    const blocks = this._getBlocks();
    for (const el of blocks) {
      this._applyRevealClasses(el);

      if (!el.dataset.originalText) el.dataset.originalText = el.textContent;
      el.textContent = el.dataset.originalText;

      this._splitIntoLines(el);
    }

    // Rebuild observers/queues
    this._setupBlockObserver(blocks);
  }

  /**
   * Tear down observers, queues, and any running animations.
   */
  destroy() {
    // stop animations
    this._abortAllRunning();

    // disconnect observers
    if (this._blockObserver) this._blockObserver.disconnect();
    this._blockObserver = null;

    // clear queues
    this._groupQueues.clear();

    // unbind resize
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
  }

  // ---------- Config ----------

  /**
   * Read and normalize per-block configuration from data attributes.
   * @param {HTMLElement} block Block element to read configuration from.
   * @returns {BlockConfig} Normalized configuration for the block.
   */
  _getBlockConfig(block: HTMLElement): BlockConfig {
    const mode = (block.dataset.revealMode || 'immediate').toLowerCase();
    const group = (block.dataset.revealGroup || 'default').toString();
    const policyRaw = (block.dataset.linearPolicy || 'skip-unseen').toLowerCase();

    const animRaw = (block.dataset.lineAnim || 'slide-clip').toLowerCase();
    const anim: LineAnim =
      animRaw === 'fade' || animRaw === 'blur-in' || animRaw === 'diag-slice'
        ? animRaw
        : 'slide-clip';

    const animMs = this._clampNumber(block.dataset.lineAnimMs, 80, 6000, null);
    const intensity = this._clampNumber(block.dataset.lineAnimIntensity, 0.25, 2.0, 1);

    return {
      mode: mode === 'linear' ? 'linear' : 'immediate',
      group,
      policy: policyRaw === 'strict' ? 'strict' : 'skip-unseen',
      anim,
      animMs,
      intensity,
      debug: block.dataset.debug === 'true',
    };
  }

  /**
   * Read the global reveal duration from CSS, with a safe fallback.
   * @returns {number} Duration in milliseconds.
   */
  _revealDuration(): number {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--reveal-ms').trim();
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 700;
  }

  // ---------- DOM helpers ----------

  /**
   * Find all blocks within the configured root and selector.
   * @returns {HTMLElement[]} Matching block elements.
   */
  _getBlocks(): HTMLElement[] {
    const scope = this.root instanceof Element ? this.root : document;
    return Array.from(scope.querySelectorAll(this.selector)) as HTMLElement[];
  }

  /**
   * Apply reveal classes and CSS custom properties for a block.
   * @param {HTMLElement} block Block element to update.
   */
  _applyRevealClasses(block: HTMLElement) {
    const cfg = this._getBlockConfig(block);

    block.classList.add('reveal');
    block.classList.toggle('reveal--debug', cfg.debug);

    block.classList.remove(
      'reveal--anim-slide-clip',
      'reveal--anim-fade',
      'reveal--anim-blur-in',
      'reveal--anim-diag-slice',
    );

    const animClass =
      cfg.anim === 'fade'
        ? 'reveal--anim-fade'
        : cfg.anim === 'blur-in'
          ? 'reveal--anim-blur-in'
          : cfg.anim === 'diag-slice'
            ? 'reveal--anim-diag-slice'
            : 'reveal--anim-slide-clip';

    block.classList.add(animClass);

    if (cfg.animMs != null) block.style.setProperty('--anim-ms', `${cfg.animMs}ms`);
    else block.style.removeProperty('--anim-ms');

    block.style.setProperty('--anim-intensity', String(cfg.intensity));
  }

  /**
   * Split a block's text into lines using layout positions.
   * @param {HTMLElement} el Block element to split.
   * @returns {NodeListOf<HTMLElement>} NodeList of line elements.
   */
  _splitIntoLines(el: HTMLElement): NodeListOf<HTMLElement> {
    // same logic, just scoped inside instance
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    el.textContent = '';

    const linesContainer = document.createElement('span');
    linesContainer.className = 'reveal__lines';
    el.appendChild(linesContainer);

    const words = text.split(' ');
    const wordSpans: HTMLSpanElement[] = [];
    const spaceNodes: Text[] = [];

    words.forEach((w, i) => {
      const s = document.createElement('span');
      s.className = 'reveal__word';
      s.textContent = w;
      linesContainer.appendChild(s);
      wordSpans.push(s);

      if (i < words.length - 1) {
        const space = document.createTextNode(' ');
        spaceNodes.push(space);
        linesContainer.appendChild(space);
      }
    });

    // group by layout lines
    const lines: number[][] = [];
    let currentTop: number | null = null;
    let currentLineWords: number[] = [];

    for (let i = 0; i < wordSpans.length; i++) {
      const ws = wordSpans[i];
      const top = ws.offsetTop;
      if (currentTop === null) currentTop = top;

      if (top !== currentTop) {
        lines.push(currentLineWords);
        currentLineWords = [];
        currentTop = top;
      }
      currentLineWords.push(i);
    }
    if (currentLineWords.length) lines.push(currentLineWords);

    // rebuild
    const frag = document.createDocumentFragment();

    lines.forEach((lineWords) => {
      const line = document.createElement('span');
      line.className = 'reveal__line';

      const inner = document.createElement('span');
      inner.className = 'reveal__inner';

      lineWords.forEach((wordIndex, j) => {
        const word = wordSpans[wordIndex];
        inner.appendChild(word);
        if (j < lineWords.length - 1) {
          const space = spaceNodes[wordIndex];
          if (space) inner.appendChild(space);
        }
      });

      line.appendChild(inner);
      frag.appendChild(line);
    });

    linesContainer.replaceChildren(frag);
    return linesContainer.querySelectorAll('.reveal__line') as NodeListOf<HTMLElement>;
  }

  // ---------- Animation primitive ----------

  /**
   * Animate a single line and resolve when the animation completes.
   * @param {HTMLElement} line Line element to animate.
   * @returns {Promise<void>} Promise that resolves when animation completes.
   */
  _animateLine(line: HTMLElement): Promise<void> {
    return new Promise((resolve) => {
      if (this.prefersReducedMotion) {
        line.classList.add('reveal__line--visible');
        resolve();
        return;
      }

      const block = line.closest(this.selector) as HTMLElement | null;
      const cfg = block ? this._getBlockConfig(block) : null;

      const durationMs = cfg?.animMs != null ? cfg.animMs : this._revealDuration();
      const debugEnabled = !!cfg?.debug;

      const endAt = performance.now() + durationMs;

      if (debugEnabled) line.dataset.reveal = '0%';

      requestAnimationFrame(() => line.classList.add('reveal__line--visible'));

      let rafId = 0;
      const tick = () => {
        if (!debugEnabled) return;
        const v = getComputedStyle(line).getPropertyValue('--reveal').trim();
        if (v) line.dataset.reveal = v;
        if (performance.now() < endAt) rafId = requestAnimationFrame(tick);
      };
      if (debugEnabled) rafId = requestAnimationFrame(tick);

      setTimeout(() => {
        if (rafId) cancelAnimationFrame(rafId);
        if (debugEnabled) {
          const v = getComputedStyle(line).getPropertyValue('--reveal').trim();
          line.dataset.reveal = v || '100%';
        }
        resolve();
      }, durationMs);
    });
  }

  // ---------- Per-line visibility gate ----------

  /**
   * Build an IntersectionObserver gate that resolves when lines become visible.
   * @param {NodeListOf<HTMLElement> | HTMLElement[]} lines Line elements to observe.
   * @returns {{ gate: Map<HTMLElement, { promise: Promise<void>; resolve: () => void; resolved: boolean }>, io: IntersectionObserver }} Gate map and observer instance.
   */
  _createVisibilityGate(lines: NodeListOf<HTMLElement> | HTMLElement[]) {
    const gate = new Map<
      HTMLElement,
      { promise: Promise<void>; resolve: () => void; resolved: boolean }
    >();

    const isAlreadyVisible = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      return r.bottom > 0 && r.top < vh * 0.9;
    };

    lines.forEach((line) => {
      let resolveFn = () => {};
      const promise = new Promise<void>((res) => {
        resolveFn = res;
      });

      gate.set(line, { promise, resolve: resolveFn, resolved: false });

      if (isAlreadyVisible(line)) {
        const rec = gate.get(line);
        rec && (rec.resolved = true);
        resolveFn();
      }
    });

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const rec = gate.get(e.target as HTMLElement);
          if (!rec || rec.resolved) continue;
          rec.resolved = true;
          rec.resolve();
          io.unobserve(e.target);
        }
      },
      { threshold: 0.25, rootMargin: '0px 0px -10% 0px' },
    );

    lines.forEach((line) => {
      const rec = gate.get(line);
      if (rec && !rec.resolved) io.observe(line);
    });

    return { gate, io };
  }

  /**
   * Reveal lines sequentially, waiting for each to enter the viewport.
   * @param {NodeListOf<HTMLElement> | HTMLElement[]} lines Line elements to reveal.
   * @param {AbortSignal} abortSignal Abort signal to cancel playback.
   * @returns {Promise<void>} Promise that resolves when playback completes or is aborted.
   */
  async _playLinesSequentiallyWhenVisible(
    lines: NodeListOf<HTMLElement> | HTMLElement[],
    abortSignal: AbortSignal,
  ): Promise<void> {
    const { gate, io } = this._createVisibilityGate(lines);
    try {
      for (const line of lines) {
        if (abortSignal.aborted) break;

        const rec = gate.get(line);
        if (rec) await rec.promise;

        if (abortSignal.aborted) break;
        await this._animateLine(line);
      }
    } finally {
      io.disconnect();
    }
  }

  // ---------- Group orchestration ----------

  /**
   * Create the queue for a linear reveal group.
   * @param {string} groupName Group identifier.
   * @param {HTMLElement[]} blocks Candidate block elements.
   */
  _buildGroupQueue(groupName: string, blocks: HTMLElement[]) {
    const linearBlocks = blocks.filter((b) => {
      const cfg = this._getBlockConfig(b);
      return cfg.mode === 'linear' && cfg.group === groupName;
    });

    const state = new WeakMap();
    for (const b of linearBlocks) state.set(b, { ready: false, started: false, done: false });

    this._groupQueues.set(groupName, { blocks: linearBlocks, state });
  }

  /**
   * Start the next eligible block in a linear group.
   * @param {string} groupName Group identifier.
   * @param {LinearPolicy} policy Linear reveal policy.
   */
  _pumpGroupQueue(groupName: string, policy: LinearPolicy) {
    const q = this._groupQueues.get(groupName);
    if (!q) return;

    const { blocks, state } = q;

    // only one running at a time
    for (const b of blocks) {
      const st = state.get(b);
      if (st && st.started && !st.done) return;
    }

    if (policy === 'strict') {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const st = state.get(block);
        if (!st || st.done) continue;

        // require all previous done
        for (let j = 0; j < i; j++) {
          const pst = state.get(blocks[j]);
          if (pst && !pst.done) return;
        }

        if (!st.ready || st.started) return;
        this._startBlock(block, st, groupName, policy);
        return;
      }
      return;
    }

    // skip-unseen (your existing behavior)
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const st = state.get(block);
      if (!st || st.done || !st.ready || st.started) continue;

      // if any previous is ready (seen) and not done -> must wait
      for (let j = 0; j < i; j++) {
        const pst = state.get(blocks[j]);
        if (pst && pst.ready && !pst.done) return;
      }

      this._startBlock(block, st, groupName, policy);
      return;
    }
  }

  /**
   * Start revealing a single block and notify the queue on completion.
   * @param {HTMLElement} block Block element to reveal.
   * @param {GroupState} st Mutable state for the block within the group.
   * @param {string} groupName Group identifier.
   * @param {LinearPolicy} policy Linear reveal policy.
   */
  _startBlock(block: HTMLElement, st: GroupState, groupName: string, policy: LinearPolicy) {
    const lines = block.querySelectorAll<HTMLElement>('.reveal__line');
    if (!lines.length) {
      st.done = true;
      this._pumpGroupQueue(groupName, policy);
      return;
    }

    st.started = true;

    const ac = new AbortController();
    this._running.set(block, ac);

    this._playLinesSequentiallyWhenVisible(lines, ac.signal)
      .then(() => {
        if (ac.signal.aborted) return;
        st.done = true;
        this._pumpGroupQueue(groupName, policy);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        st.done = true;
        this._pumpGroupQueue(groupName, policy);
      });
  }

  // ---------- Block observer ----------

  /**
   * Observe blocks entering the viewport and trigger reveal behavior.
   * @param {HTMLElement[]} blocks Block elements to observe.
   */
  _setupBlockObserver(blocks: HTMLElement[]) {
    if (this._blockObserver) this._blockObserver.disconnect();
    this._groupQueues.clear();

    const groups = new Set<string>();
    for (const b of blocks) {
      const cfg = this._getBlockConfig(b);
      if (cfg.mode === 'linear') groups.add(cfg.group);
    }
    for (const g of groups) this._buildGroupQueue(g, blocks);

    this._blockObserver = new IntersectionObserver(
      (entries) => {
        const observer = this._blockObserver;
        if (!observer) return;

        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          const block = entry.target as HTMLElement;
          const cfg = this._getBlockConfig(block);

          if (cfg.mode === 'immediate') {
            if (this._running.has(block)) continue;

            const ac = new AbortController();
            this._running.set(block, ac);

            void this._playLinesSequentiallyWhenVisible(
              block.querySelectorAll<HTMLElement>('.reveal__line'),
              ac.signal,
            );

            observer.unobserve(block);
            continue;
          }

          const q = this._groupQueues.get(cfg.group);
          if (!q) continue;

          const st = q.state.get(block);
          if (st && !st.ready) st.ready = true;

          observer.unobserve(block);
          this._pumpGroupQueue(cfg.group, cfg.policy);
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px 0px 0px' },
    );

    for (const el of blocks) this._blockObserver.observe(el);
  }

  // ---------- Cleanup helpers ----------

  /**
   * Abort any running animations for current blocks.
   */
  _abortAllRunning() {
    const blocks = this._getBlocks();
    for (const el of blocks) {
      const ac = this._running.get(el);
      if (ac) ac.abort();
      this._running.delete(el);
    }
  }

  // ---------- Utilities ----------

  /**
   * Debounce a function by the given delay.
   * @param {(...args: unknown[]) => void} fn Function to debounce.
   * @param {number} ms Debounce delay in milliseconds.
   * @returns {(...args: unknown[]) => void} Debounced function.
   */
  _debounce(fn: (...args: unknown[]) => void, ms = 120) {
    let t: ReturnType<typeof setTimeout> | undefined;
    return (...args: unknown[]) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  /**
   * Clamp a numeric value, falling back when not finite.
   * @param {unknown} n Value to clamp.
   * @param {number} min Minimum allowed value.
   * @param {number} max Maximum allowed value.
   * @param {number | null} fallback Fallback value when input is not finite.
   * @returns {number | null} Clamped number or fallback.
   */
  _clampNumber(n: unknown, min: number, max: number, fallback: null): number | null;
  _clampNumber(n: unknown, min: number, max: number, fallback: number): number;
  _clampNumber(n: unknown, min: number, max: number, fallback: number | null): number | null {
    const x = Number(n);
    if (!Number.isFinite(x)) return fallback;
    return Math.min(max, Math.max(min, x));
  }
}
