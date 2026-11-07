import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/landing/legal-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply when you use Lynksy to build and run AI voice agents.",
  alternates: { canonical: "/terms" },
};

const mail = <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>;

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreement",
    body: <p>These terms are a contract between you and {SITE.name}. By creating an account or using the service you agree to them. If you use the service for an organisation, you confirm you have authority to bind it. You must be at least 18 years old.</p>,
  },
  {
    id: "the-service",
    title: "The service",
    body: <p>{SITE.name} lets you build AI voice agents that answer and place phone calls and reply to WhatsApp messages, review transcripts and manage a prepaid wallet. We may improve, change or discontinue features, and we will give reasonable notice of changes that materially reduce what you pay for.</p>,
  },
  {
    id: "your-account",
    title: "Your account",
    body: <p>Keep your login details secure and tell us at once if you suspect unauthorised use. You are responsible for activity under your account, including by people you invite.</p>,
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>You agree not to use the service to:</p>
        <ul>
          <li>break any law, including rules on telemarketing, do-not-disturb preferences, calling hours, data protection and consumer protection;</li>
          <li>contact people without a lawful basis or any consent the law requires;</li>
          <li>deceive, defraud, threaten, harass or impersonate anyone, or mislead people into thinking they are speaking to a human where the law requires disclosure of automation;</li>
          <li>collect or process sensitive data such as passwords, card numbers or Aadhaar and PAN details through your agents without a lawful reason and appropriate safeguards;</li>
          <li>interfere with or attempt to gain unauthorised access to the service or other customers' data; or</li>
          <li>resell the service in a way that breaches these terms.</li>
        </ul>
        <p>We may suspend or restrict an account that breaks these rules or puts others at risk.</p>
      </>
    ),
  },
  {
    id: "wallet-and-payments",
    title: "Wallet, prices and payments",
    body: (
      <>
        <p>The service is prepaid. You add money to your wallet and usage is deducted as it happens, for example per call minute. Prices are shown in rupees in your dashboard and on our pricing page and may change with notice. If your balance is too low, calls and messages may stop.</p>
        <p>Payments are handled by our payment provider. Unless the law requires otherwise, wallet top-ups are not refundable, but if you believe you were charged in error, contact us and we will review it promptly.</p>
      </>
    ),
  },
  {
    id: "your-content",
    title: "Your content and your callers",
    body: <p>You keep ownership of your prompts, configurations and data. You give us permission to process them to provide the service. You are responsible for what your agents say, for the instructions you give them and for the people you contact, including their consent and privacy. How we handle personal data is described in our Privacy Policy.</p>,
  },
  {
    id: "ai-limits",
    title: "AI limitations",
    body: <p>AI agents can misunderstand speech, make mistakes or give inaccurate answers. Review transcripts and test your agents before relying on them. Do not use the service as the only safeguard in situations involving health, safety, legal rights or large financial commitments, and set your agent to hand over to a person where it matters.</p>,
  },
  {
    id: "third-parties",
    title: "Third-party services",
    body: <p>The service relies on telephony, speech, language-model, messaging and payment providers. Their availability and terms affect the service, and we are not responsible for outages or changes outside our reasonable control. Your use of WhatsApp is also subject to Meta’s terms and policies.</p>,
  },
  {
    id: "availability",
    title: "Availability and support",
    body: <p>We work to keep the service running but do not promise it will be uninterrupted or error-free. We provide support by email at {mail}.</p>,
  },
  {
    id: "termination",
    title: "Suspension and termination",
    body: <p>You may stop using the service and close your account at any time. We may suspend or end your access if you break these terms, if required by law, or if your use risks harm to others or the service. On closure, we handle your data as described in the Privacy Policy.</p>,
  },
  {
    id: "liability",
    title: "Disclaimer and limit of liability",
    body: <p>The service is provided as is. To the extent the law allows, we are not liable for indirect or consequential losses, lost profits or lost data, and our total liability for any claim is limited to the amount you paid us in the three months before the event that gave rise to it. Nothing in these terms limits liability that cannot be limited by law.</p>,
  },
  {
    id: "indemnity",
    title: "Your responsibility for claims",
    body: <p>You agree to cover losses and costs we incur from claims arising out of your breach of these terms, your agents' conduct or your contacting people unlawfully.</p>,
  },
  {
    id: "law",
    title: "Governing law",
    body: <p>These terms are governed by the laws of India. Courts at the place of our registered office have exclusive jurisdiction, subject to any rights you have under law.</p>,
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: <p>We may update these terms. We will change the date above and tell account holders about material changes. Continuing to use the service after a change means you accept it.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>Questions about these terms? Email {mail}.</p>,
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="Please read these terms carefully. They explain what you can expect from Lynksy and what we expect from you when you build and run voice agents."
      sections={sections}
    />
  );
}
