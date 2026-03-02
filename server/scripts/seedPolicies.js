/**
 * Seed Script: Import greytHR policies into the database
 * Run: cd server && node scripts/seedPolicies.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-');
}

const policies = [
  // ─── 1. PIP Policy ───
  {
    title: 'Performance Improvement Plan (PIP) Policy',
    slug: 'performance-improvement-plan-policy',
    category: 'conduct',
    summary: 'Defines the structured process for addressing employee performance issues through formal Performance Improvement Plans, including timelines, expectations, and consequences.',
    isMandatory: true,
    content: `# Performance Improvement Plan (PIP) Policy

## 1. Purpose
This policy provides a structured approach to addressing employee performance issues. A Performance Improvement Plan (PIP) is a formal document that outlines specific areas where an employee's performance does not meet expectations and provides a clear path for improvement.

## 2. Scope
This policy applies to all employees of Color Papers India Private Limited and its subsidiary companies, regardless of their position or tenure.

## 3. When a PIP is Initiated
A PIP may be initiated when:
- An employee consistently fails to meet job requirements or performance standards
- Performance reviews indicate below-satisfactory ratings over consecutive review periods
- The employee's manager and HR determine that a formal improvement plan is necessary
- Verbal and informal coaching has not resulted in satisfactory improvement

## 4. PIP Process

### 4.1 Identification
The manager identifies specific performance gaps with documented evidence and consults with HR before initiating a PIP.

### 4.2 PIP Meeting
A meeting is scheduled with the employee, their manager, and an HR representative. During this meeting:
- Specific performance gaps are discussed with documented examples
- Clear, measurable improvement goals are established
- A timeline for improvement (typically 30-90 days) is set
- Resources and support available to the employee are outlined
- Consequences of not meeting improvement goals are communicated

### 4.3 Documentation
The PIP document includes:
- Employee name, designation, and department
- Date of PIP initiation
- Specific performance areas requiring improvement
- Measurable goals and targets
- Timeline for achieving each goal
- Support and resources to be provided
- Check-in/review schedule
- Consequences of non-improvement
- Signatures of employee, manager, and HR

### 4.4 Monitoring and Review
- Regular check-ins (weekly or bi-weekly) are conducted
- Progress is documented at each review point
- The employee receives ongoing feedback and coaching
- Adjustments to the plan may be made if circumstances warrant

### 4.5 Outcomes
At the end of the PIP period, one of the following outcomes occurs:
- **Successful Completion**: Employee meets all improvement goals; PIP is closed, and regular performance management resumes
- **Extension**: Significant progress shown but goals not fully met; PIP may be extended once for up to 30 additional days
- **Unsuccessful**: Employee fails to meet improvement goals; further action may include role change, demotion, or termination

## 5. Employee Rights
- The employee has the right to understand the specific performance concerns
- The employee may request clarification on goals or expectations
- The employee may provide their perspective and any mitigating circumstances
- The employee may escalate concerns to senior HR leadership

## 6. Confidentiality
All PIP-related discussions and documents are confidential and shared only with relevant parties (employee, manager, HR).

## 7. Effective Date
This policy is effective immediately and supersedes any previous performance improvement procedures.`,
    sections: [
      { title: 'Purpose', content: 'This policy provides a structured approach to addressing employee performance issues through formal Performance Improvement Plans.', sortOrder: 0 },
      { title: 'Scope', content: 'Applies to all employees of Color Papers India Private Limited and subsidiaries, regardless of position or tenure.', sortOrder: 1 },
      { title: 'When a PIP is Initiated', content: 'Consistently failing to meet requirements, below-satisfactory reviews, manager and HR determination, or when informal coaching has not worked.', sortOrder: 2 },
      { title: 'PIP Process', content: 'Identification → PIP Meeting → Documentation → Monitoring & Review → Outcomes (Successful/Extension/Unsuccessful).', sortOrder: 3, isEditable: true },
      { title: 'Employee Rights', content: 'Right to understand concerns, request clarification, provide perspective, and escalate to senior HR.', sortOrder: 4 },
      { title: 'Confidentiality', content: 'All PIP discussions and documents are confidential, shared only with relevant parties.', sortOrder: 5 },
    ],
    protectionScore: 82,
    scoreBreakdown: JSON.stringify({ legal: 80, compliance: 85, clarity: 85, enforceability: 78, completeness: 82 }),
  },

  // ─── 2. Employee Attendance Policy ───
  {
    title: 'Employee Attendance Policy',
    slug: 'employee-attendance-policy',
    category: 'attendance',
    summary: 'Establishes attendance expectations, punctuality requirements, leave procedures, and consequences for non-compliance to ensure smooth business operations.',
    isMandatory: true,
    content: `# Employee Attendance Policy

## 1. Purpose
This policy establishes the expectations and guidelines for employee attendance and punctuality. Regular and timely attendance is essential for the smooth operation of our organization.

## 2. Scope
This policy applies to all employees across all locations and companies under Color Papers India Private Limited.

## 3. Working Hours
- Standard office hours: 9:00 AM to 6:00 PM, Monday through Saturday (or as defined by shift)
- A grace period of 15 minutes is provided for arrival
- Employees arriving after the grace period will be marked as "Late"
- Three instances of late arrival in a month will result in a half-day deduction

## 4. Attendance Recording
- All employees must record their attendance daily through the company's attendance system
- Check-in upon arrival and check-out at departure are mandatory
- Failure to record attendance may result in the day being marked as absent
- Biometric or system-based attendance is considered the official record

## 5. Absence Reporting
- In case of unplanned absence, the employee must notify their immediate supervisor before the start of the workday or as soon as possible
- Notification should be via phone call or message; email alone is not sufficient for same-day absence
- Extended absence (more than 2 consecutive days) requires supporting documentation (medical certificate, etc.)

## 6. Leave Application
- All planned leaves must be applied for in advance through the leave management system
- Prior approval from the reporting manager is required before availing leave
- Leave without prior approval (except emergencies) will be treated as unauthorized absence

## 7. Unauthorized Absence
- Unauthorized absence of 3 or more consecutive days without intimation may be treated as abandonment of service
- Repeated unauthorized absences will lead to disciplinary action including:
  - First instance: Written warning
  - Second instance: Final warning with salary deduction
  - Third instance: Termination of employment

## 8. Work From Home
- Work from home is granted on a case-by-case basis with prior approval
- Employees working from home must be available during standard working hours
- WFH requests must be submitted at least 24 hours in advance (except emergencies)
- Refer to the Work From Home Policy for detailed guidelines

## 9. Compensatory Off
- Employees required to work on holidays or weekends may be eligible for compensatory off
- Comp-off must be availed within 30 days of the extra working day
- Prior approval from manager is required for both the extra work and the comp-off

## 10. Compliance
Failure to comply with this attendance policy may result in disciplinary action, including warnings, pay deductions, and termination.

## 11. Effective Date
This policy is effective immediately and will be reviewed annually.`,
    sections: [
      { title: 'Purpose', content: 'Establishes expectations for employee attendance and punctuality essential for smooth operations.', sortOrder: 0 },
      { title: 'Working Hours', content: 'Standard 9:00 AM - 6:00 PM, Mon-Sat. 15-min grace period. 3 late arrivals = half-day deduction.', sortOrder: 1, isEditable: true },
      { title: 'Attendance Recording', content: 'Daily check-in/check-out mandatory. Failure to record = marked absent.', sortOrder: 2 },
      { title: 'Absence Reporting', content: 'Notify supervisor before workday start. Extended absence (2+ days) needs documentation.', sortOrder: 3 },
      { title: 'Leave Application', content: 'Planned leaves must be pre-applied and approved. Leave without approval = unauthorized absence.', sortOrder: 4 },
      { title: 'Unauthorized Absence', content: '3+ days unauthorized = abandonment. Progressive discipline: warning → final warning → termination.', sortOrder: 5 },
      { title: 'Compensatory Off', content: 'Comp-off for holiday/weekend work, must be availed within 30 days with manager approval.', sortOrder: 6, isEditable: true },
    ],
    protectionScore: 88,
    scoreBreakdown: JSON.stringify({ legal: 90, compliance: 92, clarity: 88, enforceability: 85, completeness: 85 }),
  },

  // ─── 3. Work From Home Policy ───
  {
    title: 'Work From Home Policy',
    slug: 'work-from-home-policy',
    category: 'attendance',
    summary: 'Defines the guidelines, eligibility, and procedures for working from home, including expectations for availability, productivity, and communication.',
    isMandatory: true,
    content: `# Work From Home Policy

## 1. Purpose
This policy provides guidelines for employees who are permitted to work from home (WFH). While we value in-office collaboration, we recognize that there are situations where remote work may be appropriate.

## 2. Scope
This policy applies to all employees of Color Papers India Private Limited and its subsidiary companies.

## 3. Eligibility
Work from home is not an entitlement but a privilege granted based on:
- Nature of the role (must be feasible to perform remotely)
- Employee's performance record and track record of reliability
- Manager's assessment and approval
- Business needs and team requirements

## 4. WFH Request Process
- Submit WFH request at least 24 hours in advance through the company portal
- Emergency WFH requests must be communicated to the manager immediately
- Manager approval is required before WFH commences
- Maximum WFH days per month may be limited based on role and department

## 5. Working Hours & Availability
- Standard working hours apply during WFH (9:00 AM to 6:00 PM or as per shift)
- Employee must be available on all communication channels (phone, email, chat)
- Response time should not exceed 15 minutes during working hours
- Video calls should be attended with camera on when requested

## 6. Productivity & Deliverables
- All assigned tasks and deadlines must be met as if working from office
- Daily activity report must be submitted on WFH days
- Manager may request periodic check-ins or status updates
- Failure to maintain productivity may result in WFH privileges being revoked

## 7. Equipment & Infrastructure
- Employee is responsible for ensuring stable internet connectivity
- Company may provide necessary equipment (laptop, etc.) as per existing IT policies
- Any technical issues must be reported immediately to IT and manager
- Data security protocols must be followed at all times

## 8. Data Security
- Company data must not be accessed on public or unsecured networks
- VPN must be used when accessing company systems remotely
- Sensitive documents must not be printed at home without authorization
- All company information security policies apply during WFH

## 9. Not Applicable Situations
WFH will not be approved when:
- Physical presence is required for meetings, training, or events
- Critical team activities or deadlines require in-office coordination
- During probation period (except in special circumstances)
- The employee's recent performance has been below expectations

## 10. Misuse
Misuse of WFH privileges (e.g., unavailability, low productivity, unauthorized personal activities during work hours) will result in:
- Revocation of WFH privileges
- Disciplinary action as per company policy
- The day may be treated as unauthorized leave

## 11. Effective Date
This policy is effective immediately and may be revised based on organizational needs.`,
    sections: [
      { title: 'Purpose & Scope', content: 'Guidelines for WFH. Applies to all employees of CPIPL and subsidiaries.', sortOrder: 0 },
      { title: 'Eligibility', content: 'WFH is a privilege, not entitlement. Based on role, performance, manager approval, and business needs.', sortOrder: 1, isEditable: true },
      { title: 'Request Process', content: '24-hour advance request. Emergency WFH communicated immediately. Manager approval required.', sortOrder: 2 },
      { title: 'Working Hours & Availability', content: 'Standard hours apply. Available on all channels. 15-min max response time.', sortOrder: 3, isEditable: true },
      { title: 'Productivity & Deliverables', content: 'Tasks and deadlines must be met. Daily activity report required. Privileges revocable for low productivity.', sortOrder: 4 },
      { title: 'Data Security', content: 'No public networks. VPN required. No printing sensitive docs. All security policies apply.', sortOrder: 5 },
      { title: 'Misuse', content: 'Unavailability or low productivity = revocation of WFH, disciplinary action, treated as unauthorized leave.', sortOrder: 6 },
    ],
    protectionScore: 78,
    scoreBreakdown: JSON.stringify({ legal: 72, compliance: 80, clarity: 82, enforceability: 75, completeness: 80 }),
  },

  // ─── 4. Referral Policy ───
  {
    title: 'Employee Referral Policy',
    slug: 'employee-referral-policy',
    category: 'benefits',
    summary: 'Outlines the employee referral program including eligibility, referral process, bonus structure, and conditions for receiving referral rewards.',
    isMandatory: false,
    content: `# Employee Referral Policy

## 1. Purpose
This policy establishes the Employee Referral Program to encourage existing employees to refer qualified candidates for open positions. Quality referrals help build a strong team and reduce hiring costs.

## 2. Scope
This policy applies to all regular employees of Color Papers India Private Limited and its subsidiary companies.

## 3. Eligibility
- All full-time employees (excluding HR and recruitment team members) are eligible to make referrals
- Employees in their probation period may refer but will receive the bonus only after their own confirmation
- The referred candidate must not have applied to the company in the last 6 months
- Self-referrals are not permitted

## 4. Referral Process
1. Employee identifies a potential candidate for an open position
2. Employee submits referral through the company portal or directly to HR
3. Referral must include: candidate name, contact details, position referred for, resume, and relationship to the referrer
4. HR acknowledges receipt within 2 business days
5. Standard recruitment process applies to all referred candidates

## 5. Referral Bonus
- The referral bonus is paid after the referred candidate successfully completes their probation period
- Bonus amounts are determined by the position level:
  - Junior/Entry Level: ₹5,000
  - Mid-Level: ₹10,000
  - Senior/Management Level: ₹15,000 - ₹25,000
- Bonus amounts may be revised by management and communicated separately
- The bonus is subject to applicable taxes

## 6. Conditions
- The referral must be submitted before the candidate applies independently
- If multiple employees refer the same candidate, the first referral received will be honored
- The referral bonus will not be paid if:
  - The referrer leaves the company before the bonus becomes payable
  - The referred candidate is terminated during probation
  - The referred candidate was already in the company's recruitment pipeline

## 7. Multiple Referrals
There is no limit on the number of referrals an employee can make. Each successful referral is eligible for a separate bonus.

## 8. Effective Date
This policy is effective immediately and the bonus structure may be revised periodically.`,
    sections: [
      { title: 'Purpose & Eligibility', content: 'Encourages referrals for open positions. All full-time employees eligible (excluding HR/recruitment). No self-referrals.', sortOrder: 0 },
      { title: 'Referral Process', content: 'Submit through portal or HR with candidate details. HR acknowledges within 2 business days. Standard recruitment applies.', sortOrder: 1 },
      { title: 'Referral Bonus', content: 'Paid after referred candidate completes probation. Junior: ₹5K, Mid: ₹10K, Senior: ₹15-25K. Subject to taxes.', sortOrder: 2, isEditable: true },
      { title: 'Conditions', content: 'Must be submitted before independent application. First referral honored. Not paid if referrer leaves or candidate terminated.', sortOrder: 3 },
    ],
    protectionScore: 65,
    scoreBreakdown: JSON.stringify({ legal: 60, compliance: 65, clarity: 72, enforceability: 60, completeness: 68 }),
  },

  // ─── 5. Anti-Discrimination Policy ───
  {
    title: 'Anti-Discrimination Policy',
    slug: 'anti-discrimination-policy',
    category: 'conduct',
    summary: 'Establishes the company\'s commitment to a discrimination-free workplace, defines prohibited behaviors, and outlines the complaint and resolution process.',
    isMandatory: true,
    content: `# Anti-Discrimination Policy

## 1. Purpose
Color Papers India Private Limited is committed to providing a work environment that is free from discrimination, harassment, and victimization. This policy outlines our commitment to equal opportunity and the standards of behavior expected from all employees.

## 2. Scope
This policy applies to all employees, contractors, consultants, interns, and anyone associated with the organization, across all locations.

## 3. Policy Statement
The company prohibits discrimination on the basis of:
- Race, color, or ethnicity
- Gender or gender identity
- Sexual orientation
- Religion or beliefs
- Age
- Disability or medical condition
- Marital or family status
- Nationality or place of origin
- Caste
- Any other characteristic protected by applicable law

## 4. What Constitutes Discrimination
Discrimination includes but is not limited to:
- **Direct discrimination**: Treating someone less favorably because of a protected characteristic
- **Indirect discrimination**: Applying policies or practices that disproportionately affect certain groups
- **Harassment**: Unwanted conduct that creates an intimidating, hostile, or offensive work environment
- **Victimization**: Treating someone unfavorably because they have made or supported a complaint about discrimination

## 5. Responsibilities

### 5.1 All Employees
- Treat all colleagues with dignity and respect
- Refrain from any form of discriminatory behavior
- Report any instances of discrimination they witness or experience
- Cooperate in any investigation related to discrimination complaints

### 5.2 Managers and Supervisors
- Lead by example in promoting an inclusive workplace
- Address any discriminatory behavior immediately
- Ensure team practices and decisions are non-discriminatory
- Escalate complaints to HR promptly

### 5.3 HR Department
- Implement and maintain this policy
- Investigate complaints thoroughly and impartially
- Provide guidance and training on anti-discrimination
- Take appropriate disciplinary action against violators

## 6. Complaint Procedure
1. The affected individual should report the incident to their manager or HR
2. If the complaint involves the manager, it should be directed to HR or senior management
3. Complaints can be made in writing or verbally
4. All complaints will be treated with confidentiality to the extent possible
5. HR will acknowledge the complaint within 48 hours and begin investigation
6. The investigation will be completed within 15 working days
7. Both parties will be informed of the outcome

## 7. Disciplinary Action
Violations of this policy may result in:
- Written warning
- Mandatory sensitivity training
- Suspension
- Demotion
- Termination of employment
- Legal action as applicable

## 8. No Retaliation
The company strictly prohibits retaliation against any employee who reports discrimination or participates in an investigation. Any retaliation will be treated as a separate disciplinary matter.

## 9. Training
All employees will receive anti-discrimination training as part of their onboarding. Regular refresher training will be provided.

## 10. Effective Date
This policy is effective immediately and will be reviewed annually.`,
    sections: [
      { title: 'Purpose & Scope', content: 'Committed to discrimination-free workplace. Applies to all employees, contractors, interns, and associated persons.', sortOrder: 0 },
      { title: 'Policy Statement', content: 'Prohibits discrimination based on race, gender, orientation, religion, age, disability, marital status, nationality, caste, or any protected characteristic.', sortOrder: 1 },
      { title: 'What Constitutes Discrimination', content: 'Direct discrimination, indirect discrimination, harassment, and victimization.', sortOrder: 2 },
      { title: 'Responsibilities', content: 'Employees: treat with dignity, report incidents. Managers: lead by example, address immediately. HR: investigate, train, enforce.', sortOrder: 3 },
      { title: 'Complaint Procedure', content: 'Report to manager/HR. Acknowledged within 48 hours. Investigation within 15 working days. Confidential.', sortOrder: 4, isEditable: true },
      { title: 'Disciplinary Action', content: 'Warning → training → suspension → demotion → termination → legal action.', sortOrder: 5 },
      { title: 'No Retaliation', content: 'Retaliation against complainants strictly prohibited and treated as separate disciplinary matter.', sortOrder: 6 },
    ],
    protectionScore: 92,
    scoreBreakdown: JSON.stringify({ legal: 95, compliance: 95, clarity: 90, enforceability: 88, completeness: 92 }),
  },

  // ─── 6. Personal Purchases on Company Address Policy ───
  {
    title: 'Personal Purchases on Company Address Policy',
    slug: 'personal-purchases-company-address-policy',
    category: 'conduct',
    summary: 'Restricts the use of company address for personal deliveries to maintain professional standards and avoid operational disruptions.',
    isMandatory: true,
    content: `# Personal Purchases on Company Address Policy

## 1. Purpose
This policy addresses the use of the company's official address for personal purchases and deliveries. To maintain a professional work environment and avoid operational disruptions, guidelines are established for personal deliveries at the workplace.

## 2. Scope
This policy applies to all employees across all company locations.

## 3. Policy Guidelines
- Employees are **discouraged** from using the company address for personal online purchases and deliveries
- The company reception and security are not responsible for receiving, storing, or safeguarding personal deliveries
- Personal parcels/deliveries may be refused at the company gate/reception if they cause disruption
- The company is not liable for any loss, damage, or theft of personal items delivered to the office

## 4. Exceptions
In unavoidable circumstances:
- Small, non-disruptive deliveries may be permitted with prior intimation to the admin team
- The employee must collect the delivery promptly and not leave it in common areas
- Bulk or oversized deliveries are strictly prohibited

## 5. Cash on Delivery (COD)
- Cash on delivery orders to the company address are **strictly prohibited**
- The company will not arrange payment for any personal deliveries
- Any COD delivery arriving at the office will be refused

## 6. Returns and Exchanges
- The company address should not be used as a return/exchange address for personal purchases
- Reverse pickups from the office are not permitted

## 7. Non-Compliance
Repeated violations of this policy may result in:
- Verbal warning
- Written warning
- Administrative action

## 8. Effective Date
This policy is effective immediately.`,
    sections: [
      { title: 'Purpose', content: 'Addresses use of company address for personal purchases. Maintains professional environment.', sortOrder: 0 },
      { title: 'Policy Guidelines', content: 'Discouraged. Company not responsible for personal deliveries. Not liable for loss/damage/theft.', sortOrder: 1 },
      { title: 'Exceptions', content: 'Small deliveries with admin intimation. Must collect promptly. Bulk deliveries prohibited.', sortOrder: 2, isEditable: true },
      { title: 'COD & Returns', content: 'COD orders strictly prohibited. Return/exchange addresses not permitted. Reverse pickups not allowed.', sortOrder: 3 },
    ],
    protectionScore: 55,
    scoreBreakdown: JSON.stringify({ legal: 45, compliance: 55, clarity: 70, enforceability: 50, completeness: 55 }),
  },

  // ─── 7. Weekly Off & Weekend Work Policy ───
  {
    title: 'Weekly Off (Saturday) & Weekend Work Policy',
    slug: 'weekly-off-weekend-work-policy',
    category: 'attendance',
    summary: 'Defines the weekly off schedule for Saturdays and guidelines for working on weekends, including compensatory off provisions.',
    isMandatory: true,
    content: `# Weekly Off (Saturday) & Weekend Work Policy

## 1. Purpose
This policy defines the weekly off schedule and provides guidelines for situations where employees may be required to work on their scheduled off days, including Saturdays and Sundays.

## 2. Scope
This policy applies to all employees of Color Papers India Private Limited and its subsidiary companies.

## 3. Weekly Off Schedule
- Sunday is a full weekly off for all employees
- Alternate Saturdays may be designated as working days or off days, as determined by management
- The Saturday working schedule will be communicated at the beginning of each month
- Specific departments may have different off-day arrangements based on operational requirements

## 4. Weekend Work
When business needs require weekend work:
- Manager must request weekend work at least 48 hours in advance (except emergencies)
- Prior approval from the department head and HR is required
- The requirement for weekend work should be based on genuine business needs

## 5. Compensatory Off
- Employees working on a scheduled weekly off are eligible for compensatory off
- Comp-off must be applied for and approved within 30 days of the working day
- Comp-off cannot be accumulated beyond 2 days at any given time
- Unused comp-off will lapse after 30 days
- Comp-off cannot be encashed

## 6. Overtime
- For employees eligible for overtime, weekend work will be compensated as per applicable labor laws
- Overtime eligibility is determined by the employee's grade and designation
- Prior approval is required for overtime work

## 7. Recording
- Weekend work must be recorded in the attendance system
- Manager must approve the weekend attendance entry
- Comp-off requests must reference the specific weekend work date

## 8. Effective Date
This policy is effective immediately and will be reviewed annually.`,
    sections: [
      { title: 'Purpose & Scope', content: 'Defines weekly off schedule and weekend work guidelines. Applies to all CPIPL employees.', sortOrder: 0 },
      { title: 'Weekly Off Schedule', content: 'Sunday full off. Alternate Saturdays as per monthly schedule. Departments may vary.', sortOrder: 1, isEditable: true },
      { title: 'Weekend Work', content: '48-hour advance request. Department head and HR approval. Must be genuine business need.', sortOrder: 2 },
      { title: 'Compensatory Off', content: 'Applied within 30 days. Max 2 days accumulation. Lapses after 30 days. Cannot be encashed.', sortOrder: 3, isEditable: true },
      { title: 'Overtime & Recording', content: 'Overtime per labor laws. Weekend work recorded in attendance system with manager approval.', sortOrder: 4 },
    ],
    protectionScore: 75,
    scoreBreakdown: JSON.stringify({ legal: 78, compliance: 80, clarity: 75, enforceability: 70, completeness: 72 }),
  },
];

async function seed() {
  console.log('🔄 Seeding policies...\n');

  for (const policyData of policies) {
    const { sections, ...policyFields } = policyData;

    // Check if already exists
    const existing = await prisma.policy.findUnique({ where: { slug: policyFields.slug } });
    if (existing) {
      console.log(`⏭️  Skipping "${policyFields.title}" — already exists (id: ${existing.id})`);
      continue;
    }

    // Create policy
    const policy = await prisma.policy.create({
      data: {
        ...policyFields,
        version: 1,
        createdBy: 1, // admin user
      },
    });

    // Create sections
    if (sections && sections.length > 0) {
      for (const section of sections) {
        await prisma.policySection.create({
          data: {
            policyId: policy.id,
            title: section.title,
            content: section.content,
            sortOrder: section.sortOrder,
            isEditable: section.isEditable || false,
          },
        });
      }
    }

    // Create version snapshot
    await prisma.policyVersion.create({
      data: {
        policyId: policy.id,
        version: 1,
        content: policyFields.content,
        changedBy: 1,
        changeLog: 'Initial version imported from greytHR',
      },
    });

    console.log(`✅ Created: "${policyFields.title}" (${sections?.length || 0} sections, score: ${policyFields.protectionScore})`);
  }

  console.log('\n🎉 Policy seeding complete!');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
