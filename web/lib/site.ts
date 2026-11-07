// Public site facts used by SEO tags, the legal pages and the footer. Confirm the contact email
// and the effective date before launch: they appear in the Privacy Policy and Terms.
export const SITE = {
  name: "Lynksy",
  url: "https://app.lynksy.xyz",
  contactEmail: "support@lynksy.xyz",
  legalUpdated: "6 November 2026",
  tagline: "AI voice agents for phone calls in Indian languages",
};

export const absolute = (path: string) => SITE.url + path;
