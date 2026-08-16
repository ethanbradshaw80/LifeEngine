/**
 * THE REST OF THE OWNER'S LADDERS, PART ONE: the desk trades.
 *
 * Technology, finance, management and transport, transcribed from
 * `JOBS_CAREERS.md`. Where his document gives a full per-rung table those are
 * his figures exactly; where it gives only an entry wage, a ceiling and a
 * timeline — the "NEW CAREER PATHS" section — the middle rungs are
 * interpolated between the two ends he named, and those are marked.
 *
 * Split out of `pathcontent.ts` because that file already carried fifteen
 * ladders and sixty more in one place is a file nobody can read.
 *
 * Era windows are mine, not his: his document has no years in it, and a
 * DevOps engineer in 1970 is the same anachronism the business module
 * already taught this codebase to avoid.
 */

import { fromSpecSalary } from './paths.js'
import type { CareerPath } from './paths.js'

const gate = (skill: string, level: number) => ({ skill: skill as never, level })
const teach = (skill: string, perMonth: number) => ({ skill: skill as never, perMonth })

export const DESK_TRADES: readonly CareerPath[] = [
  // ---- TECHNOLOGY ---------------------------------------------------------
  {
    id: 'qa-engineer',
    name: 'Quality Assurance',
    categoryId: 'technology',
    blurb: 'Finding it before the customer does.',
    requires: 'secondary',
    availableFrom: 1982,
    levels: [
      { id: 'qa-associate', title: 'QA associate', level: 1, monthlyPay: fromSpecSalary(45_000), monthsRequired: 0, needs: [], teaches: [teach('attention-to-detail', 900)], stress: 0, happiness: 0, blurb: 'Break it on purpose, then write down how.' },
      { id: 'qa-engineer', title: 'QA engineer', level: 2, monthlyPay: fromSpecSalary(65_000), monthsRequired: 18, needs: [gate('attention-to-detail', 4), gate('problem-solving', 3)], needsLevel: 'college', teaches: [teach('problem-solving', 700), teach('programming', 600)], stress: 0, happiness: 1, blurb: 'The suite is yours, and so is what it misses.' },
      { id: 'qa-lead', title: 'QA lead', level: 3, monthlyPay: fromSpecSalary(95_000), monthsRequired: 42, needs: [gate('leadership', 3), gate('problem-solving', 4)], needsLevel: 'college', teaches: [teach('leadership', 600)], stress: 1, happiness: 1, blurb: 'What ships, and what waits a week.' },
      { id: 'qa-director', title: 'QA director', level: 4, monthlyPay: fromSpecSalary(140_000), monthsRequired: 66, needs: [gate('leadership', 5), gate('business-management', 4)], needsLevel: 'college', teaches: [teach('business-management', 600)], stress: 2, happiness: 1, blurb: 'Quality as a department with a budget.' },
    ],
  },
  {
    id: 'support-technician',
    name: 'Technical Support',
    categoryId: 'technology',
    blurb: 'The voice on the other end when it has stopped working.',
    requires: 'secondary',
    availableFrom: 1982,
    levels: [
      { id: 'support-technician', title: 'support technician', level: 1, monthlyPay: fromSpecSalary(35_000), monthsRequired: 0, needs: [], teaches: [teach('customer-service', 800), teach('technical-knowledge', 600)], stress: 0, happiness: -1, blurb: 'Forty calls a day, most of them cross.' },
      { id: 'senior-support-tech', title: 'senior support technician', level: 2, monthlyPay: fromSpecSalary(50_000), monthsRequired: 20, needs: [gate('customer-service', 4), gate('technical-knowledge', 4)], teaches: [teach('technical-knowledge', 700), teach('leadership', 300)], stress: 0, happiness: 0, blurb: 'The ones nobody else could fix.' },
      { id: 'support-manager', title: 'support manager', level: 3, monthlyPay: fromSpecSalary(75_000), monthsRequired: 44, needs: [gate('leadership', 4), gate('business-management', 3)], teaches: [teach('leadership', 600), teach('business-management', 500)], stress: 1, happiness: 1, blurb: 'The queue, and the people working it.' },
      { id: 'support-director', title: 'support director', level: 4, monthlyPay: fromSpecSalary(125_000), monthsRequired: 68, needs: [gate('leadership', 5), gate('business-management', 5)], teaches: [teach('business-management', 600)], stress: 2, happiness: 1, blurb: 'Every customer who ever rings, as a system.' },
    ],
  },
  {
    id: 'devops-engineer',
    name: 'DevOps & Infrastructure',
    categoryId: 'technology',
    blurb: 'Keeping the lights on for everybody else.',
    requires: 'college',
    availableFrom: 1995,
    levels: [
      { id: 'junior-devops', title: 'junior DevOps engineer', level: 1, monthlyPay: fromSpecSalary(70_000), monthsRequired: 0, needs: [], teaches: [teach('technical-knowledge', 1000), teach('problem-solving', 700)], stress: 0, happiness: 1, blurb: 'The pager, and learning what it means.' },
      { id: 'senior-devops', title: 'senior DevOps engineer', level: 2, monthlyPay: fromSpecSalary(105_000), monthsRequired: 28, needs: [gate('technical-knowledge', 5), gate('programming', 4)], teaches: [teach('problem-solving', 800), teach('programming', 500)], stress: 1, happiness: 2, blurb: 'You built the thing the pager watches.' },
      { id: 'devops-lead', title: 'DevOps lead', level: 3, monthlyPay: fromSpecSalary(140_000), monthsRequired: 52, needs: [gate('leadership', 4), gate('strategic-planning', 3)], teaches: [teach('leadership', 600), teach('strategic-planning', 500)], stress: 1, happiness: 2, blurb: 'How the whole of it is put together.' },
      { id: 'infrastructure-manager-devops', title: 'infrastructure manager', level: 4, monthlyPay: fromSpecSalary(180_000), monthsRequired: 76, needs: [gate('leadership', 5), gate('business-management', 4)], teaches: [teach('business-management', 500)], stress: 2, happiness: 2, blurb: 'The whole estate, and the bill for it.' },
    ],
  },
  {
    id: 'network-admin',
    name: 'Network Administration',
    categoryId: 'technology',
    blurb: 'The wires, and everything that runs over them.',
    requires: 'secondary',
    availableFrom: 1985,
    levels: [
      { id: 'network-technician', title: 'network technician', level: 1, monthlyPay: fromSpecSalary(42_000), monthsRequired: 0, needs: [], teaches: [teach('technical-knowledge', 900), teach('problem-solving', 600)], stress: 0, happiness: 0, blurb: 'Patch panels and long afternoons.' },
      { id: 'network-administrator', title: 'network administrator', level: 2, monthlyPay: fromSpecSalary(62_000), monthsRequired: 20, needs: [gate('technical-knowledge', 4), gate('problem-solving', 3)], teaches: [teach('technical-knowledge', 700), teach('leadership', 300)], stress: 0, happiness: 1, blurb: 'When it is slow, they come to you.' },
      { id: 'senior-network-admin', title: 'senior network administrator', level: 3, monthlyPay: fromSpecSalary(95_000), monthsRequired: 44, needs: [gate('technical-knowledge', 5), gate('leadership', 3)], needsLevel: 'college', teaches: [teach('leadership', 600)], stress: 1, happiness: 1, blurb: 'The design, not just the repair.' },
      { id: 'network-manager', title: 'network manager', level: 4, monthlyPay: fromSpecSalary(160_000), monthsRequired: 68, needs: [gate('leadership', 5), gate('business-management', 4), gate('strategic-planning', 3)], needsLevel: 'college', teaches: [teach('business-management', 500)], stress: 2, happiness: 1, blurb: 'Everything that carries a signal.' },
    ],
  },
  {
    id: 'cybersecurity',
    name: 'Cybersecurity',
    categoryId: 'technology',
    blurb: 'Assuming somebody is already inside.',
    requires: 'college',
    availableFrom: 1995,
    levels: [
      { id: 'security-analyst', title: 'security analyst', level: 1, monthlyPay: fromSpecSalary(60_000), monthsRequired: 0, needs: [], teaches: [teach('technical-knowledge', 1000), teach('problem-solving', 900)], stress: 1, happiness: 0, blurb: 'Reading logs until something looks wrong.' },
      { id: 'senior-security-analyst', title: 'senior security analyst', level: 2, monthlyPay: fromSpecSalary(85_000), monthsRequired: 22, needs: [gate('technical-knowledge', 5), gate('problem-solving', 4)], teaches: [teach('problem-solving', 600), teach('leadership', 400)], stress: 1, happiness: 1, blurb: 'You find them before they finish.' },
      { id: 'security-manager', title: 'security manager', level: 3, monthlyPay: fromSpecSalary(135_000), monthsRequired: 46, needs: [gate('leadership', 4), gate('strategic-planning', 3)], teaches: [teach('leadership', 600), teach('strategic-planning', 500)], stress: 2, happiness: 1, blurb: 'The policy, and whether anybody follows it.' },
      { id: 'ciso', title: 'chief information security officer', level: 4, monthlyPay: fromSpecSalary(200_000), monthsRequired: 70, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 5)], teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'The breach is yours whether you caused it or not.' },
    ],
  },
  {
    id: 'data-scientist',
    name: 'Data Science & Analytics',
    categoryId: 'technology',
    blurb: 'Finding what the numbers are actually saying.',
    requires: 'college',
    availableFrom: 1996,
    levels: [
      { id: 'junior-data-analyst', title: 'junior data analyst', level: 1, monthlyPay: fromSpecSalary(58_000), monthsRequired: 0, needs: [], teaches: [teach('data-analysis', 1000), teach('programming', 700)], stress: 0, happiness: 1, blurb: 'Somebody else’s question, in a spreadsheet.' },
      { id: 'data-scientist', title: 'data scientist', level: 2, monthlyPay: fromSpecSalary(85_000), monthsRequired: 24, needs: [gate('programming', 4), gate('data-analysis', 4)], teaches: [teach('problem-solving', 1000), teach('data-analysis', 600)], stress: 0, happiness: 2, blurb: 'Your questions now, and your models.' },
      { id: 'senior-data-scientist', title: 'senior data scientist', level: 3, monthlyPay: fromSpecSalary(135_000), monthsRequired: 48, needs: [gate('problem-solving', 5), gate('leadership', 3), gate('strategic-planning', 3)], teaches: [teach('leadership', 600), teach('strategic-planning', 600)], stress: 1, happiness: 2, blurb: 'What the company should be measuring at all.' },
      { id: 'data-director', title: 'data director', level: 4, monthlyPay: fromSpecSalary(220_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 5)], teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'Every number the company trusts.' },
    ],
  },
  {
    id: 'product-manager',
    name: 'Product Management',
    categoryId: 'technology',
    // INTERPOLATED: his expansion section gives an entry, a ceiling and a
    // timeline rather than a per-rung table.
    blurb: 'Deciding what gets built, and defending it.',
    requires: 'college',
    availableFrom: 1996,
    levels: [
      { id: 'associate-pm', title: 'associate product manager', level: 1, monthlyPay: fromSpecSalary(70_000), monthsRequired: 0, needs: [], teaches: [teach('communication', 900), teach('business-management', 600)], stress: 1, happiness: 1, blurb: 'Notes, tickets and everybody else’s opinions.' },
      { id: 'product-manager', title: 'product manager', level: 2, monthlyPay: fromSpecSalary(110_000), monthsRequired: 24, needs: [gate('communication', 3), gate('business-management', 3)], teaches: [teach('leadership', 600), teach('strategic-planning', 600)], stress: 1, happiness: 2, blurb: 'The roadmap is yours to be wrong about.' },
      { id: 'senior-pm', title: 'senior product manager', level: 3, monthlyPay: fromSpecSalary(160_000), monthsRequired: 48, needs: [gate('leadership', 4), gate('strategic-planning', 4)], teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'A line of products, and the people on them.' },
      { id: 'vp-product', title: 'vice president of product', level: 4, monthlyPay: fromSpecSalary(240_000), monthsRequired: 84, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 5)], teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'What the company is for.' },
    ],
  },
  {
    id: 'solutions-architect',
    name: 'Solutions Architecture',
    categoryId: 'technology',
    // INTERPOLATED, and deliberately a high barrier: his note says Bachelor
    // CS plus Technical Knowledge 4 before anybody will look at you.
    blurb: 'Drawing the shape of it before anybody builds.',
    requires: 'college',
    availableFrom: 1996,
    levels: [
      { id: 'solutions-architect', title: 'solutions architect', level: 1, monthlyPay: fromSpecSalary(95_000), monthsRequired: 0, needs: [], teaches: [teach('technical-knowledge', 800), teach('communication', 700)], stress: 1, happiness: 1, blurb: 'The diagram everybody argues about.' },
      { id: 'senior-architect', title: 'senior architect', level: 2, monthlyPay: fromSpecSalary(140_000), monthsRequired: 24, needs: [gate('technical-knowledge', 4), gate('communication', 3)], teaches: [teach('strategic-planning', 700), teach('leadership', 500)], stress: 1, happiness: 2, blurb: 'The decisions that are expensive to undo.' },
      { id: 'enterprise-architect', title: 'enterprise architect', level: 3, monthlyPay: fromSpecSalary(190_000), monthsRequired: 48, needs: [gate('technical-knowledge', 5), gate('strategic-planning', 4)], teaches: [teach('strategic-planning', 600), teach('business-management', 500)], stress: 2, happiness: 2, blurb: 'Every system, and how they will fit in five years.' },
      { id: 'vp-architecture', title: 'vice president of architecture', level: 4, monthlyPay: fromSpecSalary(240_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 5)], teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'The whole technical shape of the company.' },
    ],
  },
  {
    id: 'technical-writer',
    name: 'Technical Writing',
    categoryId: 'technology',
    blurb: 'Explaining the thing to the people who have to use it.',
    requires: 'college',
    availableFrom: 1985,
    levels: [
      { id: 'junior-technical-writer', title: 'junior technical writer', level: 1, monthlyPay: fromSpecSalary(50_000), monthsRequired: 0, needs: [], teaches: [teach('communication', 900), teach('technical-knowledge', 600)], stress: 0, happiness: 1, blurb: 'The manual nobody read, written properly.' },
      { id: 'technical-writer', title: 'technical writer', level: 2, monthlyPay: fromSpecSalary(72_000), monthsRequired: 24, needs: [gate('communication', 3), gate('technical-knowledge', 2)], teaches: [teach('communication', 700), teach('attention-to-detail', 600)], stress: 0, happiness: 1, blurb: 'You are the reason anybody understands it.' },
      { id: 'senior-technical-writer', title: 'senior technical writer', level: 3, monthlyPay: fromSpecSalary(98_000), monthsRequired: 48, needs: [gate('communication', 4), gate('attention-to-detail', 4)], teaches: [teach('leadership', 500), teach('strategic-planning', 400)], stress: 1, happiness: 2, blurb: 'How the whole library is organised.' },
      { id: 'documentation-director', title: 'documentation director', level: 4, monthlyPay: fromSpecSalary(125_000), monthsRequired: 72, needs: [gate('leadership', 4), gate('business-management', 3)], teaches: [teach('business-management', 500)], stress: 2, happiness: 2, blurb: 'Everything the company has ever written down.' },
    ],
  },
  {
    id: 'site-reliability-engineer',
    name: 'Site Reliability Engineering',
    categoryId: 'technology',
    blurb: 'The thing that must not fall over.',
    requires: 'college',
    availableFrom: 2000,
    levels: [
      { id: 'junior-sre', title: 'junior SRE', level: 1, monthlyPay: fromSpecSalary(75_000), monthsRequired: 0, needs: [], teaches: [teach('technical-knowledge', 1000), teach('problem-solving', 800)], stress: 1, happiness: 1, blurb: 'Three in the morning, and it is down.' },
      { id: 'sre-engineer', title: 'SRE engineer', level: 2, monthlyPay: fromSpecSalary(115_000), monthsRequired: 24, needs: [gate('technical-knowledge', 4), gate('problem-solving', 3)], teaches: [teach('programming', 700), teach('problem-solving', 600)], stress: 1, happiness: 2, blurb: 'You automated the thing that woke you.' },
      { id: 'senior-sre', title: 'senior SRE', level: 3, monthlyPay: fromSpecSalary(165_000), monthsRequired: 48, needs: [gate('technical-knowledge', 5), gate('problem-solving', 4)], teaches: [teach('leadership', 600), teach('strategic-planning', 500)], stress: 2, happiness: 2, blurb: 'The budget of failure, spent deliberately.' },
      { id: 'sre-manager', title: 'SRE manager', level: 4, monthlyPay: fromSpecSalary(210_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 4)], teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'Uptime, as a promise somebody signed.' },
    ],
  },
  {
    id: 'game-developer',
    name: 'Game Development',
    categoryId: 'creative',
    blurb: 'Making the thing you wanted to play.',
    requires: 'college',
    availableFrom: 1985,
    levels: [
      { id: 'junior-game-developer', title: 'junior game developer', level: 1, monthlyPay: fromSpecSalary(60_000), monthsRequired: 0, needs: [], teaches: [teach('programming', 1000), teach('creativity', 800)], stress: 1, happiness: 2, blurb: 'Long hours on somebody else’s idea.' },
      { id: 'game-developer', title: 'game developer', level: 2, monthlyPay: fromSpecSalary(95_000), monthsRequired: 24, needs: [gate('programming', 3), gate('creativity', 3)], teaches: [teach('problem-solving', 800), teach('creativity', 600)], stress: 1, happiness: 2, blurb: 'A system of the game is yours.' },
      { id: 'technical-director-games', title: 'technical director', level: 3, monthlyPay: fromSpecSalary(155_000), monthsRequired: 50, needs: [gate('programming', 5), gate('leadership', 4)], teaches: [teach('leadership', 600), teach('strategic-planning', 500)], stress: 2, happiness: 2, blurb: 'How it is built, and whether it can ship.' },
      { id: 'studio-director', title: 'studio director', level: 4, monthlyPay: fromSpecSalary(240_000), monthsRequired: 78, needs: [gate('leadership', 5), gate('business-management', 5)], teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'The studio, the slate, and the payroll.' },
    ],
  },
  // ---- FINANCE & BUSINESS -------------------------------------------------
  {
    id: 'business-analyst',
    name: 'Business Analysis',
    categoryId: 'finance-business',
    blurb: 'Working out what the business actually does.',
    requires: 'college',
    levels: [
      { id: 'junior-analyst', title: 'junior analyst', level: 1, monthlyPay: fromSpecSalary(48_000), monthsRequired: 0, needs: [], teaches: [teach('data-analysis', 900), teach('problem-solving', 700)], stress: 0, happiness: 1, blurb: 'Requirements, and the meetings that produce them.' },
      { id: 'analyst', title: 'analyst', level: 2, monthlyPay: fromSpecSalary(68_000), monthsRequired: 22, needs: [gate('data-analysis', 4), gate('problem-solving', 4)], teaches: [teach('problem-solving', 800), teach('leadership', 300)], stress: 0, happiness: 1, blurb: 'They ask you before they decide.' },
      { id: 'senior-analyst', title: 'senior analyst', level: 3, monthlyPay: fromSpecSalary(98_000), monthsRequired: 46, needs: [gate('problem-solving', 5), gate('leadership', 3), gate('strategic-planning', 2)], teaches: [teach('leadership', 500), teach('strategic-planning', 600)], stress: 1, happiness: 2, blurb: 'The awkward questions are yours to ask.' },
      { id: 'analysis-manager', title: 'analysis manager', level: 4, monthlyPay: fromSpecSalary(145_000), monthsRequired: 70, needs: [gate('leadership', 5), gate('business-management', 4), gate('strategic-planning', 4)], teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'A team of them, and what they are pointed at.' },
    ],
  },
  {
    id: 'consultant',
    name: 'Management Consulting',
    categoryId: 'finance-business',
    blurb: 'Somebody else’s problem, at an hourly rate.',
    requires: 'college',
    levels: [
      { id: 'junior-consultant', title: 'junior consultant', level: 1, monthlyPay: fromSpecSalary(60_000), monthsRequired: 0, needs: [], teaches: [teach('problem-solving', 900), teach('communication', 700)], stress: 1, happiness: 1, blurb: 'Slides, aeroplanes and other people’s offices.' },
      { id: 'consultant', title: 'consultant', level: 2, monthlyPay: fromSpecSalary(90_000), monthsRequired: 26, needs: [gate('problem-solving', 4), gate('communication', 4), gate('leadership', 2)], teaches: [teach('communication', 800), teach('leadership', 500)], stress: 1, happiness: 1, blurb: 'You run the room now.' },
      { id: 'senior-consultant', title: 'senior consultant', level: 3, monthlyPay: fromSpecSalary(135_000), monthsRequired: 50, needs: [gate('leadership', 4), gate('strategic-planning', 4)], needsLevel: 'graduate', teaches: [teach('strategic-planning', 700), teach('negotiation', 400)], stress: 2, happiness: 2, blurb: 'The client asks for you by name.' },
      { id: 'consulting-director', title: 'director of consulting', level: 4, monthlyPay: fromSpecSalary(200_000), monthsRequired: 74, needs: [gate('leadership', 5), gate('business-management', 5)], needsLevel: 'graduate', teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'Selling the work, then finding somebody to do it.' },
    ],
  },
  {
    id: 'real-estate',
    name: 'Real Estate',
    categoryId: 'finance-business',
    blurb: 'Other people’s houses, and a percentage.',
    requires: 'secondary',
    levels: [
      { id: 'real-estate-agent', title: 'estate agent', level: 1, monthlyPay: fromSpecSalary(30_000), monthsRequired: 0, needs: [], needsLicence: 'real-estate', teaches: [teach('sales', 800), teach('communication', 600)], stress: 0, happiness: 0, blurb: 'Weekends, viewings, and a car full of signs.' },
      { id: 'senior-agent', title: 'senior agent', level: 2, monthlyPay: fromSpecSalary(65_000), monthsRequired: 22, needs: [gate('sales', 4), gate('communication', 4)], needsLicence: 'real-estate', teaches: [teach('negotiation', 600), teach('leadership', 400)], stress: 1, happiness: 1, blurb: 'The listings come to you.' },
      { id: 'broker-manager', title: 'broker manager', level: 3, monthlyPay: fromSpecSalary(120_000), monthsRequired: 46, needs: [gate('leadership', 4), gate('business-management', 4)], needsLicence: 'real-estate', teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'A floor of agents, all on commission.' },
      { id: 'managing-broker', title: 'managing broker', level: 4, monthlyPay: fromSpecSalary(165_000), monthsRequired: 70, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 3)], needsLicence: 'real-estate', teaches: [teach('strategic-planning', 500)], stress: 2, happiness: 2, blurb: 'The name on the boards is yours.' },
    ],
  },
  {
    id: 'insurance-agent',
    name: 'Insurance & Risk',
    categoryId: 'finance-business',
    blurb: 'Selling the thing nobody wants until they need it.',
    requires: 'secondary',
    levels: [
      { id: 'insurance-agent', title: 'insurance agent', level: 1, monthlyPay: fromSpecSalary(32_000), monthsRequired: 0, needs: [], needsLicence: 'insurance', teaches: [teach('sales', 700), teach('communication', 600)], stress: 0, happiness: 0, blurb: 'Cold calls and kitchen tables.' },
      { id: 'senior-insurance-agent', title: 'senior agent', level: 2, monthlyPay: fromSpecSalary(62_000), monthsRequired: 20, needs: [gate('sales', 4), gate('communication', 4)], needsLicence: 'insurance', teaches: [teach('leadership', 500), teach('business-management', 400)], stress: 1, happiness: 1, blurb: 'A book of business that renews itself.' },
      { id: 'agency-manager', title: 'agency manager', level: 3, monthlyPay: fromSpecSalary(110_000), monthsRequired: 44, needs: [gate('leadership', 4), gate('business-management', 3)], needsLicence: 'insurance', teaches: [teach('business-management', 600), teach('strategic-planning', 400)], stress: 2, happiness: 1, blurb: 'The office, and everybody’s numbers in it.' },
      { id: 'insurance-regional-manager', title: 'regional manager', level: 4, monthlyPay: fromSpecSalary(155_000), monthsRequired: 68, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 3)], teaches: [teach('strategic-planning', 500)], stress: 2, happiness: 2, blurb: 'Every office in the region reports to you.' },
    ],
  },
  {
    id: 'account-executive',
    name: 'Enterprise Sales',
    categoryId: 'finance-business',
    blurb: 'The number, every quarter, for ever.',
    requires: 'secondary',
    levels: [
      { id: 'sales-development-rep', title: 'sales development rep', level: 1, monthlyPay: fromSpecSalary(38_000), monthsRequired: 0, needs: [], teaches: [teach('sales', 1000), teach('communication', 700)], stress: 0, happiness: 0, blurb: 'A hundred calls, two conversations.' },
      { id: 'account-executive', title: 'account executive', level: 2, monthlyPay: fromSpecSalary(75_000), monthsRequired: 22, needs: [gate('sales', 4), gate('communication', 4)], needsLevel: 'college', teaches: [teach('sales', 600), teach('negotiation', 600)], stress: 1, happiness: 1, blurb: 'Your own accounts, and your own quota.' },
      { id: 'senior-ae', title: 'senior account executive', level: 3, monthlyPay: fromSpecSalary(125_000), monthsRequired: 46, needs: [gate('sales', 5), gate('leadership', 3), gate('negotiation', 3)], needsLevel: 'college', teaches: [teach('leadership', 600)], stress: 2, happiness: 2, blurb: 'The deals that make the year.' },
      { id: 'sales-manager-ae', title: 'sales manager', level: 4, monthlyPay: fromSpecSalary(160_000), monthsRequired: 70, needs: [gate('leadership', 5), gate('business-management', 4)], needsLevel: 'college', teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'Their numbers are your number now.' },
    ],
  },
  {
    id: 'financial-analyst',
    name: 'Financial Analysis',
    categoryId: 'finance-business',
    blurb: 'What the money is going to do next.',
    requires: 'college',
    levels: [
      { id: 'financial-analyst', title: 'financial analyst', level: 1, monthlyPay: fromSpecSalary(55_000), monthsRequired: 0, needs: [], teaches: [teach('data-analysis', 900), teach('accounting', 600)], stress: 0, happiness: 1, blurb: 'Models, and the assumptions under them.' },
      { id: 'senior-financial-analyst', title: 'senior financial analyst', level: 2, monthlyPay: fromSpecSalary(85_000), monthsRequired: 24, needs: [gate('data-analysis', 4), gate('problem-solving', 3)], teaches: [teach('problem-solving', 700), teach('business-management', 500)], stress: 1, happiness: 1, blurb: 'The forecast has your name on it.' },
      { id: 'finance-manager', title: 'finance manager', level: 3, monthlyPay: fromSpecSalary(120_000), monthsRequired: 48, needs: [gate('leadership', 4), gate('business-management', 4)], teaches: [teach('leadership', 600), teach('strategic-planning', 500)], stress: 2, happiness: 1, blurb: 'Where the money goes, and who asks for it.' },
      { id: 'finance-director', title: 'finance director', level: 4, monthlyPay: fromSpecSalary(155_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('strategic-planning', 4)], teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'The plan the whole company is costed against.' },
    ],
  },
  {
    id: 'procurement-specialist',
    name: 'Procurement & Supply Chain',
    categoryId: 'finance-business',
    blurb: 'Buying it cheaper than the last person did.',
    requires: 'secondary',
    levels: [
      { id: 'procurement-specialist', title: 'procurement specialist', level: 1, monthlyPay: fromSpecSalary(48_000), monthsRequired: 0, needs: [], teaches: [teach('negotiation', 900), teach('organization', 700)], stress: 0, happiness: 0, blurb: 'Quotes, terms, and chasing the late ones.' },
      { id: 'senior-procurement', title: 'senior specialist', level: 2, monthlyPay: fromSpecSalary(72_000), monthsRequired: 24, needs: [gate('negotiation', 3), gate('organization', 3)], teaches: [teach('negotiation', 700), teach('business-management', 500)], stress: 1, happiness: 1, blurb: 'The contracts that matter are yours.' },
      { id: 'procurement-manager', title: 'procurement manager', level: 3, monthlyPay: fromSpecSalary(110_000), monthsRequired: 48, needs: [gate('leadership', 4), gate('business-management', 3)], teaches: [teach('leadership', 600), teach('strategic-planning', 500)], stress: 2, happiness: 1, blurb: 'Everything the company buys.' },
      { id: 'vp-supply-chain', title: 'vice president of supply chain', level: 4, monthlyPay: fromSpecSalary(175_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 4)], teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'The whole chain, and what happens when it breaks.' },
    ],
  },
  {
    id: 'venture-capital',
    name: 'Venture Capital',
    categoryId: 'finance-business',
    blurb: 'Being wrong nine times and right once.',
    requires: 'college',
    availableFrom: 1980,
    levels: [
      { id: 'investment-analyst', title: 'investment analyst', level: 1, monthlyPay: fromSpecSalary(65_000), monthsRequired: 0, needs: [], teaches: [teach('data-analysis', 800), teach('problem-solving', 800)], stress: 1, happiness: 1, blurb: 'Reading pitches nobody else wanted to read.' },
      { id: 'vc-associate', title: 'associate', level: 2, monthlyPay: fromSpecSalary(110_000), monthsRequired: 24, needs: [gate('problem-solving', 3), gate('data-analysis', 3)], teaches: [teach('negotiation', 600), teach('leadership', 500)], stress: 1, happiness: 2, blurb: 'You bring them in; somebody else says yes.' },
      { id: 'vc-principal', title: 'principal', level: 3, monthlyPay: fromSpecSalary(180_000), monthsRequired: 48, needs: [gate('leadership', 4), gate('business-management', 4)], needsLevel: 'graduate', teaches: [teach('business-management', 600), teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'Your name on the deals, and on the failures.' },
      { id: 'vc-partner', title: 'partner', level: 4, monthlyPay: fromSpecSalary(300_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 5)], needsLevel: 'graduate', teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'The fund is partly yours, and so is the fault.' },
    ],
  },
  // ---- MANAGEMENT ---------------------------------------------------------
  {
    id: 'operations',
    name: 'Operations & Process',
    categoryId: 'management',
    blurb: 'Making the machine of it run.',
    requires: 'secondary',
    levels: [
      { id: 'operations-coordinator', title: 'operations coordinator', level: 1, monthlyPay: fromSpecSalary(40_000), monthsRequired: 0, needs: [], teaches: [teach('organization', 900), teach('communication', 600)], stress: 0, happiness: 0, blurb: 'Rotas, orders, and the thing nobody else chased.' },
      { id: 'operations-manager', title: 'operations manager', level: 2, monthlyPay: fromSpecSalary(65_000), monthsRequired: 24, needs: [gate('organization', 3), gate('communication', 2)], needsLevel: 'college', teaches: [teach('leadership', 600), teach('business-management', 600)], stress: 1, happiness: 1, blurb: 'The floor runs the way you set it up.' },
      { id: 'operations-director', title: 'operations director', level: 3, monthlyPay: fromSpecSalary(105_000), monthsRequired: 48, needs: [gate('leadership', 4), gate('strategic-planning', 3)], needsLevel: 'college', teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 1, blurb: 'Every process, and the cost of each one.' },
      { id: 'chief-operating-officer', title: 'chief operating officer', level: 4, monthlyPay: fromSpecSalary(190_000), monthsRequired: 84, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 4)], needsLevel: 'college', teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'The company works, or it is your fault.' },
    ],
  },
  {
    id: 'project-management',
    name: 'Project & Programme Management',
    categoryId: 'management',
    blurb: 'Dates, and the people who miss them.',
    requires: 'college',
    levels: [
      { id: 'junior-project-manager', title: 'junior project manager', level: 1, monthlyPay: fromSpecSalary(55_000), monthsRequired: 0, needs: [], teaches: [teach('organization', 900), teach('communication', 600)], stress: 1, happiness: 1, blurb: 'The plan, and the meeting about the plan.' },
      { id: 'project-manager', title: 'project manager', level: 2, monthlyPay: fromSpecSalary(80_000), monthsRequired: 26, needs: [gate('organization', 4), gate('leadership', 3)], teaches: [teach('leadership', 600), teach('strategic-planning', 400)], stress: 1, happiness: 1, blurb: 'It lands on time or it lands on you.' },
      { id: 'senior-project-manager', title: 'senior project manager', level: 3, monthlyPay: fromSpecSalary(120_000), monthsRequired: 50, needs: [gate('leadership', 4), gate('strategic-planning', 3)], teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 1, blurb: 'The ones that cannot be allowed to slip.' },
      { id: 'programme-manager', title: 'programme manager', level: 4, monthlyPay: fromSpecSalary(160_000), monthsRequired: 74, needs: [gate('leadership', 5), gate('business-management', 4)], teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'A dozen projects that all depend on each other.' },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing & Advertising',
    categoryId: 'management',
    blurb: 'Making people want it.',
    requires: 'secondary',
    levels: [
      { id: 'marketing-coordinator', title: 'marketing coordinator', level: 1, monthlyPay: fromSpecSalary(40_000), monthsRequired: 0, needs: [], teaches: [teach('communication', 800), teach('creativity', 700)], stress: 0, happiness: 1, blurb: 'Copy, listings, and somebody else’s idea.' },
      { id: 'marketing-manager', title: 'marketing manager', level: 2, monthlyPay: fromSpecSalary(68_000), monthsRequired: 24, needs: [gate('communication', 4), gate('leadership', 3)], needsLevel: 'college', teaches: [teach('leadership', 600), teach('strategic-planning', 500)], stress: 1, happiness: 1, blurb: 'The campaign is yours to defend.' },
      { id: 'senior-marketing-manager', title: 'senior marketing manager', level: 3, monthlyPay: fromSpecSalary(105_000), monthsRequired: 48, needs: [gate('leadership', 4), gate('strategic-planning', 4)], needsLevel: 'college', teaches: [teach('strategic-planning', 600)], stress: 1, happiness: 2, blurb: 'What the company sounds like.' },
      { id: 'marketing-director', title: 'marketing director', level: 4, monthlyPay: fromSpecSalary(160_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 5)], needsLevel: 'college', teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'The whole voice of it, and the budget behind.' },
    ],
  },
  {
    id: 'sales',
    name: 'Sales & Business Development',
    categoryId: 'management',
    blurb: 'Asking for the order.',
    requires: 'secondary',
    levels: [
      { id: 'sales-associate', title: 'sales associate', level: 1, monthlyPay: fromSpecSalary(35_000), monthsRequired: 0, needs: [], teaches: [teach('sales', 900), teach('communication', 700)], stress: 0, happiness: 0, blurb: 'The floor, and whoever walks onto it.' },
      { id: 'sales-manager', title: 'sales manager', level: 2, monthlyPay: fromSpecSalary(70_000), monthsRequired: 26, needs: [gate('sales', 4), gate('leadership', 3)], needsLevel: 'college', teaches: [teach('leadership', 600), teach('negotiation', 500)], stress: 1, happiness: 1, blurb: 'A team, and their targets.' },
      { id: 'regional-sales-manager', title: 'regional sales manager', level: 3, monthlyPay: fromSpecSalary(115_000), monthsRequired: 50, needs: [gate('leadership', 4), gate('strategic-planning', 3)], needsLevel: 'college', teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'Several teams, several states.' },
      { id: 'vp-sales', title: 'vice president of sales', level: 4, monthlyPay: fromSpecSalary(185_000), monthsRequired: 74, needs: [gate('leadership', 5), gate('business-management', 5)], needsLevel: 'college', teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'The whole number, every quarter.' },
    ],
  },
  {
    id: 'entrepreneur',
    name: 'Entrepreneurship',
    categoryId: 'management',
    // His note: variable income tied to company success, highest risk. The
    // engine already has a real business module for that; this ladder is the
    // FOUNDER'S EMPLOYMENT, and the risk lives over there.
    blurb: 'Your own thing, and nobody to blame.',
    requires: 'secondary',
    levels: [
      { id: 'founder', title: 'founder', level: 1, monthlyPay: fromSpecSalary(40_000), monthsRequired: 0, needs: [], teaches: [teach('business-management', 900), teach('leadership', 700)], stress: 2, happiness: 1, blurb: 'Everything is yours, including the worry.' },
      { id: 'early-stage-ceo', title: 'early stage chief executive', level: 2, monthlyPay: fromSpecSalary(90_000), monthsRequired: 24, needs: [gate('leadership', 3), gate('business-management', 3)], teaches: [teach('strategic-planning', 700), teach('negotiation', 500)], stress: 2, happiness: 2, blurb: 'Payroll, and the people on it.' },
      { id: 'growth-stage-ceo', title: 'growth stage chief executive', level: 3, monthlyPay: fromSpecSalary(180_000), monthsRequired: 54, needs: [gate('leadership', 4), gate('strategic-planning', 4)], teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'It is bigger than the room you started in.' },
      { id: 'scale-stage-ceo', title: 'scale stage chief executive', level: 4, monthlyPay: fromSpecSalary(300_000), monthsRequired: 84, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 5)], teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'A company that would outlive you.' },
    ],
  },
  {
    id: 'franchise-owner',
    name: 'Franchise Ownership',
    categoryId: 'management',
    blurb: 'Somebody else’s brand, your own hours.',
    requires: 'secondary',
    levels: [
      { id: 'single-unit-owner', title: 'franchise owner', level: 1, monthlyPay: fromSpecSalary(65_000), monthsRequired: 0, needs: [], teaches: [teach('business-management', 900), teach('organization', 700)], stress: 2, happiness: 1, blurb: 'One unit, and every hour it is open.' },
      { id: 'multi-unit-owner', title: 'multi-unit owner', level: 2, monthlyPay: fromSpecSalary(120_000), monthsRequired: 24, needs: [gate('business-management', 3), gate('organization', 3)], teaches: [teach('leadership', 700), teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'Three of them, and managers you trust.' },
      { id: 'regional-franchisee', title: 'regional franchisee', level: 3, monthlyPay: fromSpecSalary(200_000), monthsRequired: 48, needs: [gate('leadership', 4), gate('business-management', 4)], teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'A territory, and the right to fill it.' },
      { id: 'master-franchisee', title: 'master franchisee', level: 4, monthlyPay: fromSpecSalary(350_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 4)], teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'You sell the franchise to other people now.' },
    ],
  },
  // ---- TRANSPORTATION -----------------------------------------------------
  {
    id: 'pilot',
    name: 'Aviation',
    categoryId: 'transportation',
    blurb: 'Hours in the air, and the ratings they buy.',
    requires: 'secondary',
    levels: [
      { id: 'flight-instructor', title: 'flight instructor', level: 1, monthlyPay: fromSpecSalary(50_000), monthsRequired: 0, needs: [], needsLicence: 'aviation', teaches: [teach('technical-knowledge', 900), teach('communication', 500)], stress: 0, happiness: 1, blurb: 'Building hours in somebody else’s aeroplane.' },
      { id: 'commercial-pilot', title: 'commercial pilot', level: 2, monthlyPay: fromSpecSalary(75_000), monthsRequired: 24, needs: [gate('technical-knowledge', 4), gate('communication', 3)], needsLicence: 'aviation', teaches: [teach('technical-knowledge', 600), teach('problem-solving', 700)], stress: 1, happiness: 2, blurb: 'The right-hand seat, and a schedule.' },
      { id: 'airline-captain', title: 'captain', level: 3, monthlyPay: fromSpecSalary(145_000), monthsRequired: 48, needs: [gate('technical-knowledge', 5), gate('leadership', 4)], needsLicence: 'aviation', teaches: [teach('leadership', 600)], stress: 2, happiness: 2, blurb: 'Four stripes, and everybody behind you.' },
      { id: 'chief-pilot', title: 'chief pilot', level: 4, monthlyPay: fromSpecSalary(185_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 4)], needsLicence: 'aviation', teaches: [teach('business-management', 500)], stress: 2, happiness: 2, blurb: 'Every crew on the roster.' },
    ],
  },
  {
    id: 'delivery-coordinator',
    name: 'Delivery & Routes',
    categoryId: 'transportation',
    blurb: 'The last mile, and everybody waiting on it.',
    requires: 'none',
    levels: [
      { id: 'delivery-driver', title: 'delivery driver', level: 1, monthlyPay: fromSpecSalary(26_000), monthsRequired: 0, needs: [], teaches: [teach('organization', 700), teach('physical-work', 500)], stress: 0, happiness: -1, blurb: 'Ninety drops and a tight van.' },
      { id: 'route-supervisor', title: 'route supervisor', level: 2, monthlyPay: fromSpecSalary(38_000), monthsRequired: 18, needs: [gate('leadership', 2), gate('organization', 3)], teaches: [teach('leadership', 500), teach('business-management', 400)], stress: 0, happiness: 0, blurb: 'The routes, and who drives them.' },
      { id: 'delivery-operations-coordinator', title: 'operations coordinator', level: 3, monthlyPay: fromSpecSalary(58_000), monthsRequired: 42, needs: [gate('leadership', 3), gate('business-management', 3)], needsLevel: 'college', teaches: [teach('business-management', 500), teach('strategic-planning', 400)], stress: 1, happiness: 1, blurb: 'A depot, and its numbers.' },
      { id: 'delivery-regional-manager', title: 'regional manager', level: 4, monthlyPay: fromSpecSalary(95_000), monthsRequired: 66, needs: [gate('leadership', 4), gate('strategic-planning', 3)], needsLevel: 'college', teaches: [teach('strategic-planning', 500)], stress: 2, happiness: 1, blurb: 'Every depot in the region.' },
    ],
  },
  {
    id: 'warehouse-logistics',
    name: 'Warehouse & Logistics',
    categoryId: 'retail-service',
    blurb: 'From the warehouse floor to operations leadership.',
    requires: 'none',
    levels: [
      { id: 'stock-associate', title: 'stock associate', level: 1, monthlyPay: fromSpecSalary(22_000), monthsRequired: 0, needs: [], teaches: [teach('physical-work', 500), teach('organization', 600)], stress: 0, happiness: -1, blurb: 'Pallets, and the trolley that squeaks.' },
      { id: 'warehouse-lead', title: 'warehouse lead', level: 2, monthlyPay: fromSpecSalary(28_000), monthsRequired: 12, needs: [gate('leadership', 2), gate('organization', 3)], teaches: [teach('leadership', 500), teach('organization', 500)], stress: 0, happiness: 0, blurb: 'The shift, and where everything goes.' },
      { id: 'distribution-manager', title: 'distribution manager', level: 3, monthlyPay: fromSpecSalary(48_000), monthsRequired: 36, needs: [gate('leadership', 4), gate('business-management', 3)], needsLevel: 'college', teaches: [teach('business-management', 600)], stress: 1, happiness: 1, blurb: 'The building, and everything that leaves it.' },
      { id: 'distribution-operations-director', title: 'operations director', level: 4, monthlyPay: fromSpecSalary(85_000), monthsRequired: 60, needs: [gate('business-management', 5), gate('leadership', 5), gate('strategic-planning', 3)], needsLevel: 'college', teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'Several buildings, and the lorries between them.' },
    ],
  },
  {
    id: 'restaurant-management',
    name: 'Restaurant Service',
    categoryId: 'retail-service',
    blurb: 'The floor, and eventually the whole room.',
    requires: 'none',
    levels: [
      { id: 'server', title: 'server', level: 1, monthlyPay: fromSpecSalary(18_000), monthsRequired: 0, needs: [], teaches: [teach('customer-service', 700), teach('sales', 500)], stress: -1, happiness: 0, blurb: 'Tips, aching feet, and table nine.' },
      { id: 'restaurant-shift-lead', title: 'shift lead', level: 2, monthlyPay: fromSpecSalary(24_000), monthsRequired: 12, needs: [gate('customer-service', 3), gate('leadership', 2)], teaches: [teach('leadership', 600), teach('customer-service', 500)], stress: 0, happiness: 0, blurb: 'The rota, and the no-shows.' },
      { id: 'restaurant-manager', title: 'restaurant manager', level: 3, monthlyPay: fromSpecSalary(42_000), monthsRequired: 36, needs: [gate('leadership', 4), gate('business-management', 3)], teaches: [teach('business-management', 700)], stress: 1, happiness: 1, blurb: 'Covers, costs, and the health inspector.' },
      { id: 'restaurant-general-manager', title: 'general manager', level: 4, monthlyPay: fromSpecSalary(72_000), monthsRequired: 60, needs: [gate('business-management', 5), gate('leadership', 5), gate('negotiation', 3)], needsLevel: 'college', teaches: [teach('negotiation', 500)], stress: 2, happiness: 1, blurb: 'Several rooms, and the brand above them.' },
    ],
  },
]
