import { daysAgo, hoursAgo } from "../../lib/daysAgo";
import type { PersonId } from "./people";

export interface FieldWithStatus<T> {
  value: T;
  status: "known" | "unknown";
}
export interface CompensationExpectation {
  min: number;
  max: number;
  currency: string;
  period: "year" | "month" | "hour";
  basis: "gross" | "net" | "unknown";
  status: "known" | "unknown";
}
export interface EmploymentEntry {
  company: string;
  title: string;
  start: string;
  end: string;
  achievements: string[];
}
export interface EducationEntry {
  statement: string;
  period: string;
}

export interface Candidate {
  id: string;
  displayName: string;
  identityStatus: "confirmed" | "provisional";
  contact: {
    email: string;
    phone: string;
    location: FieldWithStatus<string>;
  };
  workAuth: FieldWithStatus<string>;
  tags: string[];
  owner: PersonId;
  createdAt: string;
  lastMatchedAt: string | null;
  retention: string;
  libraryStatus: "available";
  compensationExpectation: CompensationExpectation | null;
  missingFields: string[];
  employment: EmploymentEntry[];
  skills: string[];
  education: EducationEntry[];
  note?: string;
}

export const CANDIDATES: Record<string, Candidate> = {
  "cand-alex": {
    id: "cand-alex",
    displayName: "Alex Morgan",
    identityStatus: "confirmed",
    contact: { email: "alex.morgan.demo@example.com", phone: "+1 (512) 555-0142", location: { value: "Austin, TX, US", status: "known" } },
    workAuth: { value: "US Citizen", status: "known" },
    tags: ["Backend", "Distributed Systems"],
    owner: "emma",
    createdAt: daysAgo(19),
    lastMatchedAt: daysAgo(2),
    retention: "standard-24mo",
    libraryStatus: "available",
    compensationExpectation: null,
    missingFields: ["compensation_expectation"],
    employment: [
      {
        company: "Northwind Systems",
        title: "Senior Backend Engineer",
        start: "2021-03",
        end: "Present",
        achievements: [
          "Led migration of the monolith checkout service to a service-oriented architecture serving 40M requests/day",
          "Owned end-to-end reduction of checkout p99 latency from 820ms to 210ms",
        ],
      },
      {
        company: "Fenwick Data",
        title: "Backend Engineer",
        start: "2018-06",
        end: "2021-02",
        achievements: ["Built the event-ingestion pipeline handling 2B events/day"],
      },
    ],
    skills: ["Go", "Distributed Systems", "PostgreSQL", "Kafka", "Kubernetes"],
    education: [{ statement: "B.S. Computer Science, University of Texas at Austin", period: "2014–2018" }],
  },
  "cand-am2": {
    id: "cand-am2",
    displayName: "Alex Morgan",
    identityStatus: "confirmed",
    contact: { email: "a.morgan.finance@example.com", phone: "+1 (415) 555-0199", location: { value: "San Francisco, CA, US", status: "known" } },
    workAuth: { value: "US Citizen", status: "known" },
    tags: ["Finance"],
    owner: "emma",
    createdAt: daysAgo(11),
    lastMatchedAt: daysAgo(11),
    retention: "standard-24mo",
    libraryStatus: "available",
    compensationExpectation: { min: 140000, max: 140000, currency: "USD", period: "year", basis: "gross", status: "known" },
    missingFields: [],
    employment: [
      {
        company: "Ridgeline Capital",
        title: "Senior Financial Analyst",
        start: "2019-01",
        end: "Present",
        achievements: ["Led quarterly forecasting model used across 3 business units"],
      },
    ],
    skills: ["Financial Modeling", "Excel", "SQL"],
    education: [{ statement: "B.A. Economics, UC Berkeley", period: "2013–2017" }],
    note: "Different person from cand-alex — same display name, distinct identity. Kept separate after duplicate review.",
  },
  "cand-jordan": {
    id: "cand-jordan",
    displayName: "Jordan Lee",
    identityStatus: "confirmed",
    contact: { email: "jordan.lee.demo@example.com", phone: "+1 (206) 555-0118", location: { value: "Seattle, WA, US", status: "known" } },
    workAuth: { value: "US Permanent Resident", status: "known" },
    tags: ["Backend", "0→1"],
    owner: "emma",
    createdAt: daysAgo(15),
    lastMatchedAt: daysAgo(1),
    retention: "standard-24mo",
    libraryStatus: "available",
    compensationExpectation: { min: 150000, max: 175000, currency: "USD", period: "year", basis: "gross", status: "known" },
    missingFields: [],
    employment: [
      {
        company: "Solo Ventures (self-directed)",
        title: "Founding Engineer",
        start: "2022-01",
        end: "2024-06",
        achievements: [
          "Built and shipped an internal analytics platform from scratch as the sole engineer — 0 to production in 4 months",
          "Owned infrastructure, data model and rollout with no prior team precedent",
        ],
      },
      { company: "Bridgeworks", title: "Software Engineer", start: "2019-07", end: "2021-12", achievements: ["Maintained payment reconciliation services"] },
    ],
    skills: ["Python", "AWS", "Terraform", "PostgreSQL"],
    education: [{ statement: "B.S. Computer Science, University of Washington", period: "2015–2019" }],
  },
  "cand-casey": {
    id: "cand-casey",
    displayName: "Casey Chen",
    identityStatus: "confirmed",
    contact: { email: "casey.chen.demo@example.com", phone: "+1 (312) 555-0164", location: { value: "Chicago, IL, US", status: "known" } },
    workAuth: { value: "US Citizen", status: "known" },
    tags: ["Backend"],
    owner: "daniel",
    createdAt: daysAgo(13),
    lastMatchedAt: daysAgo(3),
    retention: "standard-24mo",
    libraryStatus: "available",
    compensationExpectation: null,
    missingFields: ["compensation_expectation", "years_experience"],
    employment: [
      {
        company: "Harborline Tech",
        title: "Software Engineer",
        start: "2020-04",
        end: "Present",
        achievements: [
          "Presented quarterly technical reviews to cross-functional stakeholders; consistently praised for clarity",
          "Contributed to backend services for the order-management platform",
        ],
      },
    ],
    skills: ["Java", "Spring", "MySQL"],
    education: [{ statement: "B.S. Information Systems, DePaul University", period: "2016–2020" }],
  },
  "cand-riley": {
    id: "cand-riley",
    displayName: "Riley Thompson",
    identityStatus: "confirmed",
    contact: { email: "riley.thompson.demo@example.com", phone: "+1 (720) 555-0107", location: { value: "Denver, CO, US", status: "known" } },
    workAuth: { value: "US Citizen", status: "known" },
    tags: ["Backend"],
    owner: "emma",
    createdAt: daysAgo(6),
    lastMatchedAt: daysAgo(1),
    retention: "standard-24mo",
    libraryStatus: "available",
    compensationExpectation: { min: 160000, max: 180000, currency: "USD", period: "year", basis: "gross", status: "known" },
    missingFields: [],
    employment: [{ company: "Cobalt Logic", title: "Backend Engineer II", start: "2019-09", end: "Present", achievements: ["Owns the inventory-sync service (99.95% uptime)"] }],
    skills: ["Go", "gRPC", "PostgreSQL"],
    education: [{ statement: "B.S. Computer Engineering, Colorado State University", period: "2015–2019" }],
  },
  "cand-morganb": {
    id: "cand-morganb",
    displayName: "Morgan Blake",
    identityStatus: "confirmed",
    contact: { email: "morgan.blake.demo@example.com", phone: "+1 (646) 555-0133", location: { value: "New York, NY, US", status: "known" } },
    workAuth: { value: "Requires employer sponsorship (H-1B transfer)", status: "known" },
    tags: ["Backend"],
    owner: "emma",
    createdAt: daysAgo(9),
    lastMatchedAt: daysAgo(9),
    retention: "standard-24mo",
    libraryStatus: "available",
    compensationExpectation: { min: 150000, max: 160000, currency: "USD", period: "year", basis: "gross", status: "known" },
    missingFields: [],
    employment: [{ company: "Ferrous Cloud", title: "Backend Engineer", start: "2021-01", end: "Present", achievements: ["Maintains internal tooling services"] }],
    skills: ["Node.js", "MongoDB"],
    education: [{ statement: "B.S. Computer Science, Rutgers University", period: "2017–2021" }],
  },
  "cand-taylor": {
    id: "cand-taylor",
    displayName: "Taylor Brooks",
    identityStatus: "confirmed",
    contact: { email: "taylor.brooks.demo@example.com", phone: "+1 (503) 555-0121", location: { value: "Portland, OR, US", status: "known" } },
    workAuth: { value: "US Citizen", status: "known" },
    tags: ["Frontend", "Product"],
    owner: "emma",
    createdAt: daysAgo(8),
    lastMatchedAt: daysAgo(8),
    retention: "standard-24mo",
    libraryStatus: "available",
    compensationExpectation: { min: 130000, max: 150000, currency: "USD", period: "year", basis: "gross", status: "known" },
    missingFields: [],
    employment: [{ company: "Lumen Retail", title: "Product Engineer", start: "2020-02", end: "Present", achievements: ["Built customer-facing React storefront components"] }],
    skills: ["React", "TypeScript", "Design Systems"],
    education: [{ statement: "B.A. Human-Computer Interaction, University of Oregon", period: "2016–2020" }],
  },
  "cand-priya": {
    id: "cand-priya",
    displayName: "Priya Shah",
    identityStatus: "confirmed",
    contact: { email: "priya.shah.demo@example.com", phone: "+1 (669) 555-0176", location: { value: "San Jose, CA, US", status: "known" } },
    workAuth: { value: "US Citizen", status: "known" },
    tags: ["Backend", "Leadership"],
    owner: "emma",
    createdAt: daysAgo(2),
    lastMatchedAt: daysAgo(2),
    retention: "standard-24mo",
    libraryStatus: "available",
    compensationExpectation: { min: 190000, max: 220000, currency: "USD", period: "year", basis: "gross", status: "known" },
    missingFields: [],
    employment: [{ company: "Anchorpoint Inc.", title: "Engineering Manager", start: "2020-05", end: "Present", achievements: ["Manages a team of 6 backend engineers", "Previously led the platform reliability initiative"] }],
    skills: ["Go", "Leadership", "Distributed Systems"],
    education: [{ statement: "M.S. Computer Science, San Jose State University", period: "2013–2015" }],
  },
  "cand-morgane": {
    id: "cand-morgane",
    displayName: "Morgan Ellis",
    identityStatus: "confirmed",
    contact: { email: "morgan.ellis.demo@example.com", phone: "+1 (415) 555-0188", location: { value: "San Francisco, CA, US", status: "known" } },
    workAuth: { value: "US Citizen", status: "known" },
    tags: ["Frontend", "React"],
    owner: "emma",
    createdAt: daysAgo(1),
    lastMatchedAt: null,
    retention: "standard-24mo",
    libraryStatus: "available",
    compensationExpectation: { min: 145000, max: 165000, currency: "USD", period: "year", basis: "gross", status: "known" },
    missingFields: [],
    employment: [{ company: "Brightline Software", title: "Senior Frontend Engineer", start: "2020-08", end: "Present", achievements: ["Led the component library rewrite adopted across 6 product teams", "Cut first-contentful-paint by 38% on the marketing site"] }],
    skills: ["React", "TypeScript", "Design Systems", "Next.js"],
    education: [{ statement: "B.S. Computer Science, San Francisco State University", period: "2015–2019" }],
  },
  "cand-samo": {
    id: "cand-samo",
    displayName: "Sam Okafor",
    identityStatus: "confirmed",
    contact: { email: "sam.okafor.demo@example.com", phone: "+1 (917) 555-0155", location: { value: "New York, NY, US", status: "known" } },
    workAuth: { value: "US Citizen", status: "known" },
    tags: ["Data Science", "Machine Learning"],
    owner: "daniel",
    createdAt: daysAgo(52),
    lastMatchedAt: daysAgo(52),
    retention: "standard-24mo",
    libraryStatus: "available",
    compensationExpectation: { min: 175000, max: 200000, currency: "USD", period: "year", basis: "gross", status: "known" },
    missingFields: [],
    employment: [{ company: "Northlake Analytics", title: "Senior Data Scientist", start: "2019-03", end: "Present", achievements: ["Built the churn-prediction model now used across 3 product lines", "Presented findings quarterly to the executive team"] }],
    skills: ["Python", "PyTorch", "SQL", "Experiment Design"],
    education: [{ statement: "M.S. Statistics, Columbia University", period: "2017–2019" }],
  },
  "cand-jamier": {
    id: "cand-jamier",
    displayName: "Jamie Rivera",
    identityStatus: "confirmed",
    contact: { email: "jamie.rivera.demo@example.com", phone: "+1 (303) 555-0142", location: { value: "Remote (US)", status: "known" } },
    workAuth: { value: "US Citizen", status: "known" },
    tags: ["SRE", "DevOps", "Kubernetes"],
    owner: "emma",
    createdAt: daysAgo(35),
    lastMatchedAt: daysAgo(35),
    retention: "standard-24mo",
    libraryStatus: "available",
    compensationExpectation: { min: 175000, max: 205000, currency: "USD", period: "year", basis: "gross", status: "known" },
    missingFields: [],
    employment: [{ company: "Ironclad Cloud", title: "Site Reliability Engineer", start: "2018-11", end: "Present", achievements: ["Reduced P1 incident MTTR from 90 to 22 minutes", "Owns the on-call tooling and runbook program for 40+ services"] }],
    skills: ["Kubernetes", "Terraform", "Go", "Prometheus"],
    education: [{ statement: "B.S. Computer Engineering, University of Colorado Boulder", period: "2014–2018" }],
  },
  "cand-devonp": {
    id: "cand-devonp",
    displayName: "Devon Park",
    identityStatus: "confirmed",
    contact: { email: "devon.park.demo@example.com", phone: "+1 (512) 555-0177", location: { value: "Austin, TX, US", status: "known" } },
    workAuth: { value: "US Citizen", status: "known" },
    tags: ["Product", "Growth"],
    owner: "emma",
    createdAt: daysAgo(4),
    lastMatchedAt: daysAgo(2),
    retention: "standard-24mo",
    libraryStatus: "available",
    compensationExpectation: { min: 155000, max: 180000, currency: "USD", period: "year", basis: "gross", status: "known" },
    missingFields: [],
    employment: [{ company: "Fernhill Consumer", title: "Product Manager, Growth", start: "2021-06", end: "Present", achievements: ["Ran 60+ A/B tests, shipping a 14% lift in activation", "Owns onboarding and referral experiments"] }],
    skills: ["A/B Testing", "SQL", "Product Strategy", "Amplitude"],
    education: [{ statement: "B.A. Economics, University of Texas at Austin", period: "2013–2017" }],
  },
  "cand-avag": {
    id: "cand-avag",
    displayName: "Ava Guzman",
    identityStatus: "confirmed",
    contact: { email: "ava.guzman.demo@example.com", phone: "+1 (773) 555-0161", location: { value: "Chicago, IL, US", status: "known" } },
    workAuth: { value: "US Citizen", status: "known" },
    tags: ["Product", "B2B SaaS"],
    owner: "daniel",
    createdAt: daysAgo(6),
    lastMatchedAt: daysAgo(3),
    retention: "standard-24mo",
    libraryStatus: "available",
    compensationExpectation: { min: 160000, max: 190000, currency: "USD", period: "year", basis: "gross", status: "known" },
    missingFields: [],
    employment: [{ company: "Vantage Works", title: "Senior Product Manager", start: "2019-09", end: "Present", achievements: ["Led the self-serve onboarding redesign, cutting time-to-value in half"] }],
    skills: ["Roadmapping", "SQL", "User Research", "Growth Loops"],
    education: [{ statement: "B.S. Business Administration, University of Illinois", period: "2014–2018" }],
  },
  "cand-leom": {
    id: "cand-leom",
    displayName: "Leo Martins",
    identityStatus: "confirmed",
    contact: { email: "leo.martins.demo@example.com", phone: "+1 (305) 555-0148", location: { value: "Miami, FL, US", status: "known" } },
    workAuth: { value: "US Citizen", status: "known" },
    tags: ["Customer Success", "Account Management"],
    owner: "emma",
    createdAt: daysAgo(3),
    lastMatchedAt: daysAgo(3),
    retention: "standard-24mo",
    libraryStatus: "available",
    compensationExpectation: { min: 100000, max: 118000, currency: "USD", period: "year", basis: "gross", status: "known" },
    missingFields: [],
    employment: [{ company: "Palmtree SaaS", title: "Customer Success Manager", start: "2020-01", end: "Present", achievements: ["Owns a $4M enterprise book with 96% gross renewal"] }],
    skills: ["Account Management", "Salesforce", "Renewals", "Onboarding"],
    education: [{ statement: "B.A. Communications, University of Miami", period: "2015–2019" }],
  },
  "cand-quinnf": {
    id: "cand-quinnf",
    displayName: "Quinn Foster",
    identityStatus: "confirmed",
    contact: { email: "quinn.foster.demo@example.com", phone: "+1 (213) 555-0139", location: { value: "Los Angeles, CA, US", status: "known" } },
    workAuth: { value: "US Citizen", status: "known" },
    tags: ["Design", "UX Research"],
    owner: "emma",
    createdAt: daysAgo(60),
    lastMatchedAt: daysAgo(60),
    retention: "standard-24mo",
    libraryStatus: "available",
    compensationExpectation: { min: 135000, max: 155000, currency: "USD", period: "year", basis: "gross", status: "known" },
    missingFields: [],
    employment: [{ company: "Studio Meridian", title: "Senior Product Designer", start: "2019-02", end: "Present", achievements: ["Led end-to-end research and design for the mobile checkout redesign"] }],
    skills: ["Figma", "User Research", "Prototyping"],
    education: [{ statement: "B.F.A. Design, Art Center College of Design", period: "2014–2018" }],
  },
  "cand-harpers": {
    id: "cand-harpers",
    displayName: "Harper Singh",
    identityStatus: "confirmed",
    contact: { email: "harper.singh.demo@example.com", phone: "+1 (617) 555-0193", location: { value: "Boston, MA, US", status: "known" } },
    workAuth: { value: "US Citizen", status: "known" },
    tags: ["Sales"],
    owner: "daniel",
    createdAt: hoursAgo(3),
    lastMatchedAt: null,
    retention: "standard-24mo",
    libraryStatus: "available",
    compensationExpectation: null,
    missingFields: ["compensation_expectation"],
    employment: [{ company: "Beacon Software", title: "Sales Development Representative", start: "2022-07", end: "Present", achievements: ["Ranked #2 SDR company-wide for pipeline generated, 3 consecutive quarters"] }],
    skills: ["Outbound Prospecting", "Salesforce", "Cold Outreach"],
    education: [{ statement: "B.A. Communications, Boston University", period: "2018–2022" }],
  },
  "cand-noahb": {
    id: "cand-noahb",
    displayName: "Noah Bennett",
    identityStatus: "confirmed",
    contact: { email: "noah.bennett.demo@example.com", phone: "+1 (614) 555-0171", location: { value: "Remote (US)", status: "known" } },
    workAuth: { value: "US Citizen", status: "known" },
    tags: ["Backend", "Java"],
    owner: "emma",
    createdAt: daysAgo(20),
    lastMatchedAt: daysAgo(20),
    retention: "standard-24mo",
    libraryStatus: "available",
    compensationExpectation: { min: 145000, max: 170000, currency: "USD", period: "year", basis: "gross", status: "known" },
    missingFields: [],
    employment: [{ company: "Cascade Systems", title: "Backend Engineer", start: "2020-03", end: "Present", achievements: ["Maintains billing services processing $2M/month in transactions"] }],
    skills: ["Java", "Spring Boot", "PostgreSQL", "AWS"],
    education: [{ statement: "B.S. Computer Science, Ohio State University", period: "2015–2019" }],
  },
};
