/**
 * Import Company Policies from greythr into EOD Portal
 * Source: colorpapersindia.greythr.com/ngxa/employee/setup/forms-policy/1
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const ADMIN_ID = 1; // Ravi Pardeep Shrivastav

const policies = [
  {
    title: 'Employee Attendance & Leave Policy',
    slug: 'employee-attendance-leave-policy',
    category: 'attendance',
    summary: 'This policy outlines the guidelines for attendance, leave entitlements, and procedures for requesting time off. It covers various types of leaves, ensuring clear expectations for maintaining attendance and managing absences.',
    content: `# Employee Attendance & Leave Policy

## 1. Purpose
This policy outlines the guidelines for attendance, leave entitlements, and procedures for requesting time off at Color Papers India Pvt. Ltd. It ensures clear expectations for maintaining attendance and managing absences.

## 2. Attendance Guidelines
- All employees are expected to be present and punctual during their designated working hours (Monday to Saturday).
- Employees must clock in and clock out using the official attendance system (biometric/app).
- Habitual late arrivals or early departures may be treated as a half-day absence.

## 3. Leave Types
- **Privileged Leave (PL):** 1 day credited per month; can be carry-forwarded up to a limit.
- **Leave on Pay (LOP):** Deducted from salary if no balance is available.
- **Comp-Off (CF):** Earned by working on a declared holiday or weekly off.
- **Casual/Sick Leave:** As per company policy communicated annually.

## 4. Leave Application Procedure
- Employees must apply for leave in advance (minimum 1 day prior for planned leaves).
- Emergency leaves must be intimated to the reporting manager on the same day.
- All leave requests must be submitted through the HR system and approved by the manager.

## 5. Unapproved Absences
- Absence without prior approval or intimation will be treated as Leave Without Pay (LWP).
- Continuous absence of more than 3 working days without information may lead to disciplinary action.

## 6. Holidays
- The company declares a list of public/national holidays at the beginning of each financial year.
- Location-specific holidays (Mumbai/Lucknow) are communicated separately.

## 7. Compliance
Non-compliance with this policy may result in disciplinary proceedings as per the company's Code of Conduct.`,
    isMandatory: true,
    effectiveDate: '2025-04-01',
  },
  {
    title: 'Performance Improvement Plan (PIP) Policy',
    slug: 'performance-improvement-plan-pip-policy',
    category: 'conduct',
    summary: 'The Performance Improvement Plan (PIP) is designed to help employees improve their performance in specific areas. It outlines clear goals, provides support, and sets timelines for progress. The aim is to assist employees in meeting performance expectations and contributing effectively to the team.',
    content: `# Performance Improvement Plan (PIP) Policy

## 1. Purpose
The Performance Improvement Plan (PIP) is a structured tool designed to help employees improve their performance in specific areas. It outlines clear goals, provides support, and sets timelines for progress.

## 2. Scope
This policy applies to all permanent employees of Color Papers India Pvt. Ltd. who are not meeting performance expectations.

## 3. When is a PIP Initiated?
A PIP may be initiated when:
- An employee consistently fails to meet key performance indicators (KPIs).
- Performance reviews indicate a significant gap between expected and actual output.
- Behavioral or conduct issues are impacting work quality.

## 4. PIP Process
**Step 1 — Identification:** The reporting manager identifies performance gaps and discusses them with HR.
**Step 2 — Meeting:** A formal meeting is held with the employee to discuss the concerns and the PIP framework.
**Step 3 — PIP Document:** A written PIP document is prepared specifying: goals, timelines (typically 30–90 days), support resources, and review milestones.
**Step 4 — Monitoring:** Regular check-ins (weekly/bi-weekly) are conducted to track progress.
**Step 5 — Outcome:** Upon completion, one of three outcomes applies:
  - Successfully met goals → PIP closed; employee continues.
  - Partial improvement → PIP may be extended.
  - No improvement → Escalation to HR for further action.

## 5. Employee Rights
- The employee has the right to respond to the PIP and submit comments.
- Employees may request HR support or mediation at any stage.

## 6. Confidentiality
PIP documents are strictly confidential and are maintained in the employee's personnel file.`,
    isMandatory: false,
    effectiveDate: '2025-04-01',
  },
  {
    title: 'Anti-discrimination Policy',
    slug: 'anti-discrimination-policy',
    category: 'conduct',
    summary: 'Our Anti-discrimination Policy ensures a workplace where everyone is treated with respect and fairness, regardless of race, gender, religion, age, or any other personal characteristic. We are committed to maintaining an inclusive and supportive environment for all employees.',
    content: `# Anti-discrimination Policy

## 1. Purpose
Color Papers India Pvt. Ltd. is committed to providing a workplace free from discrimination, harassment, and bias. This policy ensures every employee is treated with dignity and respect.

## 2. Scope
This policy applies to all employees, contractors, interns, and visitors at all company locations.

## 3. Prohibited Conduct
Discrimination or harassment on the basis of any of the following is strictly prohibited:
- Race, caste, or ethnicity
- Gender or gender identity
- Religion or belief
- Age
- Disability (physical or mental)
- Marital or family status
- Sexual orientation
- National origin

## 4. Forms of Discrimination
- **Direct Discrimination:** Treating someone less favourably because of a protected characteristic.
- **Indirect Discrimination:** Applying a rule or policy that disadvantages people with a protected characteristic.
- **Harassment:** Unwanted conduct related to a protected characteristic that violates a person's dignity or creates an intimidating, hostile, degrading, or offensive environment.

## 5. Reporting Procedure
Any employee who experiences or witnesses discrimination must:
1. Report the incident to their HR representative or use the internal grievance mechanism.
2. Complaints will be treated with strict confidentiality.
3. Investigations will be completed within 30 working days.

## 6. Consequences
Any employee found to have engaged in discriminatory behaviour will be subject to disciplinary action, up to and including termination of employment.

## 7. Non-Retaliation
Retaliation against any employee who reports discrimination in good faith is strictly prohibited.`,
    isMandatory: true,
    effectiveDate: '2025-04-01',
  },
  {
    title: 'Referral Policy',
    slug: 'referral-policy',
    category: 'general',
    summary: 'This policy outlines the employee referral programme, including eligibility criteria, referral process, and rewards for successfully referring candidates who are hired and complete the probation period.',
    content: `# Referral Policy

## 1. Purpose
The Employee Referral Programme encourages existing employees to recommend qualified candidates for open positions. This policy outlines the eligibility, process, and incentives for successful referrals.

## 2. Eligibility
- All permanent employees of Color Papers India Pvt. Ltd. are eligible to participate.
- Employees cannot refer immediate family members or refer for positions they directly oversee.
- HR team members are not eligible for referral rewards for positions they are managing.

## 3. Referral Process
1. The referring employee submits the candidate's resume/details to the HR department with a referral note.
2. HR screens the candidate and initiates the standard recruitment process.
3. The referral must be made before the candidate applies through any other channel.

## 4. Referral Reward
- A referral reward is paid to the referring employee after the referred candidate:
  - Is successfully hired, AND
  - Completes the probation period (typically 3–6 months) without any disciplinary issues.
- The reward amount will be communicated by HR for each open position.

## 5. Disqualification
Referral rewards will not be paid if:
- The referred candidate is already in the company's database.
- The candidate was referred by multiple employees (first referral takes precedence).
- The referred candidate leaves before completing probation.

## 6. Payment
Referral rewards will be processed through the monthly payroll after confirmation from HR.`,
    isMandatory: false,
    effectiveDate: '2025-04-01',
  },
  {
    title: 'Work From Home Policy',
    slug: 'work-from-home-policy',
    category: 'general',
    summary: 'This policy defines the guidelines and expectations for employees working remotely. It covers eligibility, approval process, communication standards, and responsibilities to ensure productivity and collaboration while working from home.',
    content: `# Work From Home Policy

## 1. Purpose
This policy defines the guidelines and expectations for employees working remotely (Work From Home — WFH) at Color Papers India Pvt. Ltd. It ensures that remote work arrangements maintain productivity, communication, and accountability.

## 2. Eligibility
- WFH may be permitted based on the nature of the role and management approval.
- Employees must have completed their probation period to be eligible for WFH.
- WFH is a privilege, not a right, and may be withdrawn if misused.

## 3. Approval Process
1. Employees must request WFH at least 24 hours in advance (except in emergencies).
2. Requests must be submitted via the HR system and approved by the reporting manager.
3. Unplanned WFH (illness, emergency) must be communicated to the manager by 9:30 AM on the day.

## 4. Responsibilities While WFH
- Employees must be reachable during standard working hours (10:00 AM – 7:00 PM).
- Attend all scheduled meetings and respond to messages within a reasonable time.
- Maintain the same standard of work quality and output as in the office.
- Mark attendance as WFH in the HR system.

## 5. Equipment & Security
- Employees are responsible for their own internet connectivity.
- Company data must be accessed only through secure connections (VPN if provided).
- Confidential documents must not be printed or stored locally.

## 6. Misuse
WFH approval may be revoked permanently if found to be misused. Misuse includes unavailability during working hours, poor output, or security breaches.`,
    isMandatory: false,
    effectiveDate: '2025-04-01',
  },
  {
    title: 'Personal Purchases on Company Address Policy',
    slug: 'personal-purchases-on-company-address-policy',
    category: 'conduct',
    summary: 'This policy governs the use of the company address for personal deliveries and purchases. Employees are advised to avoid using the office address for personal orders to maintain a professional work environment.',
    content: `# Personal Purchases on Company Address Policy

## 1. Purpose
This policy addresses the use of the company's registered or branch address for personal deliveries and purchases by employees.

## 2. Policy Statement
Color Papers India Pvt. Ltd. discourages the use of the company address for personal deliveries. The company address is meant for official business correspondence and deliveries only.

## 3. Prohibited Activities
- Using the company address for personal e-commerce orders (Amazon, Flipkart, Meesho, etc.).
- Receiving personal courier packages or parcels at the office reception.
- Using the company's GST number for personal purchases to avail GST benefits.

## 4. Permitted Exceptions
In genuine cases (e.g., employee safety or convenience), one-time exceptions may be permitted with prior approval from the HR/Admin department.

## 5. Consequences
- First violation: Verbal warning.
- Repeat violations: Written warning and possible recovery of any costs incurred by the company.
- Misuse of the company's GST number: Disciplinary action as per the company's Code of Conduct.

## 6. Responsibility
All employees are responsible for ensuring that their personal deliveries are directed to their personal address. The office admin/reception is not obligated to accept or store personal packages.`,
    isMandatory: true,
    effectiveDate: '2025-04-01',
  },
  {
    title: 'Weekly Off (Saturday) & Weekend Work Policy',
    slug: 'weekly-off-saturday-weekend-work-policy',
    category: 'attendance',
    summary: 'This policy outlines the guidelines for weekly off on Saturdays and the procedures for employees required to work on weekends. It covers compensation, comp-off entitlement, and the approval process for weekend work.',
    content: `# Weekly Off (Saturday) & Weekend Work Policy

## 1. Purpose
This policy outlines the weekly off entitlements and the procedures and compensation for employees who are required to work on Saturdays or Sundays.

## 2. Weekly Off
- **Sunday** is a fixed weekly off for all employees across all locations.
- **Saturday** work schedule is as per the shift assignment or location-specific guidelines communicated by HR.

## 3. Working on a Weekly Off (Saturday/Sunday)
If an employee is required to work on their weekly off:
- Prior approval from the reporting manager and HR must be obtained.
- The approved weekend work will be recorded in the attendance system.

## 4. Compensation for Weekend Work
Employees who work on their weekly off are entitled to:
- **Comp-Off:** One compensatory off day for each weekly-off day worked, to be availed within 60 days.
- Comp-off requests must be submitted and approved through the HR portal.

## 5. Overtime
Working beyond standard shift hours on weekdays or weekends may be eligible for overtime compensation as per the company's Overtime Policy.

## 6. No Implicit Approval
Working on a weekend without prior approval will not automatically entitle the employee to a comp-off or overtime payment. Approval must always be obtained in advance except in genuine emergencies.

## 7. Compliance
Employees and managers are responsible for ensuring that weekend work is properly documented and compensated in a timely manner.`,
    isMandatory: true,
    effectiveDate: '2025-04-01',
  },
];

async function main() {
  console.log('Adding policies to EOD portal...\n');

  let added = 0, skipped = 0;

  for (const pol of policies) {
    // Check if already exists
    const existing = await p.policy.findFirst({
      where: { OR: [{ slug: pol.slug }, { title: pol.title }] }
    });

    if (existing) {
      console.log(`⏭  SKIP (already exists): ${pol.title}`);
      skipped++;
      continue;
    }

    await p.policy.create({
      data: {
        title:         pol.title,
        slug:          pol.slug,
        category:      pol.category,
        content:       pol.content,
        summary:       pol.summary,
        version:       1,
        effectiveDate: pol.effectiveDate,
        isActive:      true,
        isMandatory:   pol.isMandatory,
        createdBy:     ADMIN_ID,
      }
    });

    console.log(`✅ ADDED: ${pol.title}`);
    added++;
  }

  console.log(`\n─────────────────────────────────`);
  console.log(`Added : ${added}`);
  console.log(`Skipped (already exist): ${skipped}`);
  console.log(`Total : ${policies.length}`);
}

main().catch(console.error).finally(() => p.$disconnect());
