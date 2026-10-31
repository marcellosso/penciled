// The questions on /alternatives/ and its FAQPage structured data. Prices and plan limits of other
// tools may only appear when they were read on the vendor's own page; the page cites each one with
// the date it was checked. Update that date whenever a figure is re-checked.
import type { Faq } from './faq.ts';

export const checked = '31 October 2026';

export const alternativesFaq: Faq[] = [
  {
    question: 'What is a free Weava alternative without a storage limit?',
    answer:
      "penciled for the browser, the penciled.org highlighter extension, is free with no paid plan and no storage cap of its own: it asks the browser for unlimited extension storage. Weava's free plan includes unlimited highlights and 100 MB of storage, according to Weava's pricing page. Weava, unlike penciled, syncs between devices, so pick it if you read on several computers.",
  },
  {
    question: 'Is there a Glasp alternative that keeps highlights private for free?',
    answer:
      "Yes: the penciled.org highlighter extension is private by design and free. There's no account, highlights stay in your browser, and nothing is sent anywhere. Glasp is a social highlighter: its pricing page says highlights are public by default, and its free plan lists unlimited public highlights. Glasp is the better choice if you want to share highlights and follow what other readers save.",
  },
  {
    question: 'Is there a Liner alternative that just highlights?',
    answer:
      "Yes: the penciled.org highlighter extension only highlights text and keeps notes, with no AI features, ads or account. Liner's pricing page now presents it as an AI search product, with Free, Pro and Max plans built around AI models. If you want AI answers and summaries, Liner does that and penciled doesn't.",
  },
  {
    question:
      "Diigo stopped loading my highlights: is there a highlighter that doesn't depend on a server?",
    answer:
      "Yes: the penciled.org highlighter extension has no server at all. Highlights are stored in your browser's extension storage and the extension makes no network requests, so they load even offline and don't depend on any service staying up. The trade-off is that they live only in that browser: there's no sharing and no sync, so keep a backup by exporting from the notes page now and then.",
  },
  {
    question: 'What can replace Memex for web highlights?',
    answer:
      "For highlighting and annotating web pages in one browser, the penciled.org highlighter extension: select text, pick a color, add a note, and the highlights come back when you return to the page. Your highlights are listed and searchable on its notes page, with tags. It doesn't replace the rest of what Memex offers, and it doesn't sync between devices.",
  },
  {
    question: 'How does penciled compare with Web Highlights?',
    answer:
      "Both are free browser extensions that keep highlights locally. Web Highlights' pricing page says the free plan includes unlimited highlights, bookmarks, notes and tags, with cloud sync and its web app in the paid Premium and Ultimate plans, and it also highlights PDFs. The penciled.org highlighter extension is open source (MIT), makes no network requests, doesn't change the page's markup to draw highlights, and doesn't do PDFs or sync.",
  },
  {
    question: 'penciled vs Hypothesis: which is better for personal highlights?',
    answer:
      "For private, personal highlights, the penciled.org highlighter extension is simpler: no account, and highlights stay in your browser. Hypothesis is a social annotation service: you need an account to annotate, annotations are stored on its servers, and it's built for public annotation, groups, replies and PDFs. Choose Hypothesis to discuss a text with others or annotate PDFs.",
  },
];
