/**
 * THE REST OF THE OWNER'S LADDERS, PART TWO: the hands-on trades.
 *
 * Trades, healthcare, hospitality, creative work, public service, personal
 * services, agriculture and entertainment — transcribed from
 * `JOBS_CAREERS.md` on the same terms as `pathmore.ts`: his per-rung figures
 * where he gave them, interpolation between the ends he named where he gave
 * only a summary, and era windows of my own where a trade plainly did not
 * exist in 1970.
 */

import { fromSpecSalary } from './paths.js'
import type { CareerPath } from './paths.js'

const gate = (skill: string, level: number) => ({ skill: skill as never, level })
const teach = (skill: string, perMonth: number) => ({ skill: skill as never, perMonth })

export const HANDS_ON: readonly CareerPath[] = [
  // ---- TRADES -------------------------------------------------------------
  {
    id: 'plumbing',
    name: 'Plumbing & Pipefitting',
    categoryId: 'trades',
    blurb: 'Helper to contractor, and a van of your own.',
    requires: 'none',
    levels: [
      { id: 'plumbing-helper', title: 'plumbing helper', level: 1, monthlyPay: fromSpecSalary(28_000), monthsRequired: 0, needs: [], teaches: [teach('physical-work', 700), teach('technical-knowledge', 800)], stress: 0, happiness: -1, blurb: 'Fetching, holding, and watching how it is done.' },
      { id: 'plumbing-technician', title: 'plumbing technician', level: 2, monthlyPay: fromSpecSalary(48_000), monthsRequired: 30, needs: [gate('technical-knowledge', 4), gate('problem-solving', 2)], teaches: [teach('problem-solving', 700), teach('customer-service', 500)], stress: 0, happiness: 0, blurb: 'Your own calls, and your own mistakes.' },
      { id: 'plumbing-lead', title: 'lead technician', level: 3, monthlyPay: fromSpecSalary(72_000), monthsRequired: 54, needs: [gate('leadership', 3), gate('technical-knowledge', 5)], teaches: [teach('leadership', 600), teach('business-management', 500)], stress: 1, happiness: 1, blurb: 'The jobs nobody else wanted to quote.' },
      { id: 'plumbing-contractor', title: 'plumbing contractor', level: 4, monthlyPay: fromSpecSalary(115_000), monthsRequired: 78, needs: [gate('leadership', 5), gate('business-management', 4)], teaches: [teach('business-management', 600), teach('negotiation', 500)], stress: 2, happiness: 1, blurb: 'Other people’s vans carry your name.' },
    ],
  },
  {
    id: 'carpentry',
    name: 'Carpentry & Construction',
    categoryId: 'trades',
    blurb: 'Apprentice to project manager, in sawdust the whole way.',
    requires: 'none',
    levels: [
      { id: 'carpenter-apprentice', title: 'carpenter apprentice', level: 1, monthlyPay: fromSpecSalary(28_000), monthsRequired: 0, needs: [], teaches: [teach('physical-work', 600), teach('technical-knowledge', 800)], stress: 0, happiness: 0, blurb: 'Cutting to somebody else’s line.' },
      { id: 'journeyman-carpenter', title: 'journeyman carpenter', level: 2, monthlyPay: fromSpecSalary(50_000), monthsRequired: 30, needs: [gate('technical-knowledge', 4), gate('problem-solving', 3)], teaches: [teach('problem-solving', 700), teach('leadership', 400)], stress: 0, happiness: 1, blurb: 'The line is yours to set.' },
      { id: 'master-carpenter', title: 'master carpenter', level: 3, monthlyPay: fromSpecSalary(75_000), monthsRequired: 54, needs: [gate('technical-knowledge', 5), gate('leadership', 2)], teaches: [teach('leadership', 500), teach('business-management', 500)], stress: 1, happiness: 1, blurb: 'The work people point at afterwards.' },
      { id: 'carpentry-foreman', title: 'construction foreman', level: 4, monthlyPay: fromSpecSalary(98_000), monthsRequired: 78, needs: [gate('leadership', 4), gate('business-management', 3)], teaches: [teach('business-management', 600), teach('strategic-planning', 400)], stress: 1, happiness: 2, blurb: 'The site, and everybody on it.' },
      { id: 'carpentry-project-manager', title: 'project manager', level: 5, monthlyPay: fromSpecSalary(115_000), monthsRequired: 102, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 3)], needsLevel: 'college', teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'Several sites, and the programme across them.' },
    ],
  },
  {
    id: 'hvac',
    name: 'HVAC & Mechanical',
    categoryId: 'trades',
    blurb: 'Heat, cold, and the machinery between.',
    requires: 'none',
    levels: [
      { id: 'hvac-apprentice', title: 'HVAC apprentice', level: 1, monthlyPay: fromSpecSalary(32_000), monthsRequired: 0, needs: [], teaches: [teach('technical-knowledge', 800), teach('physical-work', 500)], stress: 0, happiness: 0, blurb: 'Lofts in August, crawlspaces in January.' },
      { id: 'hvac-technician', title: 'HVAC technician', level: 2, monthlyPay: fromSpecSalary(52_000), monthsRequired: 28, needs: [gate('technical-knowledge', 4), gate('problem-solving', 3)], teaches: [teach('problem-solving', 700), teach('leadership', 400)], stress: 0, happiness: 1, blurb: 'You find the fault before you open anything.' },
      { id: 'hvac-journeyman', title: 'journeyman', level: 3, monthlyPay: fromSpecSalary(75_000), monthsRequired: 52, needs: [gate('technical-knowledge', 5), gate('leadership', 2)], teaches: [teach('leadership', 500), teach('business-management', 500)], stress: 1, happiness: 1, blurb: 'The installs, and the apprentices watching.' },
      { id: 'hvac-service-manager', title: 'service manager', level: 4, monthlyPay: fromSpecSalary(110_000), monthsRequired: 76, needs: [gate('leadership', 4), gate('business-management', 4)], teaches: [teach('business-management', 600)], stress: 2, happiness: 1, blurb: 'The whole book of service contracts.' },
    ],
  },
  {
    id: 'welding',
    name: 'Welding & Fabrication',
    categoryId: 'trades',
    blurb: 'A trade you can see the quality of.',
    requires: 'none',
    levels: [
      { id: 'welding-apprentice', title: 'welding apprentice', level: 1, monthlyPay: fromSpecSalary(30_000), monthsRequired: 0, needs: [], teaches: [teach('technical-knowledge', 800), teach('attention-to-detail', 700)], stress: 0, happiness: -1, blurb: 'Grinding other people’s welds flat.' },
      { id: 'welder', title: 'welder', level: 2, monthlyPay: fromSpecSalary(48_000), monthsRequired: 24, needs: [gate('technical-knowledge', 4), gate('attention-to-detail', 3)], teaches: [teach('attention-to-detail', 700), teach('physical-work', 500)], stress: 0, happiness: 0, blurb: 'The bead is clean and everybody can tell.' },
      { id: 'certified-welder', title: 'certified welder', level: 3, monthlyPay: fromSpecSalary(68_000), monthsRequired: 48, needs: [gate('technical-knowledge', 5), gate('problem-solving', 3)], teaches: [teach('problem-solving', 500), teach('leadership', 400)], stress: 0, happiness: 1, blurb: 'The work that gets x-rayed.' },
      { id: 'lead-welder', title: 'lead welder', level: 4, monthlyPay: fromSpecSalary(95_000), monthsRequired: 72, needs: [gate('leadership', 3), gate('technical-knowledge', 5)], teaches: [teach('leadership', 500), teach('business-management', 400)], stress: 1, happiness: 1, blurb: 'The bay, and who works which job.' },
      { id: 'welding-shop-foreman', title: 'shop foreman', level: 5, monthlyPay: fromSpecSalary(110_000), monthsRequired: 96, needs: [gate('leadership', 5), gate('business-management', 4)], teaches: [teach('business-management', 500)], stress: 2, happiness: 2, blurb: 'The shop, the schedule and the steel bill.' },
    ],
  },
  {
    id: 'auto-tech',
    name: 'Automotive Technician',
    categoryId: 'trades',
    blurb: 'Everything that moves under its own power.',
    requires: 'none',
    levels: [
      { id: 'auto-technician', title: 'auto technician', level: 1, monthlyPay: fromSpecSalary(30_000), monthsRequired: 0, needs: [], teaches: [teach('technical-knowledge', 800), teach('problem-solving', 700)], stress: 0, happiness: 0, blurb: 'Oil, brakes, and the ones that come back.' },
      { id: 'lead-auto-technician', title: 'lead technician', level: 2, monthlyPay: fromSpecSalary(50_000), monthsRequired: 24, needs: [gate('technical-knowledge', 4), gate('problem-solving', 3)], teaches: [teach('problem-solving', 700), teach('leadership', 400)], stress: 0, happiness: 1, blurb: 'The intermittent faults land on your bench.' },
      { id: 'auto-shop-supervisor', title: 'shop supervisor', level: 3, monthlyPay: fromSpecSalary(72_000), monthsRequired: 48, needs: [gate('leadership', 3), gate('technical-knowledge', 5)], teaches: [teach('leadership', 600), teach('business-management', 500)], stress: 1, happiness: 1, blurb: 'The ramp, and the queue for it.' },
      { id: 'auto-service-manager', title: 'service manager', level: 4, monthlyPay: fromSpecSalary(105_000), monthsRequired: 72, needs: [gate('leadership', 4), gate('business-management', 4)], needsLevel: 'college', teaches: [teach('business-management', 600)], stress: 2, happiness: 1, blurb: 'The department, and what it bills.' },
    ],
  },
  {
    id: 'roofing',
    name: 'Roofing & Waterproofing',
    categoryId: 'trades',
    blurb: 'The one trade nobody thanks until it rains.',
    requires: 'none',
    levels: [
      { id: 'roofer-helper', title: 'roofer’s helper', level: 1, monthlyPay: fromSpecSalary(28_000), monthsRequired: 0, needs: [], teaches: [teach('physical-work', 800), teach('technical-knowledge', 600)], stress: 1, happiness: -1, blurb: 'Carrying bundles up a ladder all day.' },
      { id: 'roofer', title: 'roofer', level: 2, monthlyPay: fromSpecSalary(45_000), monthsRequired: 24, needs: [gate('physical-work', 3), gate('technical-knowledge', 3)], teaches: [teach('technical-knowledge', 700), teach('leadership', 400)], stress: 1, happiness: 0, blurb: 'You can lay a roof that will not leak.' },
      { id: 'roofing-supervisor', title: 'roofing supervisor', level: 3, monthlyPay: fromSpecSalary(70_000), monthsRequired: 48, needs: [gate('leadership', 3), gate('technical-knowledge', 4)], teaches: [teach('leadership', 600), teach('business-management', 500)], stress: 1, happiness: 1, blurb: 'A crew, and the weather forecast.' },
      { id: 'roofing-contractor', title: 'roofing contractor', level: 4, monthlyPay: fromSpecSalary(105_000), monthsRequired: 66, needs: [gate('leadership', 4), gate('business-management', 4)], teaches: [teach('business-management', 600)], stress: 2, happiness: 1, blurb: 'The quotes, the crews and the guarantee.' },
    ],
  },
  {
    id: 'construction-foreman',
    name: 'Construction Management',
    categoryId: 'trades',
    blurb: 'From the trench to the trailer.',
    requires: 'none',
    levels: [
      { id: 'construction-worker', title: 'construction worker', level: 1, monthlyPay: fromSpecSalary(30_000), monthsRequired: 0, needs: [], teaches: [teach('physical-work', 700), teach('teamwork', 700)], stress: 0, happiness: 0, blurb: 'Whatever the site needs doing today.' },
      { id: 'construction-lead', title: 'lead hand', level: 2, monthlyPay: fromSpecSalary(48_000), monthsRequired: 20, needs: [gate('teamwork', 3), gate('physical-work', 3)], teaches: [teach('leadership', 700), teach('organization', 600)], stress: 1, happiness: 0, blurb: 'The gang, and what they start on.' },
      { id: 'site-foreman-path', title: 'foreman', level: 3, monthlyPay: fromSpecSalary(72_000), monthsRequired: 44, needs: [gate('leadership', 4), gate('organization', 3)], teaches: [teach('organization', 600), teach('business-management', 500)], stress: 2, happiness: 1, blurb: 'The programme, the deliveries and the inspector.' },
      { id: 'superintendent-path', title: 'superintendent', level: 4, monthlyPay: fromSpecSalary(98_000), monthsRequired: 68, needs: [gate('leadership', 5), gate('business-management', 3)], teaches: [teach('business-management', 600), teach('strategic-planning', 500)], stress: 2, happiness: 2, blurb: 'Several sites, and the trades across them.' },
      { id: 'construction-project-manager', title: 'project manager', level: 5, monthlyPay: fromSpecSalary(130_000), monthsRequired: 92, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 4)], needsLevel: 'college', teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'The whole build, from the drawings on.' },
    ],
  },
  {
    id: 'equipment-operator',
    name: 'Heavy Equipment',
    categoryId: 'trades',
    blurb: 'The big machines, and the ticket to run them.',
    requires: 'none',
    levels: [
      { id: 'equipment-helper', title: 'equipment operator’s helper', level: 1, monthlyPay: fromSpecSalary(32_000), monthsRequired: 0, needs: [], needsLicence: 'heavy-equipment', teaches: [teach('technical-knowledge', 700), teach('physical-work', 600)], stress: 0, happiness: 0, blurb: 'Banking the machine and watching the blind side.' },
      { id: 'equipment-operator', title: 'equipment operator', level: 2, monthlyPay: fromSpecSalary(55_000), monthsRequired: 24, needs: [gate('technical-knowledge', 3), gate('physical-work', 3)], needsLicence: 'heavy-equipment', teaches: [teach('technical-knowledge', 600), teach('leadership', 400)], stress: 1, happiness: 1, blurb: 'The seat is yours, and the trench is exact.' },
      { id: 'lead-operator', title: 'lead operator', level: 3, monthlyPay: fromSpecSalary(80_000), monthsRequired: 48, needs: [gate('leadership', 3), gate('technical-knowledge', 4)], needsLicence: 'heavy-equipment', teaches: [teach('leadership', 600), teach('organization', 500)], stress: 1, happiness: 1, blurb: 'Which machine goes where, and when.' },
      { id: 'fleet-manager-equipment', title: 'fleet manager', level: 4, monthlyPay: fromSpecSalary(115_000), monthsRequired: 72, needs: [gate('leadership', 4), gate('business-management', 4)], teaches: [teach('business-management', 600)], stress: 2, happiness: 1, blurb: 'Every machine the company owns.' },
    ],
  },
  // ---- HEALTHCARE ---------------------------------------------------------
  {
    id: 'lab-tech',
    name: 'Laboratory Science',
    categoryId: 'healthcare',
    blurb: 'The answers everybody else is waiting on.',
    requires: 'secondary',
    levels: [
      { id: 'lab-technician', title: 'lab technician', level: 1, monthlyPay: fromSpecSalary(38_000), monthsRequired: 0, needs: [], teaches: [teach('attention-to-detail', 800), teach('technical-knowledge', 700)], stress: 0, happiness: 1, blurb: 'Samples, and the order they must stay in.' },
      { id: 'senior-lab-technician', title: 'senior lab technician', level: 2, monthlyPay: fromSpecSalary(60_000), monthsRequired: 28, needs: [gate('technical-knowledge', 4), gate('attention-to-detail', 4)], teaches: [teach('problem-solving', 600), teach('technical-knowledge', 600)], stress: 0, happiness: 1, blurb: 'The assays nobody else runs.' },
      { id: 'lab-manager', title: 'lab manager', level: 3, monthlyPay: fromSpecSalary(88_000), monthsRequired: 52, needs: [gate('leadership', 4), gate('business-management', 3)], needsLevel: 'college', teaches: [teach('leadership', 500), teach('business-management', 500)], stress: 1, happiness: 1, blurb: 'The bench, the budget and the accreditation.' },
      { id: 'lab-director', title: 'lab director', level: 4, monthlyPay: fromSpecSalary(130_000), monthsRequired: 76, needs: [gate('leadership', 5), gate('business-management', 5)], needsLevel: 'college', teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'Every result the hospital acts on.' },
    ],
  },
  {
    id: 'medical-technician',
    name: 'Medical & Diagnostic Technology',
    categoryId: 'healthcare',
    blurb: 'The machines that see inside people.',
    requires: 'secondary',
    levels: [
      { id: 'medical-technician', title: 'medical technician', level: 1, monthlyPay: fromSpecSalary(38_000), monthsRequired: 0, needs: [], needsLicence: 'medical-tech', teaches: [teach('medical-knowledge', 800), teach('technical-knowledge', 700)], stress: 0, happiness: 1, blurb: 'Positioning, exposure, and a frightened patient.' },
      { id: 'senior-medical-tech', title: 'senior technician', level: 2, monthlyPay: fromSpecSalary(58_000), monthsRequired: 24, needs: [gate('medical-knowledge', 3), gate('technical-knowledge', 3)], needsLicence: 'medical-tech', teaches: [teach('attention-to-detail', 700), teach('leadership', 400)], stress: 1, happiness: 1, blurb: 'The difficult studies come to you.' },
      { id: 'medical-tech-supervisor', title: 'supervisor', level: 3, monthlyPay: fromSpecSalary(82_000), monthsRequired: 48, needs: [gate('leadership', 4), gate('medical-knowledge', 4)], teaches: [teach('leadership', 600), teach('business-management', 500)], stress: 1, happiness: 1, blurb: 'The rota and the machines’ service contracts.' },
      { id: 'medical-tech-manager', title: 'department manager', level: 4, monthlyPay: fromSpecSalary(110_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 4)], teaches: [teach('business-management', 600)], stress: 2, happiness: 1, blurb: 'Imaging, as a department with a waiting list.' },
    ],
  },
  {
    id: 'pharmacy-technician',
    name: 'Pharmacy',
    categoryId: 'healthcare',
    blurb: 'The counter, and everything behind it.',
    requires: 'secondary',
    levels: [
      { id: 'pharmacy-technician', title: 'pharmacy technician', level: 1, monthlyPay: fromSpecSalary(32_000), monthsRequired: 0, needs: [], needsLicence: 'pharmacy', teaches: [teach('medical-knowledge', 700), teach('attention-to-detail', 800)], stress: 0, happiness: 0, blurb: 'Counting, checking, and checking again.' },
      { id: 'senior-pharmacy-tech', title: 'senior technician', level: 2, monthlyPay: fromSpecSalary(50_000), monthsRequired: 24, needs: [gate('medical-knowledge', 3), gate('attention-to-detail', 4)], needsLicence: 'pharmacy', teaches: [teach('organization', 600), teach('leadership', 400)], stress: 1, happiness: 1, blurb: 'The stock, the fridge, and the controlled drugs.' },
      { id: 'pharmacy-manager', title: 'pharmacy manager', level: 3, monthlyPay: fromSpecSalary(78_000), monthsRequired: 48, needs: [gate('leadership', 4), gate('organization', 4)], teaches: [teach('leadership', 600), teach('business-management', 500)], stress: 2, happiness: 1, blurb: 'The counter, the staff and the audit.' },
      { id: 'pharmacy-operations-manager', title: 'operations manager', level: 4, monthlyPay: fromSpecSalary(105_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 4)], teaches: [teach('business-management', 600)], stress: 2, happiness: 1, blurb: 'Every counter in the chain.' },
    ],
  },
  {
    id: 'physical-therapist',
    name: 'Physical Therapy',
    categoryId: 'healthcare',
    blurb: 'Getting people back on their feet, slowly.',
    requires: 'secondary',
    levels: [
      { id: 'pt-assistant', title: 'physiotherapy assistant', level: 1, monthlyPay: fromSpecSalary(35_000), monthsRequired: 0, needs: [], teaches: [teach('medical-knowledge', 700), teach('communication', 600)], stress: 0, happiness: 1, blurb: 'Exercises, encouragement, and patience.' },
      { id: 'physical-therapist', title: 'physiotherapist', level: 2, monthlyPay: fromSpecSalary(75_000), monthsRequired: 24, needs: [gate('medical-knowledge', 3), gate('communication', 3)], needsLevel: 'college', teaches: [teach('medical-knowledge', 700), teach('leadership', 400)], stress: 1, happiness: 2, blurb: 'Your own caseload, and your own plan for each.' },
      { id: 'senior-physical-therapist', title: 'senior physiotherapist', level: 3, monthlyPay: fromSpecSalary(105_000), monthsRequired: 48, needs: [gate('medical-knowledge', 4), gate('leadership', 3)], needsLevel: 'college', teaches: [teach('leadership', 600), teach('business-management', 400)], stress: 1, happiness: 2, blurb: 'The complicated recoveries.' },
      { id: 'clinic-director', title: 'clinic director', level: 4, monthlyPay: fromSpecSalary(140_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 4)], needsLevel: 'college', teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'The practice, and everybody working in it.' },
    ],
  },
  {
    id: 'veterinarian',
    name: 'Veterinary Medicine',
    categoryId: 'agriculture',
    blurb: 'Patients who cannot tell you where it hurts.',
    requires: 'secondary',
    levels: [
      { id: 'vet-assistant', title: 'veterinary assistant', level: 1, monthlyPay: fromSpecSalary(32_000), monthsRequired: 0, needs: [], teaches: [teach('medical-knowledge', 700), teach('customer-service', 500)], stress: 0, happiness: 1, blurb: 'Holding, cleaning, and comforting the owners.' },
      { id: 'veterinarian', title: 'veterinarian', level: 2, monthlyPay: fromSpecSalary(95_000), monthsRequired: 24, needs: [gate('medical-knowledge', 4)], needsLevel: 'graduate', teaches: [teach('medical-knowledge', 600), teach('leadership', 400)], stress: 1, happiness: 2, blurb: 'Your own list, and the hard conversations.' },
      { id: 'senior-veterinarian', title: 'senior veterinarian', level: 3, monthlyPay: fromSpecSalary(145_000), monthsRequired: 48, needs: [gate('leadership', 4), gate('medical-knowledge', 5)], needsLevel: 'graduate', teaches: [teach('leadership', 600), teach('business-management', 400)], stress: 1, happiness: 2, blurb: 'The surgery nobody else would attempt.' },
      { id: 'vet-practice-owner', title: 'practice owner', level: 4, monthlyPay: fromSpecSalary(210_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 5)], needsLevel: 'graduate', teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'The practice, and the town’s animals in it.' },
    ],
  },
  // ---- HOSPITALITY --------------------------------------------------------
  {
    id: 'barista',
    name: 'Coffee & Cafés',
    categoryId: 'hospitality',
    blurb: 'The morning rush, and eventually the district.',
    requires: 'none',
    availableFrom: 1975,
    levels: [
      { id: 'barista', title: 'barista', level: 1, monthlyPay: fromSpecSalary(20_000), monthsRequired: 0, needs: [], teaches: [teach('customer-service', 600), teach('communication', 500)], stress: 0, happiness: 1, blurb: 'Two hundred cups before eleven.' },
      { id: 'cafe-shift-supervisor', title: 'shift supervisor', level: 2, monthlyPay: fromSpecSalary(26_000), monthsRequired: 12, needs: [gate('customer-service', 3), gate('leadership', 2)], teaches: [teach('leadership', 500), teach('organization', 500)], stress: 0, happiness: 1, blurb: 'Opening up, and the float.' },
      { id: 'cafe-assistant-manager', title: 'assistant manager', level: 3, monthlyPay: fromSpecSalary(38_000), monthsRequired: 36, needs: [gate('leadership', 3), gate('business-management', 2)], teaches: [teach('business-management', 600)], stress: 1, happiness: 1, blurb: 'Orders, rotas, and the machine that broke.' },
      { id: 'cafe-manager', title: 'café manager', level: 4, monthlyPay: fromSpecSalary(62_000), monthsRequired: 60, needs: [gate('leadership', 4), gate('business-management', 4)], teaches: [teach('business-management', 600), teach('strategic-planning', 400)], stress: 2, happiness: 2, blurb: 'The whole shop, and its takings.' },
      { id: 'cafe-district-manager', title: 'district manager', level: 5, monthlyPay: fromSpecSalary(85_000), monthsRequired: 84, needs: [gate('business-management', 5), gate('strategic-planning', 3)], needsLevel: 'college', teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'A dozen shops and a lot of driving.' },
    ],
  },
  {
    id: 'hotel-management',
    name: 'Hotels & Lodging',
    categoryId: 'hospitality',
    blurb: 'The front desk, and everything behind it.',
    requires: 'none',
    levels: [
      { id: 'front-desk-agent', title: 'front desk agent', level: 1, monthlyPay: fromSpecSalary(24_000), monthsRequired: 0, needs: [], teaches: [teach('customer-service', 600), teach('communication', 500)], stress: 0, happiness: 1, blurb: 'Check-in, complaints, and the night audit.' },
      { id: 'guest-services-manager', title: 'guest services manager', level: 2, monthlyPay: fromSpecSalary(38_000), monthsRequired: 18, needs: [gate('leadership', 2), gate('customer-service', 4)], teaches: [teach('leadership', 600), teach('business-management', 400)], stress: 1, happiness: 1, blurb: 'The lobby is yours to run.' },
      { id: 'hotel-shift-manager', title: 'shift manager', level: 3, monthlyPay: fromSpecSalary(56_000), monthsRequired: 42, needs: [gate('leadership', 4), gate('business-management', 3)], teaches: [teach('business-management', 700)], stress: 1, happiness: 1, blurb: 'Housekeeping, the kitchen and the front, at once.' },
      { id: 'hotel-manager', title: 'hotel manager', level: 4, monthlyPay: fromSpecSalary(88_000), monthsRequired: 66, needs: [gate('leadership', 5), gate('business-management', 4), gate('strategic-planning', 2)], needsLevel: 'college', teaches: [teach('strategic-planning', 500)], stress: 2, happiness: 2, blurb: 'Occupancy, and the whole building’s reputation.' },
      { id: 'hotel-general-manager', title: 'general manager', level: 5, monthlyPay: fromSpecSalary(110_000), monthsRequired: 90, needs: [gate('business-management', 5), gate('strategic-planning', 4), gate('leadership', 5)], needsLevel: 'college', teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'Several properties, and the owners above them.' },
    ],
  },
  {
    id: 'event-planner',
    name: 'Events & Coordination',
    categoryId: 'hospitality',
    blurb: 'A hundred moving parts, on one date that cannot move.',
    requires: 'secondary',
    levels: [
      { id: 'event-coordinator', title: 'event coordinator', level: 1, monthlyPay: fromSpecSalary(35_000), monthsRequired: 0, needs: [], teaches: [teach('organization', 900), teach('communication', 700)], stress: 1, happiness: 1, blurb: 'Lists, suppliers, and the thing that went wrong.' },
      { id: 'senior-event-coordinator', title: 'senior coordinator', level: 2, monthlyPay: fromSpecSalary(55_000), monthsRequired: 24, needs: [gate('organization', 3), gate('communication', 3)], teaches: [teach('leadership', 600), teach('negotiation', 500)], stress: 1, happiness: 2, blurb: 'The clients ask for you.' },
      { id: 'event-manager', title: 'event manager', level: 3, monthlyPay: fromSpecSalary(80_000), monthsRequired: 44, needs: [gate('leadership', 4), gate('organization', 4)], teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'The big ones, and the team running them.' },
      { id: 'event-director', title: 'director of events', level: 4, monthlyPay: fromSpecSalary(110_000), monthsRequired: 66, needs: [gate('leadership', 5), gate('business-management', 4)], teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'The calendar, the venues and the margins.' },
    ],
  },
  {
    id: 'casino-management',
    name: 'Casino & Gaming',
    categoryId: 'hospitality',
    blurb: 'The floor, where the house has to stay ahead.',
    requires: 'secondary',
    levels: [
      { id: 'dealer', title: 'dealer', level: 1, monthlyPay: fromSpecSalary(30_000), monthsRequired: 0, needs: [], needsLicence: 'gaming', teaches: [teach('customer-service', 700), teach('attention-to-detail', 700)], stress: 1, happiness: 0, blurb: 'Fast hands, and a face that gives nothing.' },
      { id: 'pit-boss', title: 'pit boss', level: 2, monthlyPay: fromSpecSalary(52_000), monthsRequired: 24, needs: [gate('attention-to-detail', 3), gate('customer-service', 3)], needsLicence: 'gaming', teaches: [teach('leadership', 600), teach('business-management', 400)], stress: 1, happiness: 1, blurb: 'Watching the tables, and the people at them.' },
      { id: 'casino-floor-manager', title: 'floor manager', level: 3, monthlyPay: fromSpecSalary(85_000), monthsRequired: 48, needs: [gate('leadership', 4), gate('business-management', 3)], needsLicence: 'gaming', teaches: [teach('business-management', 600)], stress: 2, happiness: 1, blurb: 'The whole floor, and its hold.' },
      { id: 'casino-manager', title: 'casino manager', level: 4, monthlyPay: fromSpecSalary(125_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 5)], teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'The house, and everything it owes the regulator.' },
    ],
  },
  // ---- CREATIVE -----------------------------------------------------------
  {
    id: 'photography',
    name: 'Photography',
    categoryId: 'creative',
    blurb: 'Being there when it happens, with the right lens.',
    requires: 'none',
    levels: [
      { id: 'photographer', title: 'photographer', level: 1, monthlyPay: fromSpecSalary(28_000), monthsRequired: 0, needs: [], teaches: [teach('creativity', 900), teach('technical-knowledge', 700)], stress: 0, happiness: 2, blurb: 'Weddings, portraits, and a lot of driving.' },
      { id: 'senior-photographer', title: 'senior photographer', level: 2, monthlyPay: fromSpecSalary(58_000), monthsRequired: 24, needs: [gate('creativity', 4), gate('technical-knowledge', 4)], teaches: [teach('creativity', 600), teach('communication', 500)], stress: 1, happiness: 2, blurb: 'People book you for the way you see it.' },
      { id: 'photography-creative-director', title: 'creative director', level: 3, monthlyPay: fromSpecSalary(105_000), monthsRequired: 48, needs: [gate('leadership', 4), gate('creativity', 5)], teaches: [teach('leadership', 600), teach('business-management', 500)], stress: 2, happiness: 2, blurb: 'The shoot, the crew and the look of it.' },
      { id: 'studio-owner', title: 'studio owner', level: 4, monthlyPay: fromSpecSalary(135_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 5)], teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'The studio, the staff and the bookings.' },
    ],
  },
  {
    id: 'video-producer',
    name: 'Video & Film Production',
    categoryId: 'creative',
    blurb: 'Somebody has to make the thing actually happen.',
    requires: 'none',
    availableFrom: 1978,
    levels: [
      { id: 'video-producer', title: 'video producer', level: 1, monthlyPay: fromSpecSalary(35_000), monthsRequired: 0, needs: [], teaches: [teach('creativity', 800), teach('technical-knowledge', 700)], stress: 0, happiness: 2, blurb: 'Carrying the tripod and calling the times.' },
      { id: 'senior-video-producer', title: 'senior producer', level: 2, monthlyPay: fromSpecSalary(62_000), monthsRequired: 24, needs: [gate('creativity', 4), gate('technical-knowledge', 4)], teaches: [teach('leadership', 600), teach('organization', 600)], stress: 1, happiness: 2, blurb: 'The schedule, the budget and the talent.' },
      { id: 'video-director', title: 'director', level: 3, monthlyPay: fromSpecSalary(95_000), monthsRequired: 48, needs: [gate('leadership', 3), gate('creativity', 5)], teaches: [teach('leadership', 600), teach('strategic-planning', 400)], stress: 1, happiness: 2, blurb: 'What it looks like is your decision.' },
      { id: 'production-manager', title: 'production manager', level: 4, monthlyPay: fromSpecSalary(145_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 4)], needsLevel: 'college', teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'Several productions, and the money across them.' },
    ],
  },
  {
    id: 'writing',
    name: 'Content & Copywriting',
    categoryId: 'creative',
    blurb: 'Words that have to do a job.',
    requires: 'secondary',
    levels: [
      { id: 'junior-writer', title: 'junior writer', level: 1, monthlyPay: fromSpecSalary(42_000), monthsRequired: 0, needs: [], teaches: [teach('communication', 900), teach('creativity', 600)], stress: 0, happiness: 1, blurb: 'Whatever needs writing by Thursday.' },
      { id: 'writer', title: 'writer', level: 2, monthlyPay: fromSpecSalary(62_000), monthsRequired: 24, needs: [gate('communication', 4), gate('creativity', 4)], teaches: [teach('creativity', 700), teach('leadership', 300)], stress: 0, happiness: 2, blurb: 'A voice people recognise.' },
      { id: 'content-manager', title: 'content manager', level: 3, monthlyPay: fromSpecSalary(95_000), monthsRequired: 48, needs: [gate('leadership', 4), gate('communication', 5)], teaches: [teach('leadership', 500), teach('strategic-planning', 400)], stress: 1, happiness: 2, blurb: 'What gets written, and by whom.' },
      { id: 'editorial-director', title: 'editorial director', level: 4, monthlyPay: fromSpecSalary(145_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 4)], needsLevel: 'college', teaches: [teach('business-management', 500)], stress: 2, happiness: 2, blurb: 'Everything the company publishes.' },
    ],
  },
  {
    id: 'illustration',
    name: 'Illustration',
    categoryId: 'creative',
    blurb: 'Drawing the thing that has to be drawn.',
    requires: 'none',
    levels: [
      { id: 'illustrator', title: 'illustrator', level: 1, monthlyPay: fromSpecSalary(40_000), monthsRequired: 0, needs: [], teaches: [teach('creativity', 1000), teach('technical-knowledge', 600)], stress: 0, happiness: 2, blurb: 'Somebody else’s brief, in your own hand.' },
      { id: 'senior-illustrator', title: 'senior illustrator', level: 2, monthlyPay: fromSpecSalary(65_000), monthsRequired: 24, needs: [gate('creativity', 4), gate('technical-knowledge', 3)], teaches: [teach('creativity', 600), teach('communication', 500)], stress: 0, happiness: 2, blurb: 'They come to you for the style.' },
      { id: 'art-director', title: 'art director', level: 3, monthlyPay: fromSpecSalary(100_000), monthsRequired: 48, needs: [gate('creativity', 5), gate('leadership', 3)], teaches: [teach('leadership', 600), teach('business-management', 400)], stress: 1, happiness: 2, blurb: 'The look of the whole thing.' },
      { id: 'illustration-creative-director', title: 'creative director', level: 4, monthlyPay: fromSpecSalary(130_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 4)], teaches: [teach('business-management', 500)], stress: 2, happiness: 2, blurb: 'The studio’s work, and its name.' },
    ],
  },
  {
    id: 'brand-designer',
    name: 'Brand & Identity Design',
    categoryId: 'creative',
    blurb: 'What a company looks like to everybody else.',
    requires: 'none',
    availableFrom: 1980,
    levels: [
      { id: 'junior-brand-designer', title: 'junior brand designer', level: 1, monthlyPay: fromSpecSalary(48_000), monthsRequired: 0, needs: [], teaches: [teach('creativity', 900), teach('communication', 600)], stress: 0, happiness: 2, blurb: 'Sixty logos, and one that survives.' },
      { id: 'brand-designer', title: 'brand designer', level: 2, monthlyPay: fromSpecSalary(72_000), monthsRequired: 24, needs: [gate('creativity', 3), gate('communication', 3)], teaches: [teach('creativity', 600), teach('technical-knowledge', 500)], stress: 1, happiness: 2, blurb: 'The identity is yours to argue for.' },
      { id: 'lead-brand-designer', title: 'lead designer', level: 3, monthlyPay: fromSpecSalary(105_000), monthsRequired: 48, needs: [gate('creativity', 4), gate('leadership', 3)], teaches: [teach('leadership', 600), teach('strategic-planning', 400)], stress: 1, happiness: 2, blurb: 'A team, and a house style.' },
      { id: 'brand-creative-director', title: 'creative director', level: 4, monthlyPay: fromSpecSalary(135_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 4)], teaches: [teach('business-management', 500)], stress: 2, happiness: 2, blurb: 'Every mark the company puts its name on.' },
    ],
  },
  {
    id: 'musician',
    name: 'Music & Performance',
    categoryId: 'entertainment',
    blurb: 'Playing for money, which is a different craft from playing.',
    requires: 'none',
    levels: [
      { id: 'performer', title: 'performer', level: 1, monthlyPay: fromSpecSalary(24_000), monthsRequired: 0, needs: [], teaches: [teach('creativity', 1000), teach('communication', 600)], stress: 0, happiness: 2, blurb: 'Bars, weddings, and a van that barely runs.' },
      { id: 'professional-musician', title: 'professional musician', level: 2, monthlyPay: fromSpecSalary(55_000), monthsRequired: 24, needs: [gate('creativity', 4), gate('communication', 4)], teaches: [teach('creativity', 700), teach('leadership', 400)], stress: 1, happiness: 2, blurb: 'It pays the rent, most months.' },
      { id: 'recording-artist', title: 'recording artist', level: 3, monthlyPay: fromSpecSalary(110_000), monthsRequired: 48, needs: [gate('creativity', 5), gate('leadership', 2)], teaches: [teach('leadership', 600), teach('business-management', 400)], stress: 2, happiness: 2, blurb: 'Somebody else pays for the studio now.' },
      { id: 'music-producer', title: 'producer', level: 4, monthlyPay: fromSpecSalary(165_000), monthsRequired: 72, needs: [gate('leadership', 4), gate('creativity', 5)], teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'Other people’s records, made better.' },
      { id: 'label-manager', title: 'label manager', level: 5, monthlyPay: fromSpecSalary(180_000), monthsRequired: 96, needs: [gate('leadership', 5), gate('business-management', 5)], teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'Who gets signed, and who does not.' },
    ],
  },
  // ---- PUBLIC SERVICE -----------------------------------------------------
  {
    id: 'firefighter',
    name: 'Fire & Emergency Services',
    categoryId: 'public-service',
    blurb: 'Going towards it while everybody else leaves.',
    requires: 'secondary',
    levels: [
      { id: 'firefighter', title: 'firefighter', level: 1, monthlyPay: fromSpecSalary(36_000), monthsRequired: 0, needs: [], needsLicence: 'firefighter', teaches: [teach('physical-work', 700), teach('teamwork', 800)], stress: 2, happiness: 1, blurb: 'Long quiet shifts, and the ones that are not.' },
      { id: 'driver-operator', title: 'driver/operator', level: 2, monthlyPay: fromSpecSalary(50_000), monthsRequired: 18, needs: [gate('teamwork', 3), gate('physical-work', 3)], needsLicence: 'firefighter', teaches: [teach('technical-knowledge', 700), teach('leadership', 500)], stress: 2, happiness: 1, blurb: 'The pump, the ladder, and getting there.' },
      { id: 'fire-lieutenant', title: 'lieutenant', level: 3, monthlyPay: fromSpecSalary(72_000), monthsRequired: 42, needs: [gate('leadership', 4), gate('communication', 3)], needsLicence: 'firefighter', teaches: [teach('leadership', 700), teach('communication', 500)], stress: 2, happiness: 1, blurb: 'A crew, and the decisions inside a burning house.' },
      { id: 'fire-captain', title: 'captain', level: 4, monthlyPay: fromSpecSalary(98_000), monthsRequired: 66, needs: [gate('leadership', 5), gate('strategic-planning', 3)], teaches: [teach('strategic-planning', 500)], stress: 2, happiness: 2, blurb: 'The station, and everybody in it.' },
      { id: 'fire-chief', title: 'fire chief', level: 5, monthlyPay: fromSpecSalary(125_000), monthsRequired: 90, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 4)], needsLevel: 'college', teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'The whole service, and the council’s budget for it.' },
    ],
  },
  {
    id: 'government-clerk',
    name: 'Government & Administration',
    categoryId: 'public-service',
    blurb: 'The machinery of the place, from the inside.',
    requires: 'secondary',
    levels: [
      { id: 'government-clerk', title: 'government clerk', level: 1, monthlyPay: fromSpecSalary(28_000), monthsRequired: 0, needs: [], teaches: [teach('organization', 800), teach('attention-to-detail', 600)], stress: 0, happiness: -1, blurb: 'Forms, and the people who filled them in wrong.' },
      { id: 'administrative-specialist', title: 'administrative specialist', level: 2, monthlyPay: fromSpecSalary(42_000), monthsRequired: 20, needs: [gate('organization', 4), gate('attention-to-detail', 2)], teaches: [teach('communication', 600), teach('leadership', 400)], stress: 0, happiness: 0, blurb: 'You know how it actually works.' },
      { id: 'government-supervisor', title: 'supervisor', level: 3, monthlyPay: fromSpecSalary(65_000), monthsRequired: 44, needs: [gate('leadership', 4), gate('communication', 3)], needsLevel: 'college', teaches: [teach('leadership', 600), teach('business-management', 500)], stress: 1, happiness: 1, blurb: 'A section, and its backlog.' },
      { id: 'government-manager', title: 'manager', level: 4, monthlyPay: fromSpecSalary(95_000), monthsRequired: 68, needs: [gate('leadership', 4), gate('business-management', 3)], needsLevel: 'college', teaches: [teach('strategic-planning', 500)], stress: 2, happiness: 1, blurb: 'A department, and the politics above it.' },
      { id: 'government-director', title: 'director', level: 5, monthlyPay: fromSpecSalary(105_000), monthsRequired: 92, needs: [gate('leadership', 5), gate('business-management', 5), gate('strategic-planning', 4)], needsLevel: 'college', teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 2, blurb: 'What the office is for, and what it stops doing.' },
    ],
  },
  {
    id: 'security-guard',
    name: 'Security & Loss Prevention',
    categoryId: 'public-service',
    blurb: 'Watching, mostly, and then not.',
    requires: 'none',
    levels: [
      { id: 'security-guard', title: 'security guard', level: 1, monthlyPay: fromSpecSalary(28_000), monthsRequired: 0, needs: [], teaches: [teach('attention-to-detail', 700), teach('teamwork', 500)], stress: 1, happiness: -1, blurb: 'Nights, and a long corridor.' },
      { id: 'security-supervisor', title: 'security supervisor', level: 2, monthlyPay: fromSpecSalary(45_000), monthsRequired: 24, needs: [gate('attention-to-detail', 3), gate('teamwork', 2)], teaches: [teach('leadership', 600), teach('organization', 500)], stress: 1, happiness: 0, blurb: 'The roster, and the incident book.' },
      { id: 'site-security-manager', title: 'security manager', level: 3, monthlyPay: fromSpecSalary(72_000), monthsRequired: 48, needs: [gate('leadership', 4), gate('organization', 3)], teaches: [teach('business-management', 600)], stress: 2, happiness: 1, blurb: 'The site, and everything that goes missing from it.' },
      { id: 'security-director', title: 'director of security', level: 4, monthlyPay: fromSpecSalary(125_000), monthsRequired: 72, needs: [gate('leadership', 5), gate('business-management', 4)], teaches: [teach('strategic-planning', 600)], stress: 2, happiness: 1, blurb: 'Every site, and the policy across them.' },
    ],
  },
  // ---- PERSONAL SERVICES --------------------------------------------------
  {
    id: 'personal-trainer',
    name: 'Personal Training & Fitness',
    categoryId: 'personal-services',
    blurb: 'Other people’s discipline, for a living.',
    requires: 'none',
    availableFrom: 1980,
    levels: [
      { id: 'fitness-coach', title: 'fitness coach', level: 1, monthlyPay: fromSpecSalary(28_000), monthsRequired: 0, needs: [], needsLicence: 'fitness', teaches: [teach('communication', 700), teach('physical-work', 600)], stress: -1, happiness: 2, blurb: 'Early mornings, and people who cancel.' },
      { id: 'personal-trainer', title: 'personal trainer', level: 2, monthlyPay: fromSpecSalary(50_000), monthsRequired: 20, needs: [gate('communication', 3), gate('leadership', 2)], needsLicence: 'fitness', teaches: [teach('leadership', 600), teach('communication', 600)], stress: 0, happiness: 2, blurb: 'A book of clients who stay.' },
      { id: 'senior-trainer', title: 'senior trainer', level: 3, monthlyPay: fromSpecSalary(75_000), monthsRequired: 44, needs: [gate('leadership', 4), gate('communication', 5)], needsLicence: 'fitness', teaches: [teach('business-management', 500)], stress: 1, happiness: 2, blurb: 'You train the trainers now.' },
      { id: 'gym-manager', title: 'gym manager', level: 4, monthlyPay: fromSpecSalary(105_000), monthsRequired: 68, needs: [gate('leadership', 5), gate('business-management', 4)], teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'The floor, the memberships and the renewals.' },
    ],
  },
  {
    id: 'massage-therapist',
    name: 'Massage & Bodywork',
    categoryId: 'personal-services',
    blurb: 'Hands, and knowing what is underneath them.',
    requires: 'none',
    availableFrom: 1980,
    levels: [
      { id: 'massage-therapist', title: 'massage therapist', level: 1, monthlyPay: fromSpecSalary(36_000), monthsRequired: 0, needs: [], needsLicence: 'massage', teaches: [teach('customer-service', 700), teach('medical-knowledge', 500)], stress: 0, happiness: 2, blurb: 'Six a day, and your own back to think about.' },
      { id: 'senior-massage-therapist', title: 'senior therapist', level: 2, monthlyPay: fromSpecSalary(58_000), monthsRequired: 24, needs: [gate('customer-service', 3), gate('medical-knowledge', 2)], needsLicence: 'massage', teaches: [teach('communication', 600), teach('leadership', 400)], stress: 0, happiness: 2, blurb: 'The clients with real injuries ask for you.' },
      { id: 'wellness-manager', title: 'wellness manager', level: 3, monthlyPay: fromSpecSalary(85_000), monthsRequired: 44, needs: [gate('leadership', 3), gate('communication', 3)], teaches: [teach('business-management', 600)], stress: 1, happiness: 2, blurb: 'The rooms, the rota and the retail.' },
      { id: 'spa-director', title: 'spa director', level: 4, monthlyPay: fromSpecSalary(120_000), monthsRequired: 66, needs: [gate('leadership', 5), gate('business-management', 4)], teaches: [teach('strategic-planning', 500)], stress: 2, happiness: 2, blurb: 'The whole spa, and what it feels like to walk into.' },
    ],
  },
  {
    // 'pet-care' rather than 'pet-groomer', because the rung a person walks
    // in on is the bather — see the note on the entry rung below.
    id: 'pet-care',
    name: 'Pet Grooming & Care',
    categoryId: 'personal-services',
    blurb: 'Animals, and the people who love them.',
    requires: 'none',
    levels: [
      /**
       * NO TICKET ON THE FRONT DOOR, deliberately, and the seam test is why.
       * Every other ladder in Personal Services — stylist, trainer, masseur —
       * demands its licence at the entry rung, which left the whole bubble
       * sealed to a school leaver: four locks and no way in. Bathing and
       * brushing is genuinely where an unqualified person starts, so the
       * grooming ticket sits on the rung above instead.
       */
      { id: 'pet-bather', title: 'pet bather', level: 1, monthlyPay: fromSpecSalary(26_000), monthsRequired: 0, needs: [], teaches: [teach('customer-service', 700), teach('technical-knowledge', 500)], stress: 0, happiness: 1, blurb: 'Wet through by ten, and bitten by eleven.' },
      { id: 'pet-groomer', title: 'pet groomer', level: 2, monthlyPay: fromSpecSalary(45_000), monthsRequired: 24, needs: [gate('customer-service', 3), gate('technical-knowledge', 2)], needsLicence: 'grooming', teaches: [teach('creativity', 500), teach('leadership', 400)], stress: 0, happiness: 2, blurb: 'The difficult dogs come to you, and now you have the training for them.' },
      { id: 'grooming-manager', title: 'grooming manager', level: 3, monthlyPay: fromSpecSalary(68_000), monthsRequired: 44, needs: [gate('leadership', 3), gate('customer-service', 4)], teaches: [teach('business-management', 600)], stress: 1, happiness: 2, blurb: 'The book, the staff and the shop.' },
      { id: 'grooming-salon-owner', title: 'salon owner', level: 4, monthlyPay: fromSpecSalary(95_000), monthsRequired: 66, needs: [gate('leadership', 4), gate('business-management', 4)], teaches: [teach('business-management', 500)], stress: 2, happiness: 2, blurb: 'Your own shop, and the regulars in it.' },
    ],
  },
  // ---- AGRICULTURE --------------------------------------------------------
  {
    id: 'environmental-scientist',
    name: 'Environmental Science',
    categoryId: 'agriculture',
    blurb: 'Measuring what is happening to the place.',
    requires: 'secondary',
    availableFrom: 1972,
    levels: [
      { id: 'environmental-technician', title: 'environmental technician', level: 1, monthlyPay: fromSpecSalary(38_000), monthsRequired: 0, needs: [], teaches: [teach('technical-knowledge', 800), teach('attention-to-detail', 700)], stress: 0, happiness: 1, blurb: 'Samples, in weather that does not care.' },
      { id: 'environmental-scientist', title: 'environmental scientist', level: 2, monthlyPay: fromSpecSalary(62_000), monthsRequired: 22, needs: [gate('technical-knowledge', 4), gate('attention-to-detail', 3)], needsLevel: 'college', teaches: [teach('problem-solving', 800), teach('data-analysis', 600)], stress: 0, happiness: 2, blurb: 'The report goes out under your name.' },
      { id: 'senior-environmental-scientist', title: 'senior scientist', level: 3, monthlyPay: fromSpecSalary(105_000), monthsRequired: 46, needs: [gate('problem-solving', 4), gate('leadership', 3)], needsLevel: 'college', teaches: [teach('leadership', 600), teach('strategic-planning', 500)], stress: 1, happiness: 2, blurb: 'The studies people argue about in council.' },
      { id: 'research-manager', title: 'research manager', level: 4, monthlyPay: fromSpecSalary(150_000), monthsRequired: 70, needs: [gate('leadership', 5), gate('business-management', 4), gate('strategic-planning', 4)], needsLevel: 'graduate', teaches: [teach('business-management', 600)], stress: 2, happiness: 2, blurb: 'What gets researched, and who funds it.' },
    ],
  },
]
