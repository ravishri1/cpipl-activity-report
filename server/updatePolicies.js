/**
 * Update policies with actual PDF content
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const updates = [
  {
    slug: 'employee-attendance-leave-policy',
    summary: 'This attendance policy outlines our expectations regarding employees\' punctuality and leave entitlements. Being on time helps maintain efficiency in the workplace.',
    content: `# Employee Attendance & Leave Policy

## 1. Policy Statement
This attendance policy outlines our expectations regarding employees' punctuality. Being on time helps maintain efficiency in the workplace.

## 2. Scope
Most employees need to collaborate with colleagues to perform their job effectively. To facilitate this, we expect employees to be punctual and follow their schedules. This policy applies to all employees, regardless of position or employment type.

## 3. Policy Overview
Employees at Color Papers are expected to be present and on time every working day. Regular attendance and punctuality are critical for smooth operations. Late arrivals, tardiness, or absenteeism can cause disruptions and burden colleagues.

## 4. Definitions
- **Absenteeism**: Frequent absence from work without valid reasons, including excessive sick leave without submitting doctor's notes.
- **Presenteeism**: Being at work beyond your scheduled time without the need for overtime, which can lead to overwork, reduced productivity, and job dissatisfaction.
- **Tardiness**: Coming in late, taking longer breaks, or leaving early without valid reasons, which can disrupt the workplace.

## 5. Check-In and Check-Out Procedures
- **Check-In**: Employees are required to check in at either 09:00 AM or 10:00 AM, depending on their shift. There is a buffer time of 15 minutes, meaning employees can check in by 09:15 AM or 10:15 AM without being marked late. If arriving later than the buffer time, employees must inform their reporting manager via Google Chat, WhatsApp, or call. Failure to do so will be marked as late.
- **Check-Out**: Employees must check out at the end of their shift. Any instances of forgetting to check out must be reported to HR to avoid salary disputes.
- **Late Marks**:
  - **Acceptable Late Marks**: Employees are allowed 3 late marks per month with prior notice, without penalties.
  - **Additional Late Marks**: After 3 late marks, every subsequent 3 late marks without notice will be considered as a half-day leave. A late mark can be ignored if the employee completes the minimum working hours for the day. The final decision rests with the reporting manager.

## 6. Failure to Check In or Out
Employees must clock in and clock out for each shift. If there is a problem with the clock-in or clock-out system, the HR department should be informed immediately. Consistent failure to clock in or out may result in disciplinary action.

## 8. Leave Policy
- **Objective**: The leave policy ensures that employees have adequate time off while preventing the accumulation of unused leave.
- **Leave Cycle**: The leave cycle runs from April 1st to March 31st each year. Unused leave can be carried over to the next year.
- **Paid Leave**: Employees are entitled to 12 paid leaves per year. Any unused leaves beyond 6 will not carry forward, and any leave exceeding 18 days in total will lapse.
- **Leave Bifurcation**:
  - **Festival Holidays**: 12 days.
  - **Paid/Privileged Leaves**: 12 days (1 leave per month, accrued starting from the date of joining). Leaves are available only after confirmation of employment.
  - **Probation Period**: Only 1 paid leave is permitted during probation, subject to the approval of the reporting authority. Additional leave will be considered unpaid leave (LOP).

## 9. Leave Application Procedure
- All leave requests must be approved by the reporting manager, with HR marked in CC.
- **Planned Leave**: Inform your supervisor 24–48 hours before a single-day leave, and 30 days prior for extended leaves.
- **Unplanned Leave**: If leave is requested after the start of the leave period, it will be considered unplanned leave.

## 10. Leave Conditions
- Approval of leave requests is not guaranteed.
- If unpaid leave is taken on a Saturday and the following Monday, salary will be deducted for Saturday, Sunday, and Monday.
- Emergency leave for 1 day or more is at the discretion of management.
- A maximum of 10 consecutive days of planned leave is allowed, including Sundays and festival holidays.

## 11. Leave Adjustments
- Leaves beyond the balance will be treated as Loss of Pay (LOP).
- Public holidays follow the company holiday list. For other festivals, leave can be applied under PL.
- Employees working on Sundays or holidays are entitled to compensatory leave or a payout for those with Sunday allowances.
- Overtime is not compensated with payment.

## 12. Sandwich Leave Policy
- **Sandwich Leave**: If an employee takes leave on a working day before and after a non-working day, the non-working days will also count as leave.
  - Example: If you take leave on Saturday and Monday, Saturday, Sunday, and Monday will all count as leave.
- **Exceptions**: Leave for official travel will not count as sandwich leave.`,
  },

  {
    slug: 'performance-improvement-plan-pip-policy',
    title: 'Performance Improvement Plan (PIP) Policy',
    summary: 'This policy provides supervisors and managers with guidelines to address unsatisfactory work performance through a structured corrective action process (PIP) lasting up to 3 months, with salary implications and clear outcomes.',
    content: `# Performance Improvement Plan (PIP) Policy

## Scope
The Performance Improvement Plan Policy applies to all staff members of the Company.

## Policy Statement
The purpose of this Policy is to provide supervisors and managers with guidelines to address Unsatisfactory Work Performance. Performance Improvement Plans (PIPs) are intended to establish a structured corrective action process to improve and prevent a recurrence of Unsatisfactory Work Performance. The key to an effective PIP is identifying what behaviour is expected of the employee and what behaviour is occurring; put another way, identifying the gap between expectation and performance. When such Unsatisfactory Work Performance is identified, the supervisor should communicate with the employee to take corrective or remedial action, which may include coaching and support tools, and/or the establishment of a PIP.

## Policy
When supervisors identify areas or patterns of Unsatisfactory Work Performance of their employees, they are encouraged to discuss the problems and ways to improve with the employees. If the Unsatisfactory Work Performance continues, and if appropriate, supervisors may use their discretion to establish a formal period of evaluation, or PIP, during which time the employee can correct their performance. No employee can be placed on a PIP until the supervisor has met and consulted with the Human Resources and Employee as to the details and objectives of the PIP.

Once a decision is made for an employee to be placed on a PIP, the supervisor, with the assistance of the Human Resources and Employee will meet to discuss the formal period of evaluation or issuance of PIP and to identify the specific areas within the employee's job description where demonstrated and sustained improvement must occur in order to continue employment. The supervisor should also establish a reasonable period of time, relative to the nature of the problem, for the employee to demonstrate improved performance.

During the time period specified in the PIP, the supervisor will meet regularly with the employee to provide feedback on the employee's progress. One-on-one weekly or biweekly meetings with the employee and supervisor are encouraged and supervisors should provide formal reviews at least every thirty (30) days of the PIP period. The Human Resources can attend these meetings if desired. The supervisor will also communicate updates as to the employee's progress in relation to the terms of the evaluation or PIP.

Throughout the duration of the PIP up to its expiration, the supervisor will determine if the work performance meets the established standards. If the standards have been achieved, the supervisor will notify the employee in writing of the successful completion of the PIP. If some performance improvement is made, the supervisor has the discretion to extend the period of evaluation or PIP for additional time, but under no circumstance should the total period of the PIP extend beyond a total of three (3) months.

If there is evidence that the employee cannot or will not improve work performance, either during the PIP period or at its expiration, the supervisor will do a final review with the Human Resources and Employee to determine if termination is warranted. During this review, alternative possible outcomes, such as reassignment, transfer, or demotion, may be considered based on the specific circumstances.

## Duration
The duration of the PIP would be for 3 months starting from the date of informing the employee about the PIP.

During this period, the employee is expected to work towards the performance improvement measures set by their supervisor and would be evaluated on a timely basis.

As mentioned above, if the employee shows improvement on an immediate basis, the employee can be removed from the PIP policy as per the manager's discretion.

Under No situation, the PIP period shall exceed more than 3 months.

In-case the employee does not show any improvement, the employee would be terminated as per the company policy.

## Salary
During the duration of the PIP, the employee would be eligible to only **70% salary** and the remaining **30% of salary would be withheld**.

The same withheld amount would be released after the completion of the PIP period for the employee.

If the employee does not improve during the PIP period, the employee is terminated and would **NOT** be eligible to receive the outstanding 30% salary for the entire duration of the PIP period.

## Process
- The manager has to identify the employee with unsatisfactory performance or behaviour.
- The Manager must then notify the employee and the Human Resource Manager and schedule a meeting for the same via Mail. The mail must include the reasons for putting the employee on PIP, the scope for improvement.
- Post the discussion, the manager will then direct the Human Resource to put the employee on the PIP plan and a mail communication will be sent to the employee by the HR.
- The entire communication for the same shall be on mail only.
- There will be timely reviews and performance based decision will be taken on the same.
- Based on the employee's performance, the decision for further course of action will be taken i.e. either completion of PIP period or termination of service.`,
  },

  {
    slug: 'anti-discrimination-policy',
    summary: 'Our anti-discrimination policy explains how we prevent discrimination and protect our employees, customers, and stakeholders from offensive and harmful behaviors, supporting our commitment to a safe and happy workplace for everyone.',
    content: `# Anti-discrimination Policy

## Policy Brief & Purpose
Our anti-discrimination policy explains how we prevent discrimination and protect our employees, customers, and stakeholders from offensive and harmful behaviors. This policy supports our overall commitment to creating a safe and happy workplace for everyone.

## Scope
This policy applies to all employees, contractors, visitors, customers, and stakeholders.

## Policy Elements
Discrimination is any negative action or attitude directed toward someone because of protected characteristics, like race and gender. Other protected characteristics are:
- Age
- Religion
- Ethnicity / nationality
- Disability / medical history
- Marriage / civil partnership
- Pregnancy / maternity / paternity
- Gender identity / sexual orientation

## Discrimination and Harassment
Our anti-discrimination and anti-harassment policies go hand-in-hand. We will not tolerate any discrimination that creates a hostile and unpleasant environment for employees, interns, or volunteers.

This is not an exhaustive list, but here are some instances that we consider discrimination:
- Hiring managers disproportionately disqualifying male or female job candidates on purpose.
- Managers bypassing team members with specific protected characteristics (e.g. race) for promotion without being able to prove formally the reasons other employees were selected instead.
- Employees making sexist comments.
- Employees sending emails disparaging someone's ethnic origin.

Employees who harass their colleagues will go through our disciplinary process and we may reprimand, demote or terminate them depending on the severity of their offense.

We recognize that sometimes, discrimination is unintentional, as we may all have unconscious biases that could be difficult to identify and overcome. In case we conclude that an employee unconsciously discriminates, we will support them through training and counseling and implement processes that mitigate biases. But, if this person shows unwillingness to change their behavior, we may demote or terminate them.

We will not be lenient in cases of assault, sexual harassment or workplace violence, whether physical or psychological. We will terminate employees who behave like this immediately.

## Actions to Prevent Discrimination
To ensure that our conduct and processes are fair and lawful, we:
- Use inclusive language in job ads and include EEO statements.
- Set formal job-related criteria to hire, promote and reward team members.
- Offer compensation and benefits according to position, seniority, qualifications, and performance, not protected characteristics.
- Accommodate people with disabilities.
- Require managers to keep detailed records of their decisions concerning their team members and job candidates.

We will also consider additional measures to prevent discrimination, like:
- Using hiring processes that reduce bias like structured interviews and blind hiring programs.
- Organizing training on diversity, communication, and conflict management to improve collaboration among employees of different backgrounds.

## What to Do in Cases of Discrimination
If you are the victim of discriminatory behavior (or if you suspect that others are being discriminated against), please talk to HR (or your manager) as soon as possible. HR is responsible for hearing your claim, investigating the issue and determining punishment.

Punishment for discriminatory behavior depends on the severity of the offense. For example, inadvertently offending someone might warrant a reprimand. Conversely, willfully bypassing employees for promotion because of a protected characteristic will result in termination.

If you decide to claim a regulatory body, we are committed and bound by law not to retaliate against you.

## How We Address Discrimination Complaints
HR is proactive and responsive to determining whether discrimination occurs. For example, we:
- Look into similar claims about the same person or process to determine if discrimination is systemic.
- Conduct discreet interviews and gather information.

We will investigate all claims discreetly. We will never disclose who made a complaint to anyone or give out information that may help others identify that person (e.g. which department or role they work in.)

We should all strive to prevent and address discrimination. Be aware of your implicit biases and speak up whenever you or your colleagues are discriminated against. If you have any ideas on how we can ensure fairness and equality in our workplace, we are happy to hear them.`,
  },

  {
    slug: 'referral-policy',
    summary: 'Our Employee Referral Program rewards employees for referring successful candidates. Junior referral bonus: ₹3,000 | Senior referral bonus: ₹5,000, paid in two instalments at 3 and 6 months.',
    content: `# Referral Policy

## Background
Our Employee Referral Program Policy explains important aspects of our employee referral procedures. We place great importance on referrals because we trust our employees know what is best for our company. We want to make this process as smooth as possible for our employees and those who they refer.

## Scope
This Employee Referral Program Policy applies to everyone who refers a candidate to our company for any possible/suitable opening.

## Policy Elements

### What is an Employee Referral Bonus?
Our company will give out rewards to every referrer. If you know someone who you think would be a good fit for a position at our company, feel free to refer them. If we end up hiring your referred candidate, you are eligible for:
- **Junior Candidate**: ₹3,000 referral bonus
- **Senior Candidate**: ₹5,000 referral bonus

## Additional Rules for Rewards
- We guarantee that rewards will be paid out within 6 months of the date we hired the candidate.
- There is no cap on the number of referrals an employee can make. All rewards will be paid accordingly.
- If two or more employees refer the same candidate, only the first referrer will receive their referral rewards.
- Referrers are still eligible for rewards even if a candidate is hired later or gets hired for another position.
- **Junior Candidate Bonus Payment**:
  - ₹1,000 after the candidate completes 3 months in the organisation
  - Remaining ₹2,000 after the candidate completes 6 months in the organisation
- **Senior Candidate Bonus Payment**:
  - ₹2,000 after the candidate completes 3 months in the organisation
  - Remaining ₹3,000 after the candidate completes 6 months in the organisation

## Who Can Participate?
- All employees are eligible to participate in our referral program **except for the management**.
- Generally, we encourage you to check our open positions and consider your social networks and external networks as potential resources for referred candidates.

We may change our referral bonus program over time to add more interesting incentives. We also reserve the right to abolish certain rewards if they are ineffective or inefficient.`,
  },

  {
    slug: 'work-from-home-policy',
    summary: 'We designed our Work From Home policy to ensure working from home is beneficial to employees and the company. Maximum 6 days per year allowed. Requests must be approved by the reporting manager in advance.',
    content: `# Work From Home Policy

## Policy Brief & Purpose
We designed our work from home policy to make sure that working from home is beneficial to our employees and company. This policy allows employees to maintain a healthy work-life balance and improve employee productivity.

The work from home policy applies to some of our employees who prefer working from home in times of need. However, an employee's working from home request will be considered on a case-by-case basis. Approval of work from home request is based on job duties, prior performance, and productivity.

## Responsibilities
The reporting manager is responsible for ensuring that the terms and conditions under the work from home policy have been satisfied prior to approving the request. It is the responsibility of the employee to adhere to all the company's policies and procedures even when working from an alternative location. Additionally, employees must maintain accurate and up to date records of hours worked at home within a normal span of hours. The employee is expected to be contactable and available for communication with the HR/reporting manager and team members during the periods in which home-based work is carried out.

## When Are Employees Allowed to Work from Home?
Depending on the job duties assigned, employees are allowed to work from home. Employees who need to be in direct physical contact with clients and customers are not eligible to telecommute under this policy. Similarly, Logistic and Return Department staff are exempt from this policy. But employees working from their workstations with the help of computers can occasionally avail the benefit of this policy. However, the employee must get his/her work from home request approved by his/her reporting manager.

Before approving a request, managers must consider the fact that all employees are different. If employees may not be productive in work from home setup therefore, reporting managers must ensure that the productivity of the employee does not waiver in work from home arrangement. If need be, they can set clear targets to be achieved by the employee for the duration of work from home.

**Employees serving their probationary period are not eligible for Work from Home (WFH) arrangements.** In cases where pending work requires immediate attention, the decision to allow a probationary employee to work from home will be at the discretion of their manager. Such approvals, if granted, will be considered on a case-by-case basis and must align with operational requirements.

## Scope
Work from home arrangements can be occasional or temporary, the decision of which is taken at the time of the situation. If the work from home arrangement spans for more than a week, managers and team members should meet to discuss details and set specific goals, schedules and deadlines.

Employees can request work from home for reasons that include but are not limited to:
- Parenting
- Bad weather
- Emergencies
- Medical reasons
- Work-life balance
- Other reasons for working from home depend on employee and Reporting manager's judgement.

## Things to Keep in Mind
Before asking and approving work from home request, employees and managers must consider the below concerns:

1. Employee eligible for work from home by the nature of his/her job description.
2. One week prior approval from a reporting manager required.
3. The person should maintain privacy of company data; if misused, actions will be taken.
4. Home-based worksite to be a safe area to work.
5. Employees' work from home in any way does not affect his/her team output.
6. Need to provide a formal explanation and supporting documents (train or flight ticket both sides, hospital letter, letter from doctor, fitness certificate).
7. Employees must have necessary software installed and permissions granted to operate official portals from home.
8. Need to have a strong internet connection, noise control at the employee's home or alternative place of work.
9. **Maximum 6 days per year** allowed for work from home. In case of issues arising at the preferred place of work, employee must come to the office (WFO).
10. If a manager suggests an employee to work from home (WFH) while on leave, the employee is expected to work for a maximum of 6 days in a calendar year. On such days, they must complete a minimum of 6 working hours.

## Approval Procedure
When employees plan to work from home, they must email the reporting Manager and HR and update in advance (number of days). It is up to the reporting manager to approve the same after considering all the aspects mentioned above.

## Mutual Understanding
Managers can set guidelines that ensure employees work at their optimum level. The employee and the supervisor must decide how often they need to catch up to ensure that all the goals and targets are met. They can even consider scheduling meetings. Managers must provide straightforward guidelines to ensure employees know what to do in their new work environment.`,
  },

  {
    slug: 'personal-purchases-on-company-address-policy',
    summary: 'Employees are prohibited from using the company address for personal purchases or deliveries without prior written approval from HR. Non-compliance attracts a penalty of ₹500 deducted from salary.',
    content: `# Personal Purchases on Company Address Policy

## Purpose
This policy establishes guidelines for employees regarding the use of the company address for personal purchases and deliveries. It ensures that the company's resources, including its mailing and delivery systems, are used appropriately.

## Policy Overview
Employees are **prohibited** from using the company's address for personal purchases or deliveries without prior intimation or approval from the designated authority (e.g., HR or management).

## Intimation and Approval Process
- If an employee needs to use the company address for a personal delivery, they must seek **approval in writing** from the HR department.
- Approval will be granted based on the nature and frequency of the request.

## Penalty for Non-Compliance
- If an employee makes a personal purchase using the company address without prior notification or approval, a **penalty of ₹500** will be imposed.
- The penalty amount will be **deducted directly from the employee's salary**.

## Exceptions
- The company may allow exceptions in cases of emergency or other special circumstances, provided that the employee informs the HR Department immediately.

**By following this policy, we ensure the smooth operation of the company's mailing and delivery processes, while maintaining professional boundaries.**`,
  },

  {
    slug: 'weekly-off-saturday-weekend-work-policy',
    summary: 'Effective 1st February 2026, all Saturdays are weekly holidays. Weekend work is allowed only for business-critical needs with prior manager approval. Employees must complete 9 working hours and will receive comp-off or salary compensation.',
    content: `# Weekly Off (Saturday) & Weekend Work Policy

## 1. Purpose
This policy is introduced to promote better work-life balance while ensuring business continuity and operational efficiency. It outlines the organization's approach toward weekly holidays and the process for managing work on weekends when business needs arise.

## 2. Weekly Off Structure
Effective **1st February 2026**, all Saturdays will be observed as weekly holidays across the organization.

Employees are expected to plan their work schedules in a way that all responsibilities, assignments, and deliverables are effectively managed within the revised working days.

## 3. Weekend Work Requirement
In situations involving business-critical or operationally essential requirements, employees may be required to work on a Saturday or Sunday.

Such work must not be routine and should only be scheduled when necessary for business continuity.

## 4. Approval Process
Weekend work must be:
- Pre-approved by the employee's Reporting Manager
- Reviewed, where applicable, in coordination with the Skip-level Manager
- Properly justified based on genuine business needs

Employees should not undertake weekend work without formal approval.

## 5. Conditions for Approved Weekend Work
When weekend work is officially approved:
- The work performed will be formally tracked and monitored.
- Employees must complete **9 working hours** on the approved weekend day.
- Compensation, including salary payment or compensatory off (as applicable), will be provided in accordance with company policy and statutory guidelines.

## 6. Roles & Responsibilities

### Employees
Employees are responsible for:
- Planning deliverables within regular working days wherever possible
- Seeking prior approval before undertaking any weekend work
- Accurately reporting working hours for approved weekend duties

### Reporting Managers
Reporting Managers are accountable for:
- Assessing and validating the business necessity of weekend work
- Providing formal approval before scheduling employees on weekends
- Ensuring proper work planning and coordination
- Monitoring adherence to working hours and overall policy compliance

## 7. Compliance
Any deviation from this policy, including unauthorized weekend work, may be subject to review and corrective action as per company rules.

## 8. Policy Review
The organization reserves the right to review, amend, or update this policy at its discretion to align with business and regulatory requirements.`,
  },
];

async function main() {
  console.log('Updating policies with actual PDF content...\n');
  let updated = 0, notFound = 0;

  for (const upd of updates) {
    const existing = await p.policy.findUnique({ where: { slug: upd.slug } });
    if (!existing) {
      console.log(`❌ NOT FOUND: ${upd.slug}`);
      notFound++;
      continue;
    }

    await p.policy.update({
      where: { slug: upd.slug },
      data: {
        content: upd.content,
        summary: upd.summary,
        ...(upd.title ? { title: upd.title } : {}),
        version: 1,
        updatedAt: new Date(),
      }
    });

    console.log(`✅ UPDATED: ${existing.title}`);
    updated++;
  }

  console.log(`\n─────────────────────────────────`);
  console.log(`Updated  : ${updated}`);
  console.log(`Not found: ${notFound}`);
}

main().catch(console.error).finally(() => p.$disconnect());
