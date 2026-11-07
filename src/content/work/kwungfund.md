---
title: "KwungFund"
role: "Everything: product, research and code, with my collaborator"
summary: "A local-first workspace for solo fund managers in Hong Kong and Taiwan. The AI prepares the paperwork, a person signs off, and nothing is filed or sent automatically."
chips: ["Fintech", "Product and engineering", "Human sign-off", "Local first"]
glance:
  - { label: "Role", value: "Product, research and code" }
  - { label: "For", value: "Solo funds in Hong Kong and Taiwan" }
  - { label: "Runs", value: "On the manager's own Mac" }
  - { label: "Rule", value: "Nothing files or sends itself" }
---

## What KwungFund is

KwungFund is a workspace for people who run a fund alone in Hong Kong or Taiwan, and it runs on the manager's own Mac. A one-person fund owes investors and regulators much the same paperwork as a large one, including quarterly fact sheets, semi-annual and annual reports, investor letters and regulatory filings. These often have to be in both English and Traditional Chinese, the numbers come from messy fund administrator exports, and a single wrong figure reaches investors and regulators.

## Deciding what to build

My collaborator and I scoped this on paper in June 2026, before writing any code, and the idea changed a lot. We looked at financial-printer and IPO automation, fund reporting, AML/KYC assessment (anti-money-laundering and customer identity checks), an IDE for private fund managers and a data hub before settling on a bilingual fund data platform. Retail fund managers felt the problem far more than private hedge funds, because of hard regulatory deadlines, costly bilingual translation and long production cycles. Small managers were also the ones incumbents didn't serve.

The plan also set limits on the AI. Extracting documents, filling in KYC forms and screening with a person deciding were all buildable. Auto-approval, final risk ratings and auto-submitting to regulators were licensed territory, so they stayed off-limits. The plan treated any data answer without a source as an architectural bug. It also set gates before any pilot, including cent-level reconciliation against source documents, 50 known-answer queries passing, and 10 to 15 real anonymized exports from Geneva, a fund accounting system, before any ingestion code. Those plans date from June, and the product on this page is the local-first workspace they turned into.

## How it works

The AI drafts and a person decides. Every draft waits in a sign-off queue, and nothing files or sends itself. Numbers are computed from the bound exports with accounting tie-outs, and the model never generates them. You can't sign off with blank manager notes or unclassified documents. Demo mode is always labelled so that sample numbers can't pass for a real fund, and fund documents never leave the Mac.

![The quarter's deliverables, ready to generate](/work/kwungfund/quarter.webp)
*The Quarter with sample data, showing fact sheets, a semi-annual report and an investor letter pack, each with its own sign-off.*

The app is organized around six places, each built around one question the manager has: What needs me, The Quarter, Trust the number, Investors, Portfolio and Library. Trust the number exists because the manager has to be sure of every figure before signing.
