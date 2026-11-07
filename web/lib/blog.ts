import { morePosts } from "./blog-more";

// Blog content. Posts are plain data so they render as static, crawlable HTML.
// No invented statistics: every claim is general knowledge or a described design choice.

export type Block =
  | { t: "p"; text: string }
  | { t: "h2"; text: string }
  | { t: "h3"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "callout"; title?: string; text: string };

export type Post = {
  slug: string;
  title: string;
  description: string; // meta description, kept under ~155 characters
  date: string; // ISO
  tag: string;
  blocks: Block[];
};

const firstPosts: Post[] = [
  {
    slug: "build-a-hinglish-voice-agent",
    title: "How to build a voice agent that handles Hinglish",
    description:
      "Callers in India mix Hindi and English in one sentence. Here is how to design the prompt, speech settings and voice so your agent copes with it.",
    date: "2026-10-12",
    tag: "Guides",
    blocks: [
      { t: "p", text: "Ask a customer in Pune or Delhi to describe a problem and you will rarely hear one clean language. You will hear Hindi grammar with English nouns: \"Mera order abhi tak deliver nahi hua\", \"Kal shaam ka appointment chahiye\". Linguists call this code-mixing, and on Indian phone lines it is the default, not the exception." },
      { t: "p", text: "A voice agent that only copes with textbook Hindi or textbook English will stumble on the calls that matter most. This guide covers the three places Hinglish goes wrong, and what to do about each." },
      { t: "h2", text: "1. Speech recognition: pick the language setting deliberately" },
      { t: "p", text: "Speech-to-text models are usually configured with a primary language. Set it to Hindi and most models will still transcribe English words that appear inside a Hindi sentence, but accuracy on long English phrases drops. Set it to English and Hindi words are often spelled phonetically and sometimes wrongly." },
      { t: "ul", items: [
        "If most of your callers speak mainly Hindi with English nouns, choose Hindi as the primary language.",
        "If callers speak mainly English with a few Hindi words, choose English (India).",
        "Test with ten real phrases from your own business, such as product names, branch names and plan names. These proper nouns are where recognition fails first.",
      ] },
      { t: "h2", text: "2. The prompt: tell the agent how to mix" },
      { t: "p", text: "A language model will follow whatever pattern you show it. If your prompt is written entirely in formal English, the agent drifts towards formal English even when the caller is chatting in Hinglish. Say what you want, and show it." },
      { t: "ul", items: [
        "State the rule: \"Reply in the language the caller uses. If they mix Hindi and English, mix the same way, in short sentences.\"",
        "Give two or three example exchanges in natural Hinglish, not translations.",
        "Keep technical terms in English if that is how people say them (\"EMI\", \"appointment\", \"order\"). Forcing a Hindi word nobody uses sounds robotic.",
        "Keep replies to one or two sentences. Long answers are hard to follow on a phone line.",
      ] },
      { t: "h2", text: "3. The voice: script matters" },
      { t: "p", text: "Text-to-speech engines need to know how to pronounce what they are given. A Hindi sentence written in Devanagari and a Hindi sentence written in Roman letters can sound very different, depending on the voice." },
      { t: "ul", items: [
        "Choose a voice built for Indian languages, and listen to it read your own sample sentences before you commit.",
        "Be consistent about script. Do not let the model switch between Devanagari and Roman within a single reply.",
        "Read numbers carefully. Phone numbers and amounts should be spoken digit by digit or in words, never as one long number.",
      ] },
      { t: "callout", title: "A quick test", text: "Call your own agent and say something messy: a question that starts in Hindi, switches to English in the middle, and includes a name. If the agent answers in the same register without asking you to repeat yourself, the setup is good." },
      { t: "h2", text: "What to do when recognition is unsure" },
      { t: "p", text: "Even a well-tuned agent mishears sometimes. Teach it to confirm important details instead of guessing: repeat back names, dates and amounts, and ask a short yes-or-no question. A single confirming line is much cheaper than a wrong booking." },
    ],
  },
  {
    slug: "voice-ai-emi-reminders-india",
    title: "Using voice AI for EMI reminders in India: a practical guide",
    description:
      "How lenders can use AI voice agents for payment reminders: call design, what to record, calling-hour rules and when a human should take over.",
    date: "2026-10-19",
    tag: "Financial services",
    blocks: [
      { t: "p", text: "Payment reminders are one of the most natural uses for a voice agent. The call is short, the goal is clear, and the customer usually needs a nudge rather than a negotiation. Done well, it recovers missed payments earlier and frees your team for the conversations that need a person. Done badly, it annoys customers and creates compliance risk." },
      { t: "callout", title: "Not legal advice", text: "Rules on recovery calls and telemarketing change. Treat this article as a starting point and check current RBI directions, your lender's policy and TRAI regulations with your compliance team." },
      { t: "h2", text: "Design the call around one outcome" },
      { t: "p", text: "A reminder call has one job: find out whether the customer will pay and when. Everything else is a distraction. A good flow is simple:" },
      { t: "ol", items: [
        "Identify the company and confirm you are speaking to the right person before mentioning any amount.",
        "State the reason for the call: an EMI due on a date, for an amount.",
        "Ask how and when they plan to pay.",
        "Record the answer, such as a promised date and mode of payment.",
        "Offer a human callback if the customer reports a problem or disputes the amount.",
      ] },
      { t: "h2", text: "Say it in the customer's language" },
      { t: "p", text: "Customers respond better, and more honestly, in the language they use at home. A Hindi or Tamil reminder that sounds natural gets a very different reaction from a stiff English script. Match the language to the customer record, and let the agent switch if the customer does." },
      { t: "h2", text: "What to record after every call" },
      { t: "ul", items: [
        "Whether the right person answered.",
        "A promise-to-pay date and payment mode, if given.",
        "The reason for delay, in the customer's own words.",
        "Any dispute, complaint or hardship request, flagged for a person to follow up.",
        "The full transcript, so a reviewer can check the tone and accuracy later.",
      ] },
      { t: "h2", text: "Rules to respect" },
      { t: "ul", items: [
        "Calling hours. RBI's guidance on recovery practices has asked lenders and their agents to contact borrowers only within set hours, historically between 8 am and 7 pm. Confirm the current rule and enforce it in your campaign schedule.",
        "Conduct. No threats, no harassment, no contacting people other than the borrower about the debt. Write these rules into the agent's prompt.",
        "Identity. The agent should say who it is calling from, and should not claim to be a human if the customer sincerely asks.",
        "Telemarketing. Service and transactional calls are treated differently from promotional ones. If a call includes any offer, check TRAI's rules on registration and customer preference (DND).",
      ] },
      { t: "h2", text: "Know when to hand over" },
      { t: "p", text: "An AI agent should not negotiate settlements, waive fees or discuss hardship in depth. Write explicit hand-over triggers into the prompt: a dispute, a request for a waiver, signs of distress, or a customer who simply asks for a person. Capture the details and flag the call for your team." },
      { t: "h2", text: "Start small" },
      { t: "p", text: "Run the agent on a small batch of customers first. Read every transcript for a week. You will find phrases to fix, edge cases to add and tone to adjust. Then widen the campaign." },
    ],
  },
  {
    slug: "voice-agent-latency",
    title: "Why latency makes or breaks a voice agent",
    description:
      "People expect a reply within about a fifth of a second. Here is where the delay in a voice agent comes from and how to shrink each part.",
    date: "2026-10-26",
    tag: "Engineering",
    blocks: [
      { t: "p", text: "In everyday conversation, the gap between one speaker finishing and the other starting is remarkably short. A well-known cross-language study of turn-taking found that the typical gap is around a fifth of a second. We do not notice that rhythm until it breaks. When a voice agent takes two seconds to answer, the caller starts to say \"hello?\" and the conversation falls apart." },
      { t: "h2", text: "Where the time goes" },
      { t: "p", text: "A voice agent turns a caller's speech into an answer in several steps. Each one adds delay:" },
      { t: "ol", items: [
        "Detecting that the caller has stopped speaking (endpointing).",
        "Converting speech to text.",
        "Waiting for the language model's first words.",
        "Converting those words to audio.",
        "Network travel between the caller, the telephony provider and your servers.",
      ] },
      { t: "p", text: "The total is the sum of these, so a delay you cannot see in one step can still ruin the whole." },
      { t: "h2", text: "Stream everything" },
      { t: "p", text: "The biggest improvement comes from not waiting. If speech recognition streams text as it arrives, the language model can start sooner. If the model streams its reply, text-to-speech can start on the first sentence while the rest is still being written. The caller hears the beginning of the answer while the end is still being produced." },
      { t: "h2", text: "Keep prompts and replies short" },
      { t: "ul", items: [
        "A shorter prompt means less for the model to read before it answers.",
        "A short first sentence means audio starts sooner. Open with a brief acknowledgement, then give the detail.",
        "Short replies are also easier to follow on a phone line.",
      ] },
      { t: "h2", text: "Choose the endpointing delay carefully" },
      { t: "p", text: "Endpointing is a trade-off. If the agent decides the caller has finished after a very short pause, it answers quickly but cuts people off mid-sentence. Wait too long and every reply feels slow. The right setting depends on how your callers speak, so test it with real calls rather than guessing." },
      { t: "h2", text: "Measure each stage, not just the total" },
      { t: "p", text: "A single \"response time\" number hides the problem. Measure each stage separately on real calls: the endpointing wait, the time to the model's first token, and the time to the first audio. Look at the slow end of the distribution, not just the average, because callers remember the one long pause." },
      { t: "callout", title: "Keep a fallback", text: "Providers have slow moments and outages. Plan for them with a backup speech engine and a backup model, so one slow service does not turn into dead air on a live call." },
    ],
  },
  {
    slug: "barge-in-and-turn-taking",
    title: "Barge-in and turn-taking: why voice agents talk over people",
    description:
      "Interruptions are normal in real conversations. Learn how barge-in works, why background noise cuts agents off, and how to tune it.",
    date: "2026-11-02",
    tag: "Engineering",
    blocks: [
      { t: "p", text: "Two complaints come up again and again about voice agents. \"It talks over me\" and \"it stopped when someone coughed\". Both are about turn-taking, the unwritten rules of who speaks when. Getting it right is what separates an agent that feels natural from one that feels like a phone menu." },
      { t: "h2", text: "What barge-in is" },
      { t: "p", text: "Barge-in means the caller can interrupt the agent while it is speaking. When it happens, the agent should stop talking quickly, listen, and respond to what the caller said. Without barge-in, callers must wait for the agent to finish before they can speak, which is exactly how an old IVR menu feels." },
      { t: "h2", text: "Why it is hard on a phone line" },
      { t: "p", text: "The system has to decide, in a fraction of a second, whether a sound is a real interruption. Phone lines are noisy:" },
      { t: "ul", items: [
        "A cough, a laugh or a short \"hmm\" is not a request to stop.",
        "A television or another person in the room can sound like the caller.",
        "The agent's own voice can leak back into the line as an echo.",
      ] },
      { t: "p", text: "Treat every sound as an interruption and the agent stops constantly. Ignore too many and callers feel unheard." },
      { t: "h2", text: "Practical ways to tune it" },
      { t: "ul", items: [
        "Require a few words. Only treat speech as an interruption once the caller has said a couple of words, so a single sound does not stop the agent.",
        "Compare loudness. People near the caller are usually quieter than the caller. Comparing a sound with the caller's own usual volume helps ignore bystanders.",
        "Protect the thinking pause. While the agent is preparing its reply, a late \"yes\" or \"okay\" from the caller should not restart the whole turn.",
        "Wait for a finished thought. A caller who pauses mid-sentence has not finished. A short wait before replying avoids answering half a question.",
      ] },
      { t: "h2", text: "Silence is part of turn-taking too" },
      { t: "p", text: "Sometimes the caller says nothing. Maybe they walked away, maybe the line dropped. A good agent checks in once (\"Are you still there?\"), waits a little, and then ends the call politely if there is still no answer. Without that, calls hang open and cost you money." },
      { t: "h2", text: "Test it with real conditions" },
      { t: "p", text: "Call your agent from a busy street, with a television on, and on a poor mobile signal. Interrupt it, cough, and stay quiet. If it behaves sensibly in those cases, it will cope with the real world." },
    ],
  },
  {
    slug: "write-a-prompt-for-a-phone-agent",
    title: "How to write a prompt for a phone agent",
    description:
      "A prompt for a phone call is different from a chat prompt. Use these rules for short replies, confirmations, numbers and clean hand-offs.",
    date: "2026-11-05",
    tag: "Guides",
    blocks: [
      { t: "p", text: "A prompt that works well in a chat window often fails on the phone. People listen differently from how they read. They cannot scroll back, skim, or look at a list. Your prompt has to produce answers that work for the ear." },
      { t: "h2", text: "Set the role and the goal in the first lines" },
      { t: "p", text: "Say who the agent is, which company it represents and the one thing the call is for. A booking agent, a reminder agent and a support agent behave very differently, so be specific about the goal." },
      { t: "h2", text: "Rules that make speech sound natural" },
      { t: "ul", items: [
        "Speak in short sentences. One or two per reply.",
        "Ask one question at a time. Two questions in a row confuse people on the phone.",
        "No lists, no markdown, no emojis. They are read aloud badly or not at all.",
        "Use everyday words, the way a helpful colleague would say them.",
        "Match the caller's language and level of formality.",
      ] },
      { t: "h2", text: "Handle numbers and details carefully" },
      { t: "ul", items: [
        "Read phone numbers digit by digit and in small groups.",
        "Repeat back names, dates, times and amounts before you act on them.",
        "Tell the agent to spell or confirm anything it is unsure it heard.",
      ] },
      { t: "h2", text: "Say what the agent must not do" },
      { t: "p", text: "Limits matter as much as instructions. Write down the things the agent should never promise: discounts it cannot give, medical or legal advice, anything outside your business. Then say what to do instead, usually to offer a callback from a person." },
      { t: "h2", text: "Decide how calls end" },
      { t: "p", text: "Give the agent a clear ending: summarise what was agreed, say goodbye once, and end the call. Without this, agents either hang on awkwardly or repeat themselves." },
      { t: "h2", text: "A simple structure to start from" },
      { t: "ol", items: [
        "Who you are and which business you represent.",
        "The goal of the call.",
        "How to speak: length, tone, language.",
        "The facts the agent may use, such as timings, prices and policies.",
        "What to collect from the caller.",
        "When to hand over to a person.",
        "How to end the call.",
      ] },
      { t: "callout", title: "Iterate with transcripts", text: "Your first prompt will not be your last. After every batch of calls, read the transcripts, find where the agent was long-winded or confused, and fix the prompt. Small edits made from real calls beat big rewrites made from guesses." },
    ],
  },
];

export const posts: Post[] = [...firstPosts, ...morePosts];

export const findPost = (slug: string) => posts.find((p) => p.slug === slug);
export const sortedPosts = () => [...posts].sort((a, b) => b.date.localeCompare(a.date));

export function readingMinutes(post: Post) {
  const words = post.blocks
    .map((b) => ("text" in b ? b.text : b.items.join(" ")))
    .join(" ")
    .split(/\s+/).length;
  return Math.max(2, Math.round(words / 200));
}

export const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
