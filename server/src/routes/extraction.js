const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { normalizeEmail, normalizeName } = require('../utils/normalize');

const router = express.Router();

const EXTRACTION_PROMPT = `You are an HR data extraction assistant. Extract employee information from the following resume/biodata text and return ONLY a valid JSON object.

Extract these fields (use null for missing/unclear data):

{
  "name": "Full name",
  "email": "Work/official email",
  "personalEmail": "Personal email if different from work email",
  "phone": "Phone number with country code",
  "dateOfBirth": "YYYY-MM-DD format",
  "gender": "male/female/other",
  "bloodGroup": "e.g. O+, A-, B+",
  "maritalStatus": "single/married/divorced/widowed",
  "fatherName": "Father's name",
  "spouseName": "Spouse name if married",
  "nationality": "e.g. Indian",
  "religion": "Religion if mentioned",
  "address": "Current address",
  "permanentAddress": "Permanent address if different",
  "placeOfBirth": "Place of birth",
  "aadhaarNumber": "12-digit Aadhaar number",
  "panNumber": "PAN card number",
  "passportNumber": "Passport number",
  "drivingLicense": "Driving license number",
  "bankName": "Bank name",
  "bankAccountNumber": "Account number",
  "bankIfscCode": "IFSC code",
  "designation": "Current/latest job title",
  "department": "Department if mentioned",
  "previousExperience": "Total years of experience as a number",
  "education": [
    {
      "degree": "e.g. B.Tech, MBA, 12th",
      "institution": "School/college name",
      "university": "University name",
      "specialization": "e.g. Computer Science",
      "yearOfPassing": "e.g. 2020",
      "percentage": "e.g. 85% or 8.5 CGPA"
    }
  ],
  "previousEmployment": [
    {
      "company": "Company name",
      "designation": "Job title",
      "fromDate": "YYYY-MM-DD or approximate",
      "toDate": "YYYY-MM-DD or approximate",
      "ctc": "CTC/salary if mentioned",
      "reasonForLeaving": "Reason if mentioned"
    }
  ],
  "familyMembers": [
    {
      "name": "Member name",
      "relationship": "father/mother/spouse/child/sibling",
      "dateOfBirth": "YYYY-MM-DD if available",
      "occupation": "Occupation if mentioned",
      "phone": "Phone if mentioned"
    }
  ]
}

IMPORTANT:
- Return ONLY the JSON object, no markdown, no explanation
- Use null for fields not found in the text
- For arrays, return empty array [] if no data found
- Normalize dates to YYYY-MM-DD format where possible
- Extract ALL education entries (10th, 12th, graduation, post-grad)
- Extract ALL previous jobs/employment entries

Resume/Biodata text:
---
`;

// POST /api/extraction/resume — Extract data from pasted resume text
router.post('/resume', authenticate, requireAdmin, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ error: 'Resume text is required.' });
    }

    // Get Gemini API key from settings
    const setting = await req.prisma.setting.findUnique({ where: { key: 'gemini_api_key' } });
    if (!setting?.value) {
      return res.status(400).json({ error: 'Gemini API key not configured. Go to Admin → Settings to add it.' });
    }

    // Dynamic import for ES module
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(setting.value);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = EXTRACTION_PROMPT + text.trim() + '\n---';

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON from response (handle markdown code blocks)
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    let extracted;
    try {
      extracted = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse Gemini response:', responseText);
      return res.status(500).json({ error: 'AI returned invalid format. Please try again.' });
    }

    // Apply normalization
    if (extracted.name) extracted.name = normalizeName(extracted.name);
    if (extracted.email) extracted.email = normalizeEmail(extracted.email);
    if (extracted.personalEmail) extracted.personalEmail = normalizeEmail(extracted.personalEmail);
    if (extracted.fatherName) extracted.fatherName = normalizeName(extracted.fatherName);
    if (extracted.spouseName) extracted.spouseName = normalizeName(extracted.spouseName);

    // Normalize education entries
    if (extracted.education?.length) {
      extracted.education = extracted.education.filter((e) => e && e.degree);
    }
    // Normalize employment entries
    if (extracted.previousEmployment?.length) {
      extracted.previousEmployment = extracted.previousEmployment.filter((e) => e && e.company);
    }
    // Normalize family entries
    if (extracted.familyMembers?.length) {
      extracted.familyMembers = extracted.familyMembers
        .filter((f) => f && f.name)
        .map((f) => ({ ...f, name: normalizeName(f.name) }));
    }

    res.json(extracted);
  } catch (err) {
    console.error('AI extraction error:', err);
    const msg = err.message?.includes('API_KEY_INVALID')
      ? 'Invalid Gemini API key. Check Settings.'
      : 'AI extraction failed. Please try again.';
    res.status(500).json({ error: msg });
  }
});

module.exports = router;
