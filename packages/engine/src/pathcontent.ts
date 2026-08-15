/**
 * THE LADDERS THEMSELVES (owner's `JOBS_CAREERS.md`).
 *
 * The first slice: fifteen paths, one for every category on the owner's
 * screen, so the whole shape can be played before the remaining sixty are
 * poured in as content. His ruling — foundation first.
 *
 * EVERY FIGURE IS HIS. Titles, months, skill gates, growth rates and the
 * stress/happiness rows are transcribed from the tables in his document
 * rather than re-derived. The ONE transformation is the salary, which goes
 * through `fromSpecSalary` because his money is present-day and this world's
 * is 1970 — see `SPEC_DEFLATOR` for why, and for the anchors it was read
 * from.
 *
 * Era windows are mine, not his: his document has no years in it, and a
 * software developer in 1970 would be an anachronism the business module
 * already taught this codebase to avoid. They are marked where they appear.
 */

import { climbable, fromSpecSalary } from './paths.js'
import type { CareerPath } from './paths.js'

/** Shorthand so a rung reads like the owner's table row. */
const gate = (skill: string, level: number) => ({ skill: skill as never, level })
const teach = (skill: string, perMonth: number) => ({ skill: skill as never, perMonth })

/**
 * The tables as transcribed. Exported only so the validator can see what
 * was WRITTEN as opposed to what is played — `FIRST_SLICE` is the one the
 * game uses, and it is these run through `climbable`.
 */
const WRITTEN: readonly CareerPath[] = [
  {
    id: 'retail-cashier',
    name: 'Retail Management',
    categoryId: 'retail-service',
    blurb: 'From the till to a region, on the shop floor the whole way.',
    requires: 'none',
    levels: [
      { id: 'cashier', title: 'cashier', level: 1, monthlyPay: fromSpecSalary(20_000), monthsRequired: 0, needs: [], teaches: [teach('customer-service', 500), teach('sales', 300)], stress: 0, happiness: -1, blurb: 'Ring it up, hand it over, do it again.' },
      { id: 'shift-lead', title: 'shift lead', level: 2, monthlyPay: fromSpecSalary(26_000), monthsRequired: 12, needs: [gate('customer-service', 3), gate('leadership', 2)], teaches: [teach('customer-service', 500), teach('leadership', 500)], stress: 1, happiness: 0, blurb: 'The keys, and whoever is on tonight.' },
      { id: 'store-manager', title: 'store manager', level: 3, monthlyPay: fromSpecSalary(45_000), monthsRequired: 36, needs: [gate('leadership', 4), gate('business-management', 3)], teaches: [teach('leadership', 600), teach('business-management', 400)], stress: 1, happiness: 1, blurb: 'The whole shop, and the numbers it turns in.' },
      { id: 'regional-manager', title: 'regional manager', level: 4, monthlyPay: fromSpecSalary(75_000), monthsRequired: 60, needs: [gate('business-management', 5), gate('leadership', 5), gate('negotiation', 3)], teaches: [teach('business-management', 700), teach('negotiation', 400)], stress: 2, happiness: 2, blurb: 'A dozen shops and a car that lives on the road.' },
      { id: 'vp-retail', title: 'vice president of retail', level: 5, monthlyPay: fromSpecSalary(150_000), monthsRequired: 96, needs: [gate('business-management', 5), gate('leadership', 5), gate('strategic-planning', 4)], teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'Where the shops go next, and which ones close.' },
    ],
  },
  {
    id: 'chef',
    name: 'Culinary Arts',
    categoryId: 'hospitality',
    blurb: 'A line, then a kitchen, then somebody else’s kitchens.',
    requires: 'none',
    levels: [
      { id: 'line-cook', title: 'line cook', level: 1, monthlyPay: fromSpecSalary(26_000), monthsRequired: 0, needs: [], teaches: [teach('creativity', 800), teach('problem-solving', 600)], stress: 0, happiness: 0, blurb: 'Six hours on your feet and the ticket rail never empties.' },
      { id: 'sous-chef', title: 'sous chef', level: 2, monthlyPay: fromSpecSalary(42_000), monthsRequired: 24, needs: [gate('leadership', 3), gate('problem-solving', 4)], teaches: [teach('leadership', 600), teach('creativity', 800)], stress: 1, happiness: 1, blurb: 'Second in the kitchen, first in on a bad night.' },
      { id: 'head-chef', title: 'head chef', level: 3, monthlyPay: fromSpecSalary(68_000), monthsRequired: 48, needs: [gate('leadership', 4), gate('creativity', 4)], teaches: [teach('creativity', 800), teach('communication', 500)], stress: 1, happiness: 2, blurb: 'The menu is yours, and so is the blame.' },
      { id: 'executive-chef', title: 'executive chef', level: 4, monthlyPay: fromSpecSalary(105_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('creativity', 5), gate('business-management', 3)], teaches: [teach('business-management', 500), teach('leadership', 600)], stress: 2, happiness: 2, blurb: 'More kitchens than you can stand in at once.' },
      { id: 'culinary-director', title: 'culinary director', level: 5, monthlyPay: fromSpecSalary(140_000), monthsRequired: 96, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 4)], teaches: [teach('strategic-planning', 500)], stress: 2, happiness: 2, blurb: 'Food as a business, cooked by other people.' },
    ],
  },
  {
    id: 'software-developer',
    name: 'Software Engineering',
    categoryId: 'technology',
    blurb: 'Making a machine do what it was not doing before.',
    requires: 'college',
    // ERA: mine, not his. The microcomputer decade, matching the business
    // module's own software gate.
    availableFrom: 1980,
    levels: [
      { id: 'junior-developer', title: 'junior developer', level: 1, monthlyPay: fromSpecSalary(65_000), monthsRequired: 0, needs: [], teaches: [teach('programming', 1200), teach('problem-solving', 800)], stress: 0, happiness: 1, blurb: 'The tickets nobody senior wanted.' },
      { id: 'senior-developer', title: 'senior developer', level: 2, monthlyPay: fromSpecSalary(95_000), monthsRequired: 24, needs: [gate('programming', 5), gate('problem-solving', 4)], teaches: [teach('programming', 500), teach('problem-solving', 500)], stress: 0, happiness: 2, blurb: 'The one they ask before they change anything.' },
      { id: 'tech-lead', title: 'tech lead', level: 3, monthlyPay: fromSpecSalary(125_000), monthsRequired: 48, needs: [gate('programming', 5), gate('leadership', 4), gate('strategic-planning', 3)], teaches: [teach('leadership', 700), teach('strategic-planning', 400)], stress: 1, happiness: 2, blurb: 'Still writing it, and now answering for it.' },
      { id: 'engineering-manager', title: 'engineering manager', level: 4, monthlyPay: fromSpecSalary(160_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 4), gate('strategic-planning', 4)], teaches: [teach('business-management', 600), teach('leadership', 500)], stress: 2, happiness: 2, blurb: 'You have not written a line in a year and the team ships.' },
      { id: 'vp-engineering', title: 'vice president of engineering', level: 5, monthlyPay: fromSpecSalary(250_000), monthsRequired: 108, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 5)], teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'What gets built at all, and by whom.' },
    ],
  },
  {
    id: 'truck-driver',
    name: 'Truck Driving & Logistics',
    categoryId: 'transportation',
    blurb: 'The road first, then the people on it.',
    requires: 'none',
    levels: [
      { id: 'truck-driver', title: 'truck driver', level: 1, monthlyPay: fromSpecSalary(28_000), monthsRequired: 0, needs: [], needsLicence: 'cdl', teaches: [teach('physical-work', 500), teach('organization', 500)], stress: 0, happiness: -1, blurb: 'Long hauls and truck-stop coffee.' },
      { id: 'lead-driver', title: 'lead driver', level: 2, monthlyPay: fromSpecSalary(42_000), monthsRequired: 24, needs: [gate('leadership', 2), gate('organization', 3)], needsLicence: 'cdl', teaches: [teach('leadership', 500), teach('organization', 600)], stress: 0, happiness: 0, blurb: 'The runs nobody else wants, and the drivers on them.' },
      { id: 'fleet-coordinator', title: 'fleet coordinator', level: 3, monthlyPay: fromSpecSalary(65_000), monthsRequired: 48, needs: [gate('leadership', 4), gate('business-management', 3)], teaches: [teach('business-management', 600), teach('organization', 500)], stress: 1, happiness: 1, blurb: 'Every truck on a board, and where it should be.' },
      { id: 'logistics-manager', title: 'logistics manager', level: 4, monthlyPay: fromSpecSalary(95_000), monthsRequired: 72, needs: [gate('business-management', 4), gate('strategic-planning', 3)], teaches: [teach('strategic-planning', 500), teach('business-management', 600)], stress: 1, happiness: 1, blurb: 'Freight as a system rather than a journey.' },
      { id: 'vp-transportation', title: 'vice president of transportation', level: 5, monthlyPay: fromSpecSalary(110_000), monthsRequired: 96, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 4)], teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'The whole network, and what it costs to run.' },
    ],
  },
  {
    id: 'accounting',
    name: 'Accounting & Finance',
    categoryId: 'finance-business',
    blurb: 'Books that balance, all the way to the top of them.',
    requires: 'none',
    levels: [
      { id: 'accounts-associate', title: 'accounts associate', level: 1, monthlyPay: fromSpecSalary(35_000), monthsRequired: 0, needs: [], teaches: [teach('attention-to-detail', 800), teach('accounting', 700)], stress: 0, happiness: 0, blurb: 'Invoices, and the patience for them.' },
      { id: 'accountant', title: 'accountant', level: 2, monthlyPay: fromSpecSalary(55_000), monthsRequired: 20, needs: [gate('accounting', 4), gate('attention-to-detail', 4)], needsLevel: 'college', teaches: [teach('accounting', 800), teach('attention-to-detail', 500)], stress: 0, happiness: 1, blurb: 'The books are yours to sign off.' },
      { id: 'senior-accountant', title: 'senior accountant', level: 3, monthlyPay: fromSpecSalary(80_000), monthsRequired: 44, needs: [gate('accounting', 5), gate('leadership', 2)], needsLevel: 'college', teaches: [teach('leadership', 500), teach('accounting', 500)], stress: 1, happiness: 1, blurb: 'The complicated ones come to you.' },
      { id: 'accounting-manager', title: 'accounting manager', level: 4, monthlyPay: fromSpecSalary(120_000), monthsRequired: 68, needs: [gate('leadership', 4), gate('business-management', 4)], needsLevel: 'college', teaches: [teach('business-management', 600), teach('leadership', 500)], stress: 2, happiness: 1, blurb: 'A department, and the month-end it lives by.' },
      { id: 'controller', title: 'controller', level: 5, monthlyPay: fromSpecSalary(180_000), monthsRequired: 92, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 4)], needsLevel: 'college', teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'Every number the company reports.' },
    ],
  },
  {
    id: 'nursing',
    name: 'Nursing & Patient Care',
    categoryId: 'healthcare',
    blurb: 'The ward, and everybody on it.',
    requires: 'none',
    levels: [
      { id: 'medical-assistant', title: 'medical assistant', level: 1, monthlyPay: fromSpecSalary(32_000), monthsRequired: 0, needs: [], teaches: [teach('customer-service', 700), teach('medical-knowledge', 600)], stress: 0, happiness: 0, blurb: 'Vitals, notes, and the hundred small things.' },
      { id: 'registered-nurse', title: 'registered nurse', level: 2, monthlyPay: fromSpecSalary(68_000), monthsRequired: 24, needs: [gate('medical-knowledge', 4), gate('customer-service', 4)], needsLevel: 'college', teaches: [teach('medical-knowledge', 800), teach('leadership', 400)], stress: 1, happiness: 1, blurb: 'Twelve-hour shifts and the licence that allows them.' },
      { id: 'charge-nurse', title: 'charge nurse', level: 3, monthlyPay: fromSpecSalary(95_000), monthsRequired: 48, needs: [gate('leadership', 4), gate('medical-knowledge', 5)], needsLevel: 'college', teaches: [teach('leadership', 600), teach('medical-knowledge', 500)], stress: 2, happiness: 1, blurb: 'The floor runs the way you run it.' },
      { id: 'nursing-manager', title: 'nursing manager', level: 4, monthlyPay: fromSpecSalary(135_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 4)], needsLevel: 'college', teaches: [teach('business-management', 500), teach('leadership', 500)], stress: 2, happiness: 2, blurb: 'Rotas, budgets, and the people who work them.' },
    ],
  },
  {
    id: 'police-officer',
    name: 'Law Enforcement',
    categoryId: 'public-service',
    blurb: 'A beat, and then the people walking it.',
    requires: 'secondary',
    levels: [
      { id: 'police-officer', title: 'police officer', level: 1, monthlyPay: fromSpecSalary(35_000), monthsRequired: 0, needs: [], teaches: [teach('leadership', 600), teach('problem-solving', 600)], stress: 1, happiness: 0, blurb: 'Nights, weekends, and whatever the radio says.' },
      { id: 'sergeant', title: 'sergeant', level: 2, monthlyPay: fromSpecSalary(56_000), monthsRequired: 24, needs: [gate('leadership', 3), gate('communication', 3)], teaches: [teach('leadership', 700), teach('communication', 500)], stress: 1, happiness: 1, blurb: 'A shift of them, and their paperwork.' },
      { id: 'lieutenant', title: 'lieutenant', level: 3, monthlyPay: fromSpecSalary(78_000), monthsRequired: 48, needs: [gate('leadership', 4), gate('strategic-planning', 2)], teaches: [teach('leadership', 700), teach('strategic-planning', 500)], stress: 2, happiness: 1, blurb: 'A watch, and what it is told to prioritise.' },
      { id: 'captain', title: 'captain', level: 4, monthlyPay: fromSpecSalary(105_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 4)], teaches: [teach('business-management', 500), teach('strategic-planning', 500)], stress: 2, happiness: 2, blurb: 'A district, and the council meetings about it.' },
      { id: 'chief-of-police', title: 'chief of police', level: 5, monthlyPay: fromSpecSalary(130_000), monthsRequired: 96, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 4)], teaches: [teach('strategic-planning', 500)], stress: 2, happiness: 2, blurb: 'The whole force, and the town’s opinion of it.' },
    ],
  },
  {
    id: 'trades-electrician',
    name: 'Electrical Trades',
    categoryId: 'trades',
    blurb: 'Apprentice to contractor, on the tools the whole way up.',
    requires: 'none',
    levels: [
      { id: 'apprentice-electrician', title: 'apprentice electrician', level: 1, monthlyPay: fromSpecSalary(30_000), monthsRequired: 0, needs: [], teaches: [teach('technical-knowledge', 900), teach('physical-work', 600)], stress: 0, happiness: 0, blurb: 'Carrying, watching, and slowly being trusted.' },
      { id: 'journeyman-electrician', title: 'journeyman electrician', level: 2, monthlyPay: fromSpecSalary(55_000), monthsRequired: 36, needs: [gate('technical-knowledge', 5), gate('problem-solving', 3)], teaches: [teach('technical-knowledge', 700), teach('problem-solving', 700)], stress: 0, happiness: 1, blurb: 'Your own van, your own jobs.' },
      { id: 'job-supervisor', title: 'job supervisor', level: 3, monthlyPay: fromSpecSalary(78_000), monthsRequired: 60, needs: [gate('leadership', 4), gate('technical-knowledge', 5)], teaches: [teach('leadership', 600), teach('business-management', 500)], stress: 1, happiness: 1, blurb: 'A site, and the sparks working it.' },
      { id: 'electrical-contractor', title: 'electrical contractor', level: 4, monthlyPay: fromSpecSalary(120_000), monthsRequired: 84, needs: [gate('leadership', 5), gate('business-management', 4)], teaches: [teach('business-management', 600), teach('negotiation', 500)], stress: 2, happiness: 2, blurb: 'The name on the van is yours.' },
    ],
  },
  {
    id: 'design',
    name: 'Graphic & UX Design',
    categoryId: 'creative',
    blurb: 'Making the thing that was not there before, for money.',
    requires: 'none',
    levels: [
      { id: 'junior-designer', title: 'junior designer', level: 1, monthlyPay: fromSpecSalary(45_000), monthsRequired: 0, needs: [], teaches: [teach('creativity', 900), teach('technical-knowledge', 700)], stress: 0, happiness: 2, blurb: 'Somebody else’s idea, made properly.' },
      { id: 'designer', title: 'designer', level: 2, monthlyPay: fromSpecSalary(68_000), monthsRequired: 26, needs: [gate('creativity', 4), gate('communication', 3)], teaches: [teach('creativity', 700), teach('communication', 600)], stress: 0, happiness: 2, blurb: 'Your ideas now, defended in a room.' },
      { id: 'design-lead', title: 'design lead', level: 3, monthlyPay: fromSpecSalary(105_000), monthsRequired: 50, needs: [gate('leadership', 4), gate('strategic-planning', 3)], teaches: [teach('leadership', 600), teach('strategic-planning', 500)], stress: 1, happiness: 2, blurb: 'What the work looks like, and who does it.' },
      { id: 'creative-director', title: 'creative director', level: 4, monthlyPay: fromSpecSalary(155_000), monthsRequired: 74, needs: [gate('leadership', 5), gate('business-management', 4)], teaches: [teach('business-management', 500)], stress: 2, happiness: 2, blurb: 'The whole look of it, and the argument for it.' },
    ],
  },
  {
    id: 'teaching',
    name: 'Education & Teaching',
    categoryId: 'education',
    blurb: 'A room of them, and eventually a school.',
    requires: 'none',
    levels: [
      { id: 'tutor', title: 'tutor', level: 1, monthlyPay: fromSpecSalary(28_000), monthsRequired: 0, needs: [], teaches: [teach('communication', 800), teach('problem-solving', 500)], stress: -1, happiness: 2, blurb: 'One at a time, at a kitchen table.' },
      { id: 'teacher', title: 'teacher', level: 2, monthlyPay: fromSpecSalary(50_000), monthsRequired: 20, needs: [gate('communication', 4), gate('leadership', 2)], needsLevel: 'college', teaches: [teach('communication', 600), teach('leadership', 500)], stress: 0, happiness: 2, blurb: 'Thirty of them, five days a week.' },
      { id: 'department-head', title: 'department head', level: 3, monthlyPay: fromSpecSalary(75_000), monthsRequired: 44, needs: [gate('leadership', 4), gate('business-management', 3)], needsLevel: 'college', teaches: [teach('leadership', 600), teach('business-management', 500)], stress: 1, happiness: 1, blurb: 'A subject, and the staff who teach it.' },
      { id: 'headmaster', title: 'headmaster', level: 4, monthlyPay: fromSpecSalary(130_000), monthsRequired: 68, needs: [gate('leadership', 5), gate('business-management', 5)], needsLevel: 'college', teaches: [teach('business-management', 500)], stress: 2, happiness: 1, blurb: 'The whole school, and the parents of it.' },
    ],
  },
  {
    id: 'lawyer',
    name: 'Legal Services',
    categoryId: 'law',
    blurb: 'Filing for other people, then arguing for them.',
    requires: 'secondary',
    levels: [
      { id: 'paralegal', title: 'paralegal', level: 1, monthlyPay: fromSpecSalary(40_000), monthsRequired: 0, needs: [], teaches: [teach('attention-to-detail', 800), teach('communication', 600)], stress: 1, happiness: 0, blurb: 'Everything the attorney does not have time to read.' },
      { id: 'attorney', title: 'attorney', level: 2, monthlyPay: fromSpecSalary(85_000), monthsRequired: 28, needs: [gate('communication', 4), gate('problem-solving', 4)], needsLevel: 'graduate', teaches: [teach('communication', 800), teach('problem-solving', 700)], stress: 1, happiness: 1, blurb: 'Your name on the filing.' },
      { id: 'senior-attorney', title: 'senior attorney', level: 3, monthlyPay: fromSpecSalary(140_000), monthsRequired: 52, needs: [gate('leadership', 4), gate('negotiation', 4)], needsLevel: 'graduate', teaches: [teach('negotiation', 600), teach('leadership', 600)], stress: 2, happiness: 1, blurb: 'The cases that decide the year.' },
      { id: 'partner', title: 'partner', level: 4, monthlyPay: fromSpecSalary(220_000), monthsRequired: 76, needs: [gate('leadership', 5), gate('business-management', 5)], needsLevel: 'graduate', teaches: [teach('business-management', 500)], stress: 2, happiness: 2, blurb: 'The name on the door is partly yours.' },
    ],
  },
  {
    id: 'hairdresser',
    name: 'Hair & Beauty Services',
    categoryId: 'personal-services',
    blurb: 'A chair, then a salon, then the lease on it.',
    requires: 'none',
    levels: [
      { id: 'hair-stylist', title: 'hair stylist', level: 1, monthlyPay: fromSpecSalary(25_000), monthsRequired: 0, needs: [], needsLicence: 'cosmetology', teaches: [teach('creativity', 800), teach('customer-service', 600)], stress: 0, happiness: 1, blurb: 'Standing all day, talking all day.' },
      { id: 'senior-stylist', title: 'senior stylist', level: 2, monthlyPay: fromSpecSalary(48_000), monthsRequired: 20, needs: [gate('creativity', 4), gate('customer-service', 4)], needsLicence: 'cosmetology', teaches: [teach('creativity', 600), teach('communication', 600)], stress: 1, happiness: 1, blurb: 'A book of regulars who ask for you.' },
      { id: 'salon-manager', title: 'salon manager', level: 3, monthlyPay: fromSpecSalary(78_000), monthsRequired: 44, needs: [gate('leadership', 4), gate('business-management', 3)], needsLicence: 'cosmetology', teaches: [teach('leadership', 500), teach('business-management', 500)], stress: 2, happiness: 2, blurb: 'The rota, the stock, and everybody’s tips.' },
      { id: 'salon-owner', title: 'salon owner', level: 4, monthlyPay: fromSpecSalary(95_000), monthsRequired: 68, needs: [gate('leadership', 5), gate('business-management', 5)], needsLicence: 'cosmetology', teaches: [teach('business-management', 500)], stress: 2, happiness: 2, blurb: 'Your name on the awning, and the lease under it.' },
    ],
  },
  {
    id: 'farmer',
    name: 'Farming & Agriculture',
    categoryId: 'agriculture',
    blurb: 'Somebody’s land, and one day your own.',
    requires: 'none',
    levels: [
      { id: 'farm-worker', title: 'farm worker', level: 1, monthlyPay: fromSpecSalary(26_000), monthsRequired: 0, needs: [], teaches: [teach('physical-work', 500), teach('organization', 700)], stress: 0, happiness: 0, blurb: 'Dawn, and whatever the season demands.' },
      { id: 'farm-manager', title: 'farm manager', level: 2, monthlyPay: fromSpecSalary(55_000), monthsRequired: 24, needs: [gate('organization', 4), gate('problem-solving', 3)], teaches: [teach('organization', 600), teach('problem-solving', 600)], stress: 0, happiness: 1, blurb: 'The whole place, and what it plants.' },
      { id: 'agricultural-manager', title: 'agricultural manager', level: 3, monthlyPay: fromSpecSalary(88_000), monthsRequired: 48, needs: [gate('leadership', 4), gate('business-management', 3)], teaches: [teach('leadership', 600), teach('business-management', 500)], stress: 1, happiness: 2, blurb: 'Several farms, and the buyers for them.' },
      { id: 'farm-owner', title: 'farm owner', level: 4, monthlyPay: fromSpecSalary(125_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 3)], teaches: [teach('strategic-planning', 500)], stress: 2, happiness: 2, blurb: 'The deed, the debt, and the weather.' },
    ],
  },
  {
    id: 'journalist',
    name: 'Journalism & News Media',
    categoryId: 'entertainment',
    blurb: 'A beat, a byline, and eventually the front page.',
    requires: 'secondary',
    levels: [
      { id: 'reporter', title: 'reporter', level: 1, monthlyPay: fromSpecSalary(32_000), monthsRequired: 0, needs: [], teaches: [teach('communication', 900), teach('problem-solving', 700)], stress: 1, happiness: 1, blurb: 'Council meetings and house fires.' },
      { id: 'senior-reporter', title: 'senior reporter', level: 2, monthlyPay: fromSpecSalary(58_000), monthsRequired: 22, needs: [gate('communication', 4), gate('problem-solving', 4)], teaches: [teach('communication', 700), teach('attention-to-detail', 600)], stress: 1, happiness: 2, blurb: 'The stories that take a month.' },
      { id: 'editor', title: 'editor', level: 3, monthlyPay: fromSpecSalary(95_000), monthsRequired: 46, needs: [gate('leadership', 4), gate('communication', 5)], needsLevel: 'college', teaches: [teach('leadership', 600), teach('strategic-planning', 400)], stress: 2, happiness: 2, blurb: 'What runs, and what is held.' },
      { id: 'managing-editor', title: 'managing editor', level: 4, monthlyPay: fromSpecSalary(130_000), monthsRequired: 70, needs: [gate('leadership', 5), gate('strategic-planning', 3)], needsLevel: 'college', teaches: [teach('strategic-planning', 500)], stress: 2, happiness: 2, blurb: 'The whole paper, every day, for ever.' },
    ],
  },
  {
    id: 'human-resources',
    name: 'Human Resources',
    categoryId: 'management',
    blurb: 'The people side of it, all the way up.',
    requires: 'secondary',
    levels: [
      { id: 'hr-coordinator', title: 'HR coordinator', level: 1, monthlyPay: fromSpecSalary(38_000), monthsRequired: 0, needs: [], teaches: [teach('organization', 700), teach('communication', 600)], stress: 0, happiness: 1, blurb: 'Forms, starters, leavers, and the filing.' },
      { id: 'hr-manager', title: 'HR manager', level: 2, monthlyPay: fromSpecSalary(62_000), monthsRequired: 22, needs: [gate('leadership', 3), gate('communication', 4)], needsLevel: 'college', teaches: [teach('leadership', 600), teach('business-management', 400)], stress: 1, happiness: 1, blurb: 'The conversations nobody else will have.' },
      { id: 'hr-director', title: 'HR director', level: 3, monthlyPay: fromSpecSalary(105_000), monthsRequired: 46, needs: [gate('leadership', 4), gate('strategic-planning', 3)], needsLevel: 'college', teaches: [teach('strategic-planning', 500), teach('leadership', 600)], stress: 2, happiness: 1, blurb: 'How the company hires, pays and lets go.' },
      { id: 'vp-people', title: 'vice president of people', level: 4, monthlyPay: fromSpecSalary(170_000), monthsRequired: 70, needs: [gate('leadership', 5), gate('business-management', 5)], needsLevel: 'college', teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'Everybody who works there is your remit.' },
    ],
  },
]

/** What the game actually offers: the tables, with every ladder connected. */
export const FIRST_SLICE: readonly CareerPath[] = WRITTEN.map(climbable)
export { WRITTEN }
