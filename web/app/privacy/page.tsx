import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/landing/legal-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Lynksy collects, uses and protects personal data for businesses and the people they call or message.",
  alternates: { canonical: "/privacy" },
};

const mail = <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>;

const sections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are and our role",
    body: (
      <>
        <p>
          {SITE.name} provides software that lets businesses build AI voice agents that place and answer phone calls and reply to WhatsApp messages. This policy explains what personal data we handle and why.
        </p>
        <p>
          We act in two roles. For our own account holders (the business and its team members) we decide how data is used, so we are the data fiduciary. For the people your agents talk to (your callers and WhatsApp contacts) you decide why and how their data is used, and we process it on your behalf as a data processor. If you are a customer of a business that uses {SITE.name}, please contact that business first about your data.
        </p>
      </>
    ),
  },
  {
    id: "data-we-collect",
    title: "Data we collect",
    body: (
      <>
        <p>Depending on how you use the service, we handle:</p>
        <ul>
          <li><b>Account data:</b> your name or organisation name, email address and login details.</li>
          <li><b>Agent configuration:</b> the prompts, greetings, languages and voices you set up.</li>
          <li><b>Call data:</b> phone numbers, call times, duration, direction, cost, the transcript of the conversation, and an outcome summary generated after the call. We do not store audio recordings of phone calls.</li>
          <li><b>WhatsApp data:</b> the sender’s WhatsApp number and profile name, message text, and the transcript of voice notes. Voice-note audio is processed to produce a transcript and reply, and is not kept after processing.</li>
          <li><b>Payment data:</b> top-up amounts and payment identifiers. Card, UPI and bank details are collected and processed by our payment provider, not stored by us.</li>
          <li><b>Technical data:</b> logs of errors, call events and system performance, used to run and secure the service.</li>
        </ul>
      </>
    ),
  },
  {
    id: "how-we-use-it",
    title: "How we use data",
    body: (
      <>
        <ul>
          <li>To run the service: connect calls and messages, generate agent replies and show transcripts in your dashboard.</li>
          <li>To bill you: record usage and wallet balance.</li>
          <li>To keep the service safe, reliable and fast, including detecting abuse and fixing faults.</li>
          <li>To communicate with you about your account, security and changes to the service.</li>
          <li>To meet legal obligations.</li>
        </ul>
        <p>We do not sell personal data, and we do not use the content of your calls or messages to train our own models.</p>
      </>
    ),
  },
  {
    id: "service-providers",
    title: "Service providers",
    body: (
      <>
        <p>
          To deliver the service we send data to third parties who process it for us. Depending on your settings, these include telephony providers (such as VoiceLink), speech-to-text and text-to-speech providers (such as Sarvam, Gnani, ElevenLabs and Rumik), language-model providers reached through OpenRouter, Meta’s WhatsApp Cloud API, our database and hosting providers (Supabase and our cloud servers) and our payment provider (Razorpay).
        </p>
        <p>
          Each receives only the data needed for its task, for example audio for transcription or text for a reply. These providers have their own privacy terms, and some process data outside India. We do not authorise them to use your data for their own purposes beyond what their terms allow.
        </p>
      </>
    ),
  },
  {
    id: "calls-and-consent",
    title: "Calls, consent and your responsibilities",
    body: (
      <p>
        If you use {SITE.name} to contact people, you are responsible for having a lawful basis and any required consent, for following calling-hour, do-not-disturb and telemarketing rules, and for telling people when they are speaking to an automated agent where required. You should not enter personal data into agent prompts unless you need to.
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep data",
    body: (
      <p>
        We keep account, call and message data while your account is active so you can review it. You can ask us to delete your account and its data at any time. After deletion, we remove or anonymise data within a reasonable period, except where we must keep it to meet legal, tax or accounting obligations, resolve disputes or enforce our terms. Backups are overwritten on a rolling schedule.
      </p>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        We use encryption in transit, access controls that separate each organisation’s data, restricted access to credentials and monitoring of our systems. No system is perfectly secure. If a breach affects your data, we will notify you and the relevant authority as the law requires.
      </p>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <>
        <p>Under India’s Digital Personal Data Protection Act, 2023 and other applicable law, you may have the right to:</p>
        <ul>
          <li>access a summary of the personal data we hold about you;</li>
          <li>correct or complete inaccurate data;</li>
          <li>ask us to erase your data;</li>
          <li>withdraw consent where we rely on it;</li>
          <li>nominate someone to exercise your rights on your behalf; and</li>
          <li>have a grievance addressed.</li>
        </ul>
        <p>To use these rights, write to {mail}. We will respond within the time the law requires.</p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>The service is for businesses and is not directed at anyone under 18. We do not knowingly collect personal data from children.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: <p>We may update this policy as the service or the law changes. We will change the date at the top and, for significant changes, tell account holders by email or in the dashboard.</p>,
  },
  {
    id: "contact",
    title: "Contact and grievances",
    body: <p>For questions, requests or complaints about your data, email our grievance contact at {mail}.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="We want you to understand exactly what happens to the data that passes through Lynksy. This policy is written in plain language, and we have tried to be specific rather than vague."
      sections={sections}
    />
  );
}
