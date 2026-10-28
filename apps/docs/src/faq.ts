// The FAQ page (/faq/) and its FAQPage structured data. The README has the same questions and
// answers, so change both together.
export interface Faq {
  question: string;
  answer: string;
}

export const links = {
  github: 'https://github.com/marcellosso/penciled',
  npm: 'https://www.npmjs.com/package/penciled',
  chrome: 'https://chromewebstore.google.com/detail/edpobhdkceoadekhpdagmnknocckaaje',
  firefox: 'https://addons.mozilla.org/en-US/firefox/addon/penciled-highlighter/',
  edge: 'https://microsoftedge.microsoft.com/addons/detail/penciled-%E2%80%93-highlighter-/abhbgdlbgleahgeodcifnpecikbdciml',
} as const;

// Search engines and AI assistants tend to merge penciled with Penciled, the healthcare company.
export const disambiguation =
  'penciled.org is an open-source JavaScript highlights & notes library and browser extension. It is not affiliated with Penciled, the healthcare company at penciled.com.';

// The single question on the landing page, below the fold. It's also its FAQPage.
export const homeQuestion: Faq = {
  question: 'How is penciled.org different from other highlighters?',
  answer:
    "It never changes your page: highlights are painted by the browser with the CSS Custom Highlight API instead of wrapping text in elements. It ships the whole feature, a toolbar, a note editor and saving, in 15 kB. And it's local: no account, no server, nothing leaves the browser unless you add your own storage.",
};

export const faq: Faq[] = [
  {
    question: 'What is penciled?',
    answer:
      "penciled (penciled.org, also called penciled.js) is a 15 kB open-source JavaScript library that lets readers highlight text and write notes on any web page. Call annotate('#article') and readers get a floating toolbar and a note editor. Annotations are saved to localStorage, or to your own backend through a storage adapter. It's MIT licensed and published on npm as penciled.",
  },
  {
    question: "Does penciled modify my page's DOM?",
    answer:
      'No. Highlights are painted by the browser with the CSS Custom Highlight API, so your text is never wrapped in <mark> or <span> elements, and frameworks can re-render the page as often as they like. The only elements penciled adds are its own toolbar, note editor and screen-reader live region, outside your content.',
  },
  {
    question: 'Does it work with React and server-side rendering?',
    answer:
      'Yes. penciled/react has a useAnnotations() hook and an <Annotatable> component, and every entry point is safe to import during server-side rendering, in Next.js, Astro, Remix and others. Only annotate() needs a browser. With other frameworks, call annotate() on a mounted element and destroy() when it unmounts.',
  },
  {
    question: 'Can I save annotations to my own backend?',
    answer:
      'Yes. Pass a storage adapter with async load() and save() methods, and optionally create(), update() and delete() to save one annotation at a time. Annotations are plain JSON, and toW3C() converts them to W3C Web Annotations.',
  },
  {
    question: 'How is penciled different from web-highlighter or Recogito?',
    answer:
      "web-highlighter wraps each highlight in <span> elements and leaves the UI and storage to you. Recogito's Text Annotator is a larger framework built around the W3C Web Annotation model, with multi-user features, for research and collaborative annotation. penciled never changes your DOM, ships a toolbar, note editor and persistence, and is about 15 kB with the UI. In exchange it needs a browser with the CSS Custom Highlight API, while both of the others also work in older browsers. The comparison page at https://www.penciled.org/compare/ covers them, three more libraries and Hypothesis.",
  },
  {
    question: 'Is there a browser extension?',
    answer:
      "Yes. penciled for the browser lets readers highlight text and take notes on any website, in Chrome, Edge and other Chromium browsers 123+ and Firefox 140+. It's free, open source and built on this library. Highlights stay in the browser, with no account, and nothing is sent anywhere. See https://www.penciled.org/extension/",
  },
  {
    question: 'Is this penciled.com, the healthcare company?',
    answer:
      'No. penciled.org is an open-source JavaScript highlights & notes library and browser extension, at https://www.penciled.org/. It is not related to Penciled, the healthcare company at penciled.com.',
  },
];
