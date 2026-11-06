---
title: "KwungFund"
role: "Everything: product, research and code, with my collaborator"
summary: "A local-first workspace for solo fund managers in Hong Kong and Taiwan: the AI prepares the paperwork, a person signs off, and nothing is filed or sent automatically"
chips: ["Fintech", "Product and engineering", "Human sign-off", "Local first"]
glance:
  - { label: "Role", value: "Product, research and code" }
  - { label: "For", value: "Solo funds in Hong Kong and Taiwan" }
  - { label: "Runs", value: "On the manager's own Mac" }
  - { label: "Rule", value: "Nothing files or sends itself" }
---

## The problem

Run a fund alone and you still owe investors and regulators what a large fund owes them:

- **The paperwork:** quarterly fact sheets, semi-annual and annual reports, investor letters, regulatory filings
- **In two languages:** often English and Traditional Chinese
- **From messy data:** exports from fund administrators
- **No room for error:** a single wrong number reaches investors and regulators

## Deciding what to build

My collaborator and I scoped it on paper in June 2026, before writing any code, and the idea moved a lot:

- **Six directions:** financial-printer and IPO automation, fund reporting, AML/KYC assessment, an IDE for private fund managers, a data hub, then a bilingual fund data platform
- **Who hurts most:** retail fund managers, with hard regulatory deadlines, costly bilingual translation and long production cycles, felt it far more than private hedge funds
- **Who gets ignored:** small managers, who incumbents don't serve
- **What the AI must not do:** extracting documents, filling in KYC forms and screening with a person deciding are all buildable; auto-approval, final risk ratings and auto-submitting to regulators are licensed territory, so they stayed off-limits
- **An uncited answer is a defect:** the plan treated any data answer without a source as an architectural bug
- **Gates set before any pilot:** cent-level reconciliation against source documents, 50 known-answer queries passing, and 10 to 15 real anonymized Geneva exports before any ingestion code
- **Where it went next:** those plans are from June, and the product below is the local-first workspace it became

## The principle: the agent prepares, humans sign

The AI does the drafting, and the decision stays with a person:

- **Nothing files or sends itself:** every draft waits in a sign-off queue
- **Numbers are computed, never generated:** they come from the bound exports, with accounting tie-outs
- **Gates you can't skip:** no sign-off with blank manager notes or unclassified documents
- **Demo mode is always labelled:** sample numbers can't pass for a real fund
- **Local first:** fund documents never leave the Mac

![The quarter's deliverables, ready to generate](/work/kwungfund/quarter.webp)
*The Quarter with sample data: fact sheets, a semi-annual report and an investor letter pack, each with its own sign-off*

## Built around the manager's questions

Six places, one question each: What needs me, The Quarter, Trust the number, Investors, Portfolio, Library

- **Why "Trust the number" exists:** producing a report is the easy part, and being sure of every figure before you sign is the hard one
