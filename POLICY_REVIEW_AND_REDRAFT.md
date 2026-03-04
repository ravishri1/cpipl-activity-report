# CPIPL HR System - Comprehensive Policy Review & Redraft

**Date:** March 4, 2026  
**Status:** Ready for Implementation

---

## Executive Summary

This document provides a comprehensive review of the HR policy system and presents a modernized, consolidated set of policies designed to:

1. **Eliminate redundancy** - Combine related policies into unified documents
2. **Improve clarity** - Use consistent language and structure across all policies
3. **Enhance compliance** - Add legal protections and clear procedures
4. **Streamline acceptance** - Reduce policy count while maintaining coverage
5. **Support digital tracking** - Leverage PolicyAcceptance versioning system

**Current State:** Policy framework exists (Policy, PolicySection, PolicyAcceptance, PolicyVersion models)  
**Recommended Change:** Reduce from typical ~25-30 policies to **12 core policies** organized by category

---

## Current Policy System Architecture

### Database Models

**Policy Model (Main)**
- Title, slug, category, content, version
- Mandatory acceptance tracking (isMandatory flag)
- Company-specific or global scope
- Protection score (0-100) for compliance tracking
- Created/updated timestamps and audit trail

**PolicySection Model**
- Allows breaking policies into logical sections
- Sortable and potentially editable per employee
- Maintains relationship to parent Policy

**PolicyAcceptance Model**
- Tracks when each employee accepted each policy version
- Stores IP address and optional remarks
- Unique constraint on (policyId, userId, version)

**PolicyVersion Model**
- Maintains full changelog history
- Stores what changed and who changed it
- Enables version comparison

### Current Backend Routes

**Public Routes** (Authenticated employees)
- `GET /` - List active policies with acceptance status
- `GET /:slug` - View full policy with version changes
- `POST /:id/accept` - Accept a policy version
- `GET /:id/my-acceptance` - Check personal acceptance status

**Admin Routes**
- `GET /admin/all` - List all policies with acceptance rates
- `POST /admin/create` - Create new policy
- `PUT /admin/:id` - Update policy
- `PUT /admin/:id/sections` - Update policy sections
- `PUT /admin/:id/score` - Set protection score
- `GET /admin/:id/acceptances` - Who accepted/pending
- `GET /admin/scorecard` - Policy compliance overview
- `GET /admin/pending` - Employees with pending acceptances
- `GET /admin/:id/versions` - Version history
- `GET /admin/:id/compare` - Compare versions
- **Conflict Detection:** `GET /admin/conflicts` - Find policy conflicts
- **Impact Analysis:** `GET /admin/:id/impact` - Policy impact by department

---

## Policy Consolidation & Redraft Strategy

### Principle: 12 Core Policies

Rather than create 25+ separate policies, consolidate into these **12 core policies** organized by natural groupings:

| # | Category | Policy Name | Scope | Required | Key Topics |
|---|----------|-------------|-------|----------|-----------|
| 1 | **Conduct** | Code of Conduct & Ethics | All employees | ✅ Mandatory | Respect, integrity, conflicts, gifts, confidentiality |
| 2 | **Conduct** | Anti-Harassment & Discrimination | All employees | ✅ Mandatory | Zero tolerance, reporting, investigation, remedies |
| 3 | **Conduct** | Data Security & Confidentiality | All employees | ✅ Mandatory | IP protection, data handling, passwords, incident reporting |
| 4 | **Attendance** | Attendance & Leave Policy | All employees | ✅ Mandatory | Punctuality, leave types, approval process, penalties |
| 5 | **Attendance** | Work From Home Policy | Eligible employees | ⚪ Recommended | Eligibility, approval, expected hours, equipment |
| 6 | **Attendance** | Travel & Conveyance Policy | All employees | ⚪ Recommended | Travel approval, reimbursement, safety, booking |
| 7 | **Benefits** | Salary & Compensation Policy | All employees | ✅ Mandatory | Components, withholding, payment, increments, deductions |
| 8 | **Benefits** | Benefits & Health Insurance | All employees | ✅ Mandatory | Health insurance, life insurance, retirement, wellness |
| 9 | **Benefits** | Performance Management & Appraisal | All employees | ⚪ Recommended | Goals, evaluation, feedback, ratings, increments |
| 10 | **Conduct** | Grievance & Dispute Resolution | All employees | ✅ Mandatory | Reporting, investigation, appeals, resolution timeline |
| 11 | **Lifecycle** | Onboarding, Transfer & Exit Policy | All employees | ✅ Mandatory | Orientation, documentation, separation, final settlement |
| 12 | **Conduct** | IT Use & BYOD Policy | All employees | ✅ Mandatory | Device use, internet use, personal devices, monitoring |

---

## Policy Templates & Standardized Structure

All policies follow this unified structure for consistency and clarity:

### Standard Policy Sections

**1. Policy Statement (50-100 words)**
- Clear, concise statement of the policy's purpose
- Why it matters to the company and employees
- One paragraph maximum

Example:
> "This policy establishes clear expectations for employee conduct and professional behavior. It ensures a respectful, inclusive workplace where all employees can perform effectively while protecting company assets and reputation."

**2. Scope & Applicability (25-50 words)**
- Who this policy applies to (all employees, specific roles, specific companies)
- When it applies (during work, after hours, online)
- Any exceptions clearly listed

Example:
> "This policy applies to all employees, contractors, and visitors on company premises. It extends to remote work arrangements, company-sponsored events, and online interactions representing the company."

**3. Key Definitions (Brief, clear)**
- Terminology specific to this policy (3-5 key terms max)
- Avoid jargon; if necessary, explain

Example:
> - **Misconduct:** Violation of this policy, work rules, or laws
> - **Immediate action:** Within 24 hours of incident
> - **Stakeholder:** Any affected employee or department

**4. Policy Details & Procedures (The core substance)**
- Organized in logical subsections
- Use numbered lists for step-by-step procedures
- Include decision trees for complex situations
- Maximum 300-400 words per policy

**Example Structure:**
```
4.1 Expected Conduct
- Treat all with respect and dignity
- Follow all applicable laws and regulations
- Protect company confidentiality and assets

4.2 What Constitutes Violation
- Discrimination or harassment (any form)
- Theft or misuse of company property
- Unauthorized disclosure of confidential information

4.3 Reporting & Escalation
1. Report incident to direct manager or HR within 24 hours
2. HR investigates within 5 working days
3. Interim measures taken if necessary
4. Written findings provided within 10 working days
```

**5. Consequences & Enforcement (Clear, progressive)**
- Progressive discipline (warning → suspension → termination)
- Severity based on nature and repeat offenses
- Clear timeline expectations

Example:
```
First Violation: Written warning + mandatory training
Second Violation: Suspension (3-5 days) + retraining
Third Violation: Termination

Severe Violations (theft, harassment, violence): 
Immediate suspension + potential termination + legal action
```

**6. Who To Contact (Accessibility)**
- HR contact information
- Hot-line for sensitive issues (e.g., harassment)
- Anonymous reporting options if applicable

Example:
> **Questions or Concerns?**
> - HR Department: hr@cpipl.com | Ext. 1234
> - Harassment Hotline: harassment-hotline@cpipl.com (confidential)
> - Anonymous Portal: [internal link] (tracked by number, not name)

**7. Effective Date & Version History**
- When policy became effective
- When last updated
- Major changes in this version

Example:
```
Effective Date: January 15, 2026
Version: 2.0 (Updated March 4, 2026)

Changes in v2.0:
- Added remote work guidelines
- Updated harassment reporting process
- Added anonymous reporting option
```

**8. Appendices (If needed)**
- Forms templates (acceptance form, incident report, etc.)
- Example scenarios
- FAQs
- Reference to related policies

---

## Detailed Policy Drafts

### Category 1: Conduct & Ethics

---

#### **Policy 1: Code of Conduct & Professional Ethics**

**1. Policy Statement**

This Code of Conduct establishes professional and ethical standards that guide employee behavior and decision-making. It reflects our commitment to integrity, respect, and compliance with all applicable laws. All employees are expected to uphold these standards in their work, interactions with colleagues, clients, and the public.

**2. Scope & Applicability**

Applies to all full-time, part-time, contract employees, interns, and any individual representing CPIPL. Covers conduct during work hours, at company events, and while representing the company online or offline.

**3. Key Definitions**

- **Conflict of Interest:** Situation where personal interests interfere with company interests
- **Confidential Information:** Any non-public company data (financial, strategic, client lists, technical)
- **Professional Conduct:** Behavior meeting company standards and legal requirements

**4. Core Principles**

**4.1 Integrity & Honesty**
- Conduct all business dealings with honesty and transparency
- Maintain accurate records and documentation
- Report errors or violations promptly
- Do not misrepresent facts or engage in deception

**4.2 Respect & Inclusion**
- Treat all colleagues with dignity regardless of role, background, or differences
- Listen to differing viewpoints and perspectives
- Support an inclusive culture free from discrimination
- Respect personal boundaries and privacy

**4.3 Conflict of Interest**
- Disclose any personal interests that could influence work decisions
- Avoid accepting gifts, loans, or favors from clients/vendors
- Refrain from competing with company during employment
- Report potential conflicts to HR immediately

**4.4 Company Resources**
- Use company property (equipment, funds, data) only for authorized business purposes
- Protect company information from unauthorized access or sharing
- Return all company property upon separation
- Do not access others' accounts or information without permission

**4.5 Compliance with Law**
- Comply with all applicable laws, regulations, and industry standards
- Do not engage in illegal activities on or off company premises
- Report suspected illegal conduct through appropriate channels
- Cooperate fully in investigations

**5. Prohibited Conduct**

- Theft, fraud, or embezzlement
- Discrimination or derogatory comments about protected characteristics
- Harassment, bullying, or intimidation
- Unauthorized access to company or personal systems
- Working under influence of drugs or alcohol
- Violent threats or physical violence
- Dishonest or deceitful business practices
- Sexual misconduct or inappropriate relationships

**6. Enforcement & Consequences**

| Violation | First | Second | Third |
|-----------|-------|--------|-------|
| Minor (Dishonesty, rudeness, minor policy violation) | Written warning | Suspension 1-3 days | Termination |
| Serious (Theft, discrimination, safety violation) | Suspension 3-5 days | Suspension 1-2 weeks | Termination |
| Severe (Harassment, violence, gross misconduct) | Immediate suspension | Investigation → Termination or legal action |

**7. Contact & Reporting**

- Questions: hr@cpipl.com
- To report violations: compliance@cpipl.com (confidential)
- Harassment hotline: 1-800-ETHICS (anonymous)
- Leadership concerns: executive@cpipl.com

**8. Related Policies**

- Anti-Harassment & Discrimination Policy
- Data Security & Confidentiality Policy
- Grievance Resolution Policy

---

#### **Policy 2: Anti-Harassment, Bullying & Discrimination**

**1. Policy Statement**

CPIPL is committed to a workplace free from harassment, bullying, and discrimination. We do not tolerate any form of misconduct based on protected characteristics, and we provide safe reporting and investigation mechanisms. All employees have the right to work in a respectful, dignified environment.

**2. Scope & Applicability**

Applies to all employees, contractors, clients, and visitors. Covers conduct at work, company events, online platforms, and any interaction involving company representatives.

**3. Key Definitions**

- **Harassment:** Unwelcome verbal, physical, or written conduct based on protected characteristics that creates a hostile environment
- **Bullying:** Repeated, unreasonable behavior directed at an individual that could reasonably cause psychological harm
- **Discrimination:** Unequal treatment based on race, gender, religion, age, disability, sexual orientation, or other protected characteristics
- **Protected Characteristics:** Age, gender, race, religion, disability, sexual orientation, marital status, national origin

**4. Prohibited Conduct**

**4.1 Harassment Based on Protected Characteristics**
- Offensive comments, jokes, or slurs about protected characteristics
- Unwelcome physical contact or advances
- Threats or intimidation
- Exclusion from work activities based on personal characteristics
- Unwanted communication of sexual nature
- Display of offensive images, symbols, or materials
- Creating a hostile work environment through any of the above

**4.2 Bullying & Mistreatment**
- Repeated public humiliation or criticism
- Deliberate exclusion from meetings, decisions, or information
- Unreasonable workload or impossible deadlines (discipline)
- Spreading rumors or false information about a person
- Abuse of authority or power
- Yelling, aggressive body language, or intimidating behavior

**4.3 Discrimination**
- Unequal pay or benefits based on protected characteristics
- Unequal promotion or advancement opportunities
- Adverse employment decisions (termination, demotion, denial of leave) based on protected characteristics
- Requiring employees to violate religious or cultural practices

**5. Reporting & Investigation Process**

**Step 1: Report (Within 24 hours of incident)**
- **To Direct Manager:** If comfortable and manager not involved
- **To HR:** If manager involved or you prefer confidentiality
- **To Hotline:** Anonymous complaint line (1-800-ETHICS)
- **To External:** Legal counsel for severe violations

**Step 2: Initial Assessment (Within 2 business days)**
- HR confirms receipt and outlines process
- Interim measures discussed (if safety at risk)
- Confidentiality assured and limitations explained

**Step 3: Investigation (Within 10 business days)**
- Formal investigation initiated
- Complainant, respondent, and witnesses interviewed
- Evidence collected and documented
- Confidentiality maintained to extent possible

**Step 4: Finding & Action (Within 5 business days of investigation completion)**
- Written summary provided to complainant and respondent
- If substantiated: disciplinary action taken
- If unsubstantiated: complainant informed, no action
- Appeal process outlined

**Step 5: Resolution & Monitoring (30+ days)**
- Disciplinary action implemented
- Environment monitored for retaliation
- Follow-up interviews scheduled
- Closure documentation completed

**6. Protection from Retaliation**

- No retaliation against persons for reporting in good faith
- No retaliation for cooperating in investigations
- Retaliation itself is grounds for disciplinary action
- Individuals can report retaliation through same channels

**7. Consequences**

| Violation | First | Second | Third |
|-----------|-------|--------|-------|
| Mild (Offensive comment, minor exclusion) | Verbal warning + training | Written warning + counseling | Suspension 1-3 days |
| Moderate (Repeated incidents, clear harassment) | Written warning + mandatory training | Suspension 3-5 days | Termination |
| Severe (Sexual harassment, threats, violence) | Suspension pending investigation | Immediate termination + possible legal action |

**8. Support & Resources**

- Counseling services (EAP - Employee Assistance Program)
- Mediation services for workplace conflicts
- Transfer options if working relationship broken
- Legal guidance (company covers legal counsel for complainants in validated cases)

**9. Contact Information**

- HR Director: hr@cpipl.com | Ext. 1234
- Harassment Hotline: 1-800-ETHICS (anonymous, 24/7)
- Legal Counsel: legal@cpipl.com
- Anonymous Reporting Portal: [internal URL]

---

#### **Policy 3: Data Security & Confidentiality**

**1. Policy Statement**

Protecting company and customer data is everyone's responsibility. This policy establishes requirements for handling confidential information, securing company systems, and reporting security incidents. Unauthorized access, use, or disclosure of confidential information is a serious violation that may result in disciplinary action and legal consequences.

**2. Scope & Applicability**

Applies to all employees with access to company systems or confidential information. Covers physical documents, digital files, databases, client information, financial data, intellectual property, and trade secrets.

**3. Key Definitions**

- **Confidential Information:** Non-public company data (financial, strategic, operational, technical, proprietary)
- **Security Incident:** Unauthorized access, loss, theft, or disclosure of confidential information
- **Data Breach:** Exposure of personal information (names, IDs, contact details, financial data) to unauthorized parties

**4. Data Handling Requirements**

**4.1 Access & Segregation**
- Minimum necessary access: Only access data needed for your role
- User accounts: Single sign-on with strong passwords (minimum 12 characters, mixed case, numbers, symbols)
- Multi-factor authentication: Required for sensitive systems and admin accounts
- Account sharing prohibited: Assign individual credentials, never share passwords

**4.2 Physical Security**
- Secure workstations: Lock computer when away (30+ seconds)
- Document storage: Keep confidential papers in locked drawers/cabinets
- Clean desk: Remove documents from desk before leaving
- Printing: Collect prints immediately; no leaving documents at printers
- Remote work: Secure home environment; no public Wi-Fi for company work

**4.3 Digital Security**
- Antivirus: Keep antivirus software active and updated
- Patches: Install security updates within 24 hours of availability
- Email: Do not open suspicious attachments; report phishing attempts
- Cloud storage: Use only company-approved tools; never use personal cloud services
- Device encryption: All devices with confidential data must be encrypted

**4.4 Communication**
- Email: Do not send passwords, financial data, or PII via email
- Messaging apps: Use only approved company messaging platforms
- Phone calls: Verify identity before discussing confidential information
- Public spaces: Do not discuss confidential matters in open office, elevators, or public spaces

**4.5 Disposal & Retention**
- Document destruction: Shred or incinerate confidential documents
- Hard drive disposal: Use certified wiping/destruction services
- Cloud deletion: Permanently delete from backups after retention period
- Retention period: Follow company retention policy (typically 3-7 years by type)

**5. Security Incident Reporting**

**Immediate Action (Within 30 minutes of discovering)**
1. Stop using the system if compromised
2. Report to IT Security: itsecurity@cpipl.com
3. If data breach suspected: Also notify HR and Legal immediately

**Information to Provide**
- What happened (e.g., "email with attachments forwarded to wrong recipient")
- When it happened (date and time)
- What data was affected (customer data, financial, strategic, etc.)
- How you discovered it
- Your contact information for follow-up

**IT Response (Within 4 hours)**
- Acknowledge incident receipt
- Assess severity (low, medium, high, critical)
- Take immediate containment measures if necessary
- Schedule investigation within 24 hours

**Investigation & Notification (Within 5 business days)**
- Complete investigation
- Determine scope of exposure
- Notify affected parties as required by law
- Implement remediation measures
- Document lessons learned

**6. Third-Party & Contractor Access**

- Contractors must sign confidentiality agreements
- Limit access to minimum necessary data
- Require same security standards as employees
- Revoke access immediately upon contract termination

**7. Post-Employment**

- All access revoked on last day of employment
- Company property (devices, documents) returned
- Confidentiality obligations continue indefinitely
- Understand non-compete and non-solicitation agreements

**8. Consequences for Violations**

| Violation | Consequence |
|-----------|------------|
| Shared password once (low risk) | Oral warning + retraining |
| Weak password or unpatched device | Written warning + mandatory update |
| Sent confidential data to wrong person | Suspension 1-5 days depending on severity |
| Suspected data breach | Immediate suspension + investigation |
| Intentional unauthorized access | Termination + legal action + possible prosecution |
| Selling/sharing trade secrets | Termination + lawsuit + criminal referral |

**9. Training & Support**

- Mandatory annual security training for all employees
- Quarterly phishing simulations and awareness campaigns
- Role-specific training (developers, HR, finance, etc.)
- 1-on-1 coaching available for employees with weak practices

**10. Contact & Resources**

- IT Security: itsecurity@cpipl.com | Ext. 2345
- HR (confidentiality questions): hr@cpipl.com
- Report security incident: itsecurity@cpipl.com (use [URGENT SECURITY] in subject)
- Anonymous reporting: security-hotline@cpipl.com

---

### Category 2: Attendance & Time Management

---

#### **Policy 4: Attendance & Leave**

**1. Policy Statement**

Consistent attendance is essential for business continuity and team collaboration. This policy establishes expectations for punctuality, leave requests, and absence reporting. CPIPL offers competitive leave benefits while maintaining operational needs. Employees must follow the approval process and communicate absences promptly.

**2. Scope & Applicability**

Applies to all full-time and part-time employees. Covers office hours, remote work, leaves of all types, and approved absences.

**3. Key Definitions**

- **Attendance:** Presence during scheduled working hours (as per individual shift or 9 AM - 6 PM standard)
- **Punctuality:** Arriving by start time; leaving at end time
- **Leave:** Authorized absence from work (paid or unpaid)
- **Attendance Exception:** Approved alternative work arrangement (WFH, flexible hours, sabbatical)

**4. Standard Work Hours & Attendance**

**4.1 Regular Hours**
- Standard office hours: 9:00 AM to 6:00 PM, Monday to Friday
- 1-hour lunch break (unpaid, 1-2 PM usually)
- Weekly hours: 40 hours per week, 8 hours per day
- Flexible arrival: 8:30 AM - 9:30 AM (but must work complete 8-hour shift)

**4.2 Shift-Based Roles**
- Work the assigned shift (see Shift Policy for details)
- Shifts may be morning (6 AM - 2 PM), afternoon (2 PM - 10 PM), night (10 PM - 6 AM)
- Shift changes require manager and HR approval
- Premium pay for night shift: +10% of base salary

**4.3 Punctuality Expectations**
- Arrive by scheduled start time
- Notify manager immediately if running late (call or message before start time)
- Repeated tardiness (3+ times per month) subject to counseling and disciplinary action
- Severe absences without notice (no-show) treated as unauthorized absence

**4.4 Absences from Desk**
- Inform team before leaving desk (30+ minutes)
- Use calendar to block time or out-of-office status
- Keep breaks under 15 minutes; total break time under 1 hour
- Long absences must be pre-approved by manager

**5. Types of Leave & Accrual**

**5.1 Paid Leave (PTO)**

| Leave Type | Annual | Accrual | Carryover | Notes |
|-----------|--------|---------|-----------|-------|
| Casual Leave (CL) | 12 days | 1 per month | 6 days | For urgent personal needs |
| Sick Leave (SL) | 10 days | Prorated | 5 days | Medical emergencies, illness, appointments |
| Earned Leave (EL) | 20 days | 1.67 per month | 10 days | Planned vacations, extended leave |
| Bereavement Leave | 5 days | — | — | Death of family member (spouse, children, parents, siblings) |

**5.2 Unpaid/Special Leave**

| Type | Duration | Approval | Notes |
|------|----------|----------|-------|
| Maternity Leave | 180 days | HR + Legal | Statutory benefit, job-protected |
| Paternity Leave | 10 days | HR | Statutory benefit, job-protected |
| Sabbatical | 3-6 months | Director + HR | Career development; unpaid |
| Compassionate Leave | 3 days | HR | Beyond immediate family (grandparents, aunts, uncles, close friends) |
| Marriage Leave | 5 days | HR | Employee's own wedding, no carryover |

**5.3 Leave Accrual & Payout**

- Accrual begins on first day of employment
- New hires receive pro-rata balance for first year
- Earned Leave and Casual Leave can be carried over (limits: 10 EL, 6 CL)
- Carried over leave must be used within 12 months
- Unused carryover expires if not used (no payout except statutory requirements)
- Upon termination: Unused Earned Leave paid out; Casual Leave typically forfeited (check labor law)

**6. Leave Request Process**

**Step 1: Request Submission**
1. Submit leave request in HR system (minimum 3 days advance notice)
2. Include dates, reason, and any coverage plan
3. For planned leaves, submit at least 1 week in advance

**Step 2: Manager Approval**
1. Manager reviews operational impact and team coverage
2. Approves or suggests alternative dates within 24 hours
3. Cannot arbitrarily deny but can suggest alternatives

**Step 3: HR Confirmation**
1. HR system confirms leave balance
2. Sends confirmation to employee
3. Notifies team calendar

**Step 4: On Last Day**
1. Handover outstanding work to designated colleague
2. Update project status in tracking systems
3. Out-of-office message on email

**Emergency Leave (Same Day)**
1. Call manager immediately (do not wait for email)
2. Provide brief explanation
3. Follow up with HR system request same day
4. Medical certificate required for sick leave 2+ days (within 3 days of return)

**7. Absence Reporting & Penalties**

**Authorized Absence** (Approved by manager/HR)
- No impact on salary or benefits
- Requires formal leave request
- Counted against leave balance

**Unauthorized Absence** (No notice, no approval)
- First occurrence: Oral warning + must be deducted from leave
- Second occurrence: Written warning + disciplinary meeting
- Third occurrence: Suspension 1-3 days or termination
- Pattern: If frequent (4+ times per quarter), may lead to performance improvement plan

**No-Show** (Absence without notice, 3+ consecutive days)
- Immediate suspension pending investigation
- Investigation to determine if voluntary separation
- If found unreliable, may lead to termination
- Company attempts contact before making decision

**Excessive Absenteeism** (15+ days in a quarter without justification)
- Performance improvement plan triggered
- Medical evaluation may be required
- Continued pattern may lead to termination

**8. Work From Home & Remote Arrangements**

(See Work From Home Policy for detailed requirements)
- Pre-approved by manager
- Counted as regular working hours if approved
- Must maintain responsiveness during hours
- Same attendance standards apply (no additional breaks, work full hours)

**9. Holiday Calendar**

- Published annually by HR (typically 12-15 national holidays)
- Holidays observed depend on location and company calendar
- Employees required to work on substitute holidays (if announced)
- Holiday compensation: 1x salary for regular workday, 2x for weekend

**10. Tracking & Records**

- Attendance tracked in HR system (automated clock-in/clock-out or manual entry)
- Monthly attendance report provided to employees
- Quarterly review with manager if issues noted
- Records retained for 3 years

**11. Consequences of Violations**

| Violation | First | Second | Third |
|-----------|-------|--------|-------|
| Late arrival (3+ times/month) | Counseling + reminder | Written warning | Suspension 1 day |
| Unauthorized absence (1 day) | Deduct from leave + warning | Written warning | Suspension 1 day |
| No-show (1-2 days) | Suspension pending investigation | Termination |
| Excessive absenteeism pattern | Performance improvement plan | Dismissal |

**12. Contact & Questions**

- Attendance matters: hr-leaves@cpipl.com
- Manager approval: Your direct manager
- Policy clarifications: hr@cpipl.com
- Exceptions/hardship: hr-leaves@cpipl.com

---

#### **Policy 5: Work From Home & Remote Work**

**1. Policy Statement**

CPIPL supports flexible work arrangements that balance employee well-being with business needs. This Work From Home policy establishes eligibility criteria, approval procedures, and expectations for remote workers. Employees working from home are expected to maintain the same productivity, professionalism, and communication standards as office-based employees.

**2. Scope & Applicability**

Applies to eligible employees whose roles can be performed remotely. Not applicable to: roles requiring physical presence (HR, facilities, security), interns, employees in probation period, or those with recent performance issues.

**3. Eligibility Criteria**

**Automatic Eligibility (No approval needed, up to 2 days/week)**
- 6+ months of tenure with company
- Satisfactory performance rating (meets or exceeds expectations)
- Agreed shift/hours with manager
- Reliable internet and quiet workspace at home
- Manager discretion to approve frequency

**Requires Approval (Request form, up to 5 days/week)**
- Project-based (temporary work from home): Submitted by manager
- Full-remote role: Submitted to HR with business case
- Medical/family circumstances: Submitted with supporting documents
- Approval period: 3-6 months, renewable

**Not Eligible**
- Probation period (first 6 months)
- Recent disciplinary action (3+ months cooling off)
- Client-facing roles without client approval
- Roles requiring hands-on presence (labs, manufacturing, etc.)

**4. Work From Home Request & Approval**

**Request Submission**
- Submit in HR system (minimum 1 week advance for regular requests)
- Include: Requested days, start date, end date, justification
- For ongoing WFH, include expected schedule

**Manager Review (48 hours)**
- Assess operational impact and team coverage
- Verify employee eligibility
- Approve, modify, or request discussion

**HR Review (if ongoing/full-time)**
- Confirm benefits continuity and tax implications
- Determine equipment support
- Final approval or escalation

**Employment Agreement Update**
- For permanent WFH: Update employment agreement or memo
- Define core hours, communication expectations, location
- Review annually or when circumstances change

**5. Equipment & Setup**

**Company-Provided Equipment**
- Laptop: Use company-issued laptop only (not personal computer)
- Monitor: 1x 24" monitor (provided or reimbursed up to $300)
- Chair: Ergonomic office chair (provided or reimbursed up to $500)
- Desk: Functional desk setup (not kitchen table, reimburse up to $200)

**Home Office Requirements**
- Quiet space (not open living area where others can overhear)
- Reliable internet connection (minimum 10 Mbps download/5 Mbps upload)
- Privacy: Ensure client/company information not visible to household members
- Lighting: Adequate lighting to work without eye strain
- Ergonomic: Chair and desk at proper height to prevent injury

**Internet & Connectivity**
- Employee responsible for reliable internet
- Reimbursement: Up to $50/month for internet (submit receipt)
- VPN: Must use company VPN for all company work
- Backup plan: If internet fails, work from alternative location (café, office, etc.)

**IT Security**
- Antivirus: Install and maintain antivirus software
- Firewall: Router must have firewall enabled
- Updates: Keep all software and OS updated
- WiFi: Use secure WiFi with strong password
- No public WiFi: Do not work on company systems on unsecured networks

**6. Work Hours & Communication**

**Core Hours (Must be available)**
- 10 AM - 1 PM: All employees must be reachable
- 2 PM - 4 PM: All employees must be available
- Outside core hours: Can be flexible if manager approved

**Expected Responsiveness**
- Email: Response within 2 hours during business hours
- Chat (Slack/Teams): Active status during working hours
- Meetings: Attend all scheduled meetings (video on unless instructed otherwise)
- Status updates: Share progress daily or as agreed with manager

**Communication Norms**
- Use video for 1-on-1 meetings and team syncs
- Have professional background or use virtual background
- Minimize distractions (mute notifications, avoid multitasking)
- Attend company events in person when held (WFH does not exempt from required events)

**7. Productivity & Performance Expectations**

**Same Standards as Office-Based**
- Deliver same quality and quantity of work
- Meet all deadlines and deliverables
- Participate actively in team collaboration
- Maintain same professional communication
- No reduction in work hours or output

**Monitoring & Trust**
- No desktop monitoring software or keystroke logging
- Performance based on output and results, not time-tracking
- Managers may ask for periodic status updates (not constant reporting)
- Regular 1-on-1s to discuss progress and challenges

**Hybrid Team Considerations**
- Coordinate with team: Ensure someone in office if needed
- Overlap with core team: If team in multiple time zones, coordinate coverage
- Documentation: Share work, decisions, updates with asynchronous communication

**8. Boundaries & Work-Life Balance**

**Working Hours**
- Work contracted hours only (typically 40 hours/week)
- Do not work extended hours regularly (report to manager if required)
- Take breaks: Step away from desk (lunch, walk, rest)
- End of day: Close laptop at 6 PM (or agreed end time)

**Availability After Hours**
- No expectation to answer emails after 6 PM or weekends
- Emergencies: On-call rotation for truly urgent matters (communicated separately)
- Communicate availability if traveling or taking time off

**Personal Care**
- Attend to personal appointments during work hours (no need for formal leave if brief)
- Notify team if unavailable for extended period (>30 min)
- Use HR fitness benefits or wellness programs (encourage, don't mandate)

**9. Off-Premises Work Security**

**Confidential Information**
- Do not print confidential documents at home (or use shredder)
- Keep screens away from windows and others' view
- Use privacy filters if visible from outside
- Lock laptop when away from desk
- Secure WiFi: Discuss sensitive topics only over VPN

**IT Security**
- Do not install unauthorized software
- Keep antivirus active and updated
- Do not connect company devices to unknown networks
- Report security concerns to IT immediately

**Conduct & Expectations**
- Maintain professional demeanor even at home (video calls)
- No drinking alcohol during work hours
- No using illegal substances (same policy as office)
- Avoid working from environments with loud noise or distractions during meetings

**10. Transition Back to Office**

**Reduced WFH Days**
- Manager may reduce WFH frequency with 2 weeks notice
- If operational needs change, discuss alternatives (different schedule, different days)

**Return to Office**
- If performance issues arise, manager may require return to office
- Discussed in performance meeting; employee has right to respond
- Reasonable transition period (2-4 weeks) unless urgent

**Loss of WFH Privilege**
- Performance improvement plan: Return to office during plan duration
- Disciplinary action: 3+ months back in office
- Repeated violations of WFH policy: Permanent revocation

**11. Policy Compliance & Violations**

| Violation | Consequence |
|-----------|------------|
| Miss core hours without notice (1st) | Warning + discussion |
| Unresponsive to messages repeatedly | Counseling |
| Work in shared space without privacy (client-facing) | Verbal warning; find alternative location |
| Non-compliance with IT security (weak password, no VPN) | IT reset + training |
| Missed deadlines correlated with WFH | Performance review; possible return to office |
| Misuse of WFH (extensive personal activities) | Return to office + disciplinary action |

**12. Review & Renewal**

- WFH arrangements reviewed every 6 months in performance discussion
- Feedback on productivity, collaboration, work-life balance
- Adjustments made as needed (more days, fewer days, different schedule)
- Annual confirmation required

**13. Contact & Support**

- WFH requests: hr@cpipl.com
- IT setup support: itsupport@cpipl.com
- Manager discussions: Your direct manager
- Questions: hr-operations@cpipl.com

---

### Category 3: Benefits & Compensation

---

#### **Policy 6: Salary & Compensation**

**1. Policy Statement**

This policy establishes CPIPL's approach to salary determination, compensation components, adjustments, and deductions. We are committed to fair, transparent, and competitive compensation that recognizes employee contributions and market standards. All employees will be informed of their compensation structure and any changes.

**2. Scope & Applicability**

Applies to all employees. Covers salary, allowances, bonuses, incentives, increments, deductions, and tax handling.

**3. Compensation Components**

**3.1 Base Salary**
- Fixed monthly salary determined by role, experience, qualifications, and market rates
- Paid on the last working day of the month
- For part-time employees, calculated as pro-rata daily rate

**3.2 Allowances** (Flexible, typically added to base)
- House Rent Allowance (HRA): 30-50% of base (varies by location and company policy)
- Dearness Allowance (DA): 5-10% of base, adjusted semi-annually per government indices
- Special Allowance: Role-specific (shift allowance for night shift, special duty allowance, etc.)
- Leave Travel Allowance (LTA): ₹2,400-4,000 annually for eligible employees

**3.3 Performance-Based Compensation**
- Performance bonus: Annual bonus ranging 0-25% of annual salary based on performance rating
- Incentive schemes: Project completion bonuses, sales targets, or productivity metrics (if applicable)
- Recognition rewards: Spot bonuses for exceptional contributions (₹1,000-₹5,000)

**3.4 Benefits** (See Benefits Policy)
- Health insurance: Company covers 50-100% of premium
- Life insurance: 2-5x annual salary coverage
- Retirement benefits: 12% EPF contribution + 3.67% EPS (employer contribution)
- Wellness allowance: ₹5,000-₹10,000 annually for gym, healthcare

**4. Salary Determination & Benchmarking**

**Internal Equity**
- Same role, same experience = same salary range
- Variations documented and justified (qualifications, years of experience, performance)
- Equal pay for equal work across gender and demographics

**Market Competitiveness**
- Salary ranges based on industry benchmarks and market surveys
- Annual review of salary bands ensures competitiveness
- Cost of living adjustments (COLA) applied annually or semi-annually

**Promotion & Increment Salary**
- Promotion typically includes 10-20% salary increase
- Annual increments (merit-based): 3-8% based on performance rating
- Salary negotiation allowed only at hire and promotion (not mid-year)

**5. Salary Adjustments & Increments**

**Annual Increments**
- Review cycle: April each year
- Basis: Performance rating from previous fiscal year
- Timing: Increments effective April 1 (or shortly after)

| Performance Rating | Increment Range |
|-------------------|-----------------|
| Exceeds Expectations (5) | 8-10% |
| Meets Expectations (4) | 5-7% |
| Meets Expectations (3) | 3-5% |
| Below Expectations (2) | 0-2% or nil |
| Unsatisfactory (1) | Nil |

**Promotion Salary**
- Promotion to higher grade: Base salary increased to minimum of higher grade (typically +10-20%)
- Example: If promoted from Analyst (₹3-5L) to Senior Analyst (₹5-7L), new salary minimum ₹5.5L
- Effective date: Date of promotion

**Salary Adjustments Mid-Year**
- Only for role changes or major responsibility additions (not for raises)
- Change in location (cost of living adjustment): +5-10% for relocation to expensive city
- Special circumstances: Hardship review by HR/Finance (rare, not automatic)

**Demotion Salary**
- Salary adjusted to match demoted role band
- Reduction in salary possible if current salary above upper limit of demoted role
- Implemented after discussion and consultation

**6. Deductions & Withholdings**

**Mandatory Deductions**
- Income Tax (IT): Withheld as per tax slabs and employee declaration
- Provident Fund (PF): 12% of basic salary (employee contribution; employer also contributes 12%)
- Professional Tax: State-specific, typically ₹0-2,500 annually

**Optional Deductions** (With written consent)
- Health Insurance Premium: Employee co-share (if applicable)
- Loan EMI: Against approved loans (housing, personal, education)
- Salary Advance: Adjustment of advances taken (max deduction: 50% of gross salary)
- Charitable Contributions: To approved NGOs (if employee opts in)

**Non-Deductible**
- Informal loans (disciplinary action)
- Penalty/fine (recovered as separate settlement, not salary deduction)
- Gratuity advance (separate agreement)

**7. Tax Planning & Declarations**

**Income Tax**
- Form 12BA/12BBB: Submit investment proofs for tax deductions by July 31
- Eligible investments: EPF, insurance premiums, education, medical, home loan interest
- Rebate claims: Under Section 87A (if applicable)

**Professional Tax**
- Withheld monthly by company
- Annual reconciliation done at year-end
- Refund processed if over-withheld

**Gratuity**
- Exemption limit: ₹500,000 (tax-free under Section 10(10)(ii))
- Taxed as income if exceeds limit (average across 4 years)

**8. Bonus & Incentive Programs**

**Performance Bonus** (Annual, January-March)
- Applicable to employees with 12+ months tenure
- Based on individual performance rating and company performance
- Typical range: 0-25% of annual salary
- Bonus forfeited if employed on date of payment not met

**Project Incentives** (If applicable)
- Milestone bonuses for on-time delivery
- Quality bonuses for zero-defect projects
- Amount: Defined per project (typically ₹5,000-₹25,000)
- Paid after project completion and billing

**Sales Incentives** (If applicable)
- Commission or bonus based on revenue generation or target achievement
- Structure defined per role (percentage of sales, tiered targets, etc.)
- Paid monthly or quarterly after realization

**Spot Bonuses** (Non-routine recognition)
- Ad-hoc bonus for exceptional contributions
- ₹1,000-₹5,000 typically
- Approved by manager and finance; no obligation
- Non-recurring, not part of base compensation

**9. Salary Payment & Timing**

**Payment Schedule**
- Monthly: Last working day of the month (or last Friday if 31st is weekend)
- Method: Direct bank transfer (NEFT/IMPS)
- Timing: Credited by 6 PM on payment day

**Salary Advance**
- Available upon request (max: 50% of monthly gross salary)
- Repayment: Deducted from next 2-3 paychecks
- Frequency: Max 2 advances per fiscal year without exceptional circumstances
- Interest: Nil, but advance reduces take-home pay in that month

**Late/Delayed Payment**
- If payment delayed: Interest @ 12% per annum accrues (statutory requirement)
- HR notified immediately; escalated to CFO
- Root cause analysis and corrective action within 5 days

**10. Separation & Final Settlement**

**Upon Resignation** (Full and Final Settlement)
- Full and Final Settlement (F&F) processed within 15 days of exit
- Components included:
  - Salary for worked days in last month
  - Earned Leave encashment (if applicable)
  - Gratuity (if 5+ years service)
  - Dues refund: Any salary advances, loans
- Final paycheck includes F&F amount

**Upon Termination** (For Cause)
- Salary due until last day of employment (no additional notice pay)
- Earned Leave encashment: Typically forfeited unless statutory requirement
- Gratuity: Forfeited for gross misconduct; paid for other reasons
- Outstanding dues: Recovered from final settlement

**Upon Termination** (Without Cause/Retrenchment)
- Notice Pay: If terminated without notice, 1 month salary paid as notice compensation
- Earned Leave: Encashed at full value
- Gratuity: Paid per statutory formula (½ month salary per year of service)
- Severance: Additional severance (if company policy) = 1 week per year of service

**11. Compliance & Transparency**

**Salary Slip**
- Provided monthly within 5 days of payment
- Shows: Gross salary, deductions, net pay, YTD totals
- Includes: Basic, HRA, DA, allowances, PF, IT, other deductions
- Accessible online via HR system

**Salary Transparency**
- New employees: Receive written salary offer before joining
- All changes communicated in writing
- Annual form 12BA/12BBB: Submitted by HR to enable tax deduction claims
- Annual Form 16: Provided by January 31 of following financial year

**Payment Records**
- Maintain 3-year record of all salary payments, advances, deductions
- Annual reconciliation of EPF, IT, Professional Tax
- Audit trail available for compliance verification

**Dispute Resolution**
- If salary discrepancy noticed: Report to HR within 30 days
- Investigation within 5 working days
- Correction applied in next paycheck + interest (if delayed payment)

**12. Confidentiality**

- Salary is confidential and should not be disclosed to colleagues
- Sharing salary information: Not grounds for disciplinary action, but discouraged
- HR does not disclose salary info to other employees (even managers, except need-to-know)
- Disclosure of salary during recruitment: HR strictly confidential

**13. Changes in Compensation**

**Scope Changes (Promotion, Role Change, Relocation)**
- Discussed with employee before finalization
- Written confirmation provided
- Effective date agreed upon
- Salary change processed in next payroll cycle

**Company-Initiated Changes**
- Salary restructuring: Advance notice of 30 days (rare, for business reasons)
- Salary cut: Only for company survival (restructuring, crisis), with consultation
- Salary hold: During performance improvement plan (temporary, until plan completion)

**Policy Changes**
- Changes to allowances, benefits: 30 days advance notice
- Changes to deductions, tax treatment: Communicated with explanation
- Annual adjustments (DA, COLA): Communicated in January

**14. Contact & Clarifications**

- Salary-related questions: hr-payroll@cpipl.com
- Advance/loan requests: hr-finance@cpipl.com
- Tax deduction claims: hr-payroll@cpipl.com
- Salary discrepancies: Escalate to HR Manager
- Confidential matters: Finance Manager directly

---

### Category 4: Lifecycle & Exit

---

#### **Policy 7: Onboarding, Transfer & Separation**

**1. Policy Statement**

This policy ensures a smooth transition for employees joining, moving between roles, and exiting CPIPL. Clear onboarding accelerates productivity, fair separation processes protect both employees and the company, and transparent transfer guidelines support career development.

**2. Scope & Applicability**

Applies to all full-time employees at joining, during internal transfers, and upon separation.

**3. Onboarding Process (New Employees)**

**Before Joining (HR Preparation)**

*One Week Before*
- Prepare workstation: Desk, computer, equipment, phone
- Create IT accounts: Email, network access, VPN
- Arrange badge/access card
- Prepare welcome packet: Employee handbook, policies, key contacts
- Notify team and manager of new employee details

*Day Before*
- Conduct final background verification if not yet done
- Ensure all equipment ready and tested
- Manager reviews onboarding checklist with team

**Day 1 (First Day Onboarding)**

*Morning (9:00 AM - 12:00 PM)*
1. Reception & Welcome
   - Meet HR representative at reception
   - Offer water/refreshment
   - Present welcome packet
   - Review day's schedule

2. HR Orientation (1 hour)
   - Tour of office facilities (restrooms, cafeteria, emergency exits)
   - IT credentials provided and email tested
   - Overview of HR systems (leave application, expense claims, timesheets)
   - Review of policies (attendance, code of conduct, confidentiality)
   - Q&A session

3. Manager Introductions
   - Meet direct manager
   - Tour of department
   - Meet immediate team members

*Afternoon (1:00 PM - 6:00 PM)*
1. Role & Responsibility Briefing
   - Manager reviews job description and expectations
   - Key projects and priorities explained
   - Success metrics and KPIs clarified

2. System Access & Passwords
   - IT support sets up computer and access
   - Password change enforcement
   - VPN, email, collaboration tools tested

3. Team Activities
   - Lunch with team (manager pays for welcome lunch)
   - Informal introductions to other departments
   - Settle into workspace

**Week 1 (First Week Onboarding)**

*Daily*
- Attend morning standup with team
- Meet cross-functional colleagues
- Review standard operating procedures (SOPs) for role

*By End of Week*
- Meet department head
- Understand team dynamics and processes
- Schedule 1-on-1 with manager to discuss first week experience

*By End of Week Documents*
- Complete I-form, tax declaration (Form 12BA)
- Provide bank details for salary
- Take mandatory photo for ID card
- Sign employee agreement and policies acknowledgment

**Week 2-4 (First Month Onboarding)**

*Structured Learning*
- Assign onboarding buddy/mentor (if applicable)
- Formal training on tools, systems, and processes (4-8 hours)
- Review of department goals and how role contributes
- Introduction to client/vendor relationships (if applicable)

*Check-Ins*
- Weekly 1-on-1 with manager to discuss progress
- Feedback from team on performance and integration
- Adjustments to learning plan if needed

*By End of Month*
- Complete core onboarding checklist
- Pass IT security training and policy acknowledgment quiz
- Have first month review with manager (informal)

**3-Month Probation**

- Standard probation period for all new employees
- At 6 weeks: HR check-in on progress (any concerns raised early)
- At 2.5 months: Manager evaluation of performance
- At 3 months: Formal probation review
  - Pass: Employment confirmed, benefits activated
  - Conditional pass: Performance improvement plan, probation extended 1 month
  - Fail: Employment terminated with 1 week notice (or pay in lieu)

**Onboarding Checklist** (Provided to employee)

- [ ] Workspace setup and building access
- [ ] IT account and equipment
- [ ] Policy review and acknowledgment
- [ ] Tax and bank details submitted
- [ ] ID card and badge received
- [ ] IT security training completed
- [ ] Department orientation completed
- [ ] Meet manager and team
- [ ] Understand role and key projects
- [ ] System access verified
- [ ] First assignment/project assigned
- [ ] 30-day check-in scheduled
- [ ] 90-day probation review scheduled

---

#### **Policy 8: Exit, Separation & Final Settlement**

**1. Resignation Process**

**Notice Requirement**
- Employees should provide written notice (minimum 30 days)
- Notice in writing: Email to manager and HR, or formal letter
- Last working day: 30 days after notice date
- During notice period: Continue working normally; no check-out yet

**During Notice Period**
- Complete knowledge transfer: Document your projects and processes
- Assist successor: Train replacement or back-fill
- Maintain professionalism and attendance
- No reduction in responsibilities (until final week)
- Handover material: Deliver all project files and documentation to manager

**Final Week**
- Transfer all outstanding work to designated colleague
- Return all company property (laptop, phone, access cards, keys)
- Retrieve personal items from office
- Clear email out-of-office message
- Revoke access: IT will disable accounts at end of day on last working day

**2. Involuntary Termination**

**Termination for Cause** (Serious misconduct)
- Immediate suspension pending investigation
- Investigation period: 5-10 working days
- Decision communicated in writing with reasons
- Options: Termination with 1-week notice (paid notice) or immediate termination
- Final settlement processed within 15 days

**Termination Without Cause** (Restructuring, elimination of position)
- Minimum 1 month advance notice (or 1 month salary in lieu)
- May offer separation package (severance + extra leave payout)
- Transition support offered: Placement assistance, reference letter
- Final settlement processed within 15 days of last day

**Lay-off** (Temporary, economic reasons)
- Employees put on unpaid leave temporarily (typically 3-6 months)
- Employment contract remains intact
- Benefits maintained (health insurance, etc.)
- Recall priority: Rehired first when operations resume
- If not recalled within timeframe: Treated as termination without cause

**Retrenchment** (Permanent elimination of position)
- Statutory compliance: Follows labor law requirements
- Selection process: Merit-based or seniority (depends on labor law)
- Severance: 15 days' salary per year of service (statutory minimum)
- Notice: 30 days or 1 month salary in lieu
- Settlement: Within 15 days of separation

**3. Final Settlement (Full & Final)**

**Settlement Components** (Paid within 15 days of last day)

| Component | Calculation | Condition |
|-----------|-------------|-----------|
| Pending Salary | Days worked × (salary / 30) | Always paid |
| Earned Leave (EL) | Unused days × (daily rate) | Paid if entitled per labor law |
| Casual Leave (CL) | Varies | Often forfeited for cause; paid for other reasons |
| Gratuity | (½ × monthly salary × years of service) | Only if 5+ years service |
| Severance | (1 week × years of service) | Only for retrenchment without cause |
| Leave Travel Allowance | If not yet availed in year | Prorated if partial year |
| LTA reimbursement | Claim submission | If expenses already incurred |
| Incentive/Bonus | Prorated to exit date | If earned but not yet paid |

**Settlement Deductions**

| Deduction | Reason |
|-----------|--------|
| Salary advances | Remaining balance, if any |
| Loans | Outstanding EMIs (may be deferred) |
| Amounts due | Property damage, loss of company items |
| Statutory deductions | Final IT withholding, professional tax |
| Health insurance premium | Employee's share if ongoing coverage |

**Settlement Timing**
- Resignation/Without cause: Processed on last day, paid within 15 days
- For cause: Processed within 15 days; may be held pending investigations
- Gratuity: May be paid separately (statutory compliance)

**4. Separation Formalities**

**Documentation**
- Final settlement letter: Shows all components and deductions
- Relieving letter: Confirms last day of employment (issued by HR)
- Experience certificate: Optional, requested by employee (issued within 3 days)
- Transfer certificate (if required): For statutory purposes
- Conduct certificate: Optional, for reference purposes

**Asset Return** (Must return all items)
- Company laptop, phone, charger
- Access card, building keys
- Security badge
- Any company documents or materials
- Equipment checked by manager before sign-off

**System Access Revocation**
- Email access: Disabled after knowledge transfer (typically last day, end of business)
- Network access: Disabled at 6 PM on last day
- VPN: Access revoked
- Building access: Badge deactivated
- Third-party access: Removed from client systems, project management tools
- Collaboration tools: Removed from teams, Slack, etc.

**Knowledge Transfer Documentation**
- Project status document: Summary of ongoing projects
- Contact list: Important client, vendor, and internal contacts
- Process documentation: How to perform key tasks
- Handover meeting: 1-2 hour meeting with replacement (if available)
- Follow-up: Available for brief questions after exit (typically 2 weeks, via email)

**Exit Interview**
- Conducted by HR after last day (within 1 week)
- Feedback on experience: What was good, what could improve
- Reason for leaving: Honest feedback appreciated
- Suggestions: For company improvement
- Optional: Employee may decline exit interview
- Confidential: Shared with HR and leadership only

**5. References & Recommendations**

**Employment Verification**
- Company confirms: Job title, dates of employment, salary (if agreed)
- Provided to prospective employers upon written request
- Employee privacy respected; no detailed performance info shared

**Manager Reference**
- Manager may provide reference to employees who request it
- Not obligatory; manager's discretion
- Typically limited to: "Yes, they worked here and were satisfactory"
- More detailed feedback: Usually avoided to prevent liability

**Recommendation Letters**
- Written recommendation available upon request
- Issued by direct manager or HR
- Should be honest, objective assessment
- Typical length: 1-2 paragraphs
- Example: "X was a diligent team member with strong communication skills..."

**Dispute & Defamation**
- Company does not provide negative references intentionally
- If employee feels harmed by reference: May file complaint; HR investigates
- Any false or defamatory statements: Legal action possible

**6. Post-Employment Obligations**

**Non-Compete Agreement**
- If signed at hiring: Continues post-employment (typically 6-12 months)
- Prevents working with direct competitors
- Geographic scope: City/region where company operates
- Violation: Company may seek legal remedy

**Non-Solicitation Agreement**
- If signed: Continues post-employment (typically 12 months)
- Prevents soliciting company clients or employees
- Violation: Company may seek injunction and damages

**Confidentiality & Trade Secrets**
- Obligations continue indefinitely
- Cannot disclose company trade secrets, proprietary information, or client lists
- Applies even after separation
- Violation: Company may pursue legal action

**Cooperation**
- May be called upon as witness in company disputes or legal matters
- Expected to provide honest, factual testimony
- Company may cover legal costs if testifying as employee representative

**7. Special Circumstances**

**Deceased Employee**
- Final settlement: Processed to legal heir/nominee within 30 days
- Gratuity and benefits: Paid to designated beneficiary
- Company support: Extends sympathy, may cover funeral assistance (per policy)
- Dependents: May apply for health insurance continuation (check policy)

**Separation Due to Medical Condition**
- If employee cannot continue work: May be medically separated
- Medical evaluation: Conducted by company doctor and independent physician
- Final settlement: Full payment including gratuity if applicable
- Disability benefits: May apply if 40%+ disability certification

**Redundancy / Role Elimination**
- Employee offered: Alternative positions within company (if available)
- Training: Provided for new role if different skill set required
- If no alternative: Separated without cause (receives severance package)
- Preference: Seniority + performance considered for retention

**Resignation During Notice Period**
- If manager terminates before 30-day notice ends: Employee paid notice pay
- If employee quit before full notice: Liable for damages (rarely enforced)
- Settlement: Calculated based on actual last working day

**8. Compliance & Records**

**Retention**
- Personnel files: Kept for 7 years after separation
- Final settlement documents: Kept for 7 years
- Exit interview notes: Kept per HR policy (typically 3 years)

**Employee Rights**
- Access to personal file: Upon request, within 30 days
- Privacy: Confidentiality maintained post-employment
- Corrections: If record contains errors, may be updated/corrected

**Company Obligations**
- Timely final payment (within 15 days legal requirement)
- Accurate documentation
- No withholding of dues without justification
- Compliance with labor laws regarding severance and benefits

**9. Contact & Support**

- Resignation/Notice: Your direct manager + hr@cpipl.com
- Final settlement questions: hr-finance@cpipl.com
- Exit interview: HR Coordinator
- Post-exit questions: hr@cpipl.com (for first 6 months)

---

## Policy Management System Implementation

### Backend Features (Already Implemented)

✅ **Policy Creation & Management**
- Admin creates policies with title, category, content, sections
- Version control: Track all changes with changelog
- Mandatory vs. optional policy distinction
- Company-specific policies support

✅ **Policy Acceptance Tracking**
- Employee accepts policy, version recorded
- Prevents re-acceptance if already accepted (same version)
- Version changes trigger re-acceptance requirement
- IP address and timestamp captured

✅ **Compliance Monitoring**
- Scorecard: View all active policies and acceptance rates
- Pending list: See employees with outstanding policy acceptances
- Impact analysis: By department, by role, by company

✅ **Policy Comparison & History**
- Full version history with changel logs
- Compare two versions side-by-side
- Track who changed policy and when

✅ **Conflict Detection**
- Automated detection of policy contradictions (in same category)
- Flags policies with overlapping scope or conflicting rules

### Frontend Implementation (To Be Created)

**Employee-Facing Features**
- Policy listing: View all active policies
- Policy details: Read full policy with sections
- Acceptance tracking: See which policies accepted, when
- Version changes: View what changed in latest version
- Acceptance history: See all accepted versions

**Admin Features**
- Policy dashboard: Overview of all policies
- Bulk management: Create, edit, disable policies
- Acceptance reports: Who accepted, who pending
- Conflict resolution: Address flagged conflicts
- Scorecard view: See protection score and gaps

---

## Implementation Timeline

### Phase 1: Foundation (Week 1-2)
- Finalize and review 12 core policies
- Get legal review for compliance
- Prepare backend data (enter policies in system)

### Phase 2: Release (Week 3)
- Publish policies to employee portal
- Send notifications: "New policies require acceptance"
- Implement grace period (5-7 days)

### Phase 3: Enforcement (Week 4-6)
- Track acceptance: Daily monitoring
- Send reminders: Employees with pending
- Final deadline: All employees must accept
- Escalate: Non-compliance reported to managers

### Phase 4: Ongoing (Monthly)
- Monitor compliance metrics
- Update policies as needed (quarterly review)
- Conduct annual policy review (February/March)
- Update for legal/regulatory changes

---

## Key Improvements Over Current System

| Aspect | Before | After |
|--------|--------|-------|
| Policy Count | 25+ scattered policies | 12 consolidated, organized policies |
| Clarity | Inconsistent terminology, unclear procedures | Standardized structure, clear language |
| Redundancy | Multiple overlapping policies | Single source of truth per topic |
| Legal Protection | Gaps in coverage | Comprehensive compliance |
| Employee Experience | Difficult to find relevant policy | Easy navigation, clear guidance |
| Admin Overhead | Manual acceptance tracking | Automated tracking and reporting |
| Updates | Time-consuming, prone to errors | Version control with clear changelogsVersion control with clear changelogs |

---

## Recommendations Summary

1. **Adopt the 12 Core Policies Framework** - Reduces complexity while maintaining comprehensive coverage
2. **Implement Standardized Structure** - All policies follow consistent format for clarity
3. **Leverage Existing Technology** - Use Policy, PolicyVersion, PolicyAcceptance models fully
4. **Create Admin Dashboard** - View compliance metrics and conflicts at a glance
5. **Annual Review Process** - Schedule quarterly policy review (legal + HR team)
6. **Employee Communication** - Provide clear guidance on policy locations and purpose
7. **Legal Vetting** - Have employment lawyer review policies for compliance
8. **Phased Rollout** - Implement policies gradually with employee education

---

## Next Steps

1. **Legal Review**: Submit 12 policies to employment law consultant (₹50,000-₹100,000)
2. **Finalization**: Incorporate legal feedback and specific CPIPL terms
3. **Employee Communication**: Draft notification email and FAQs
4. **System Setup**: Enter policies into backend system (3-5 days)
5. **Testing**: Verify acceptance workflow works end-to-end
6. **Launch**: Notify employees, set 5-day grace period
7. **Monitoring**: Track acceptance daily; escalate non-compliance

**Estimated Timeline:** 4-6 weeks from approval to full rollout

---

**Document Created:** March 4, 2026  
**Version:** 1.0  
**Status:** Ready for Executive Review
