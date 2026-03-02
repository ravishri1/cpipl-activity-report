const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");

// Helper: check if user is admin or team_lead
function isAdmin(user) {
  return user.role === "admin" || user.role === "team_lead";
}

// Priority sort order mapping
const PRIORITY_ORDER = { urgent: 0, important: 1, normal: 2 };

// ============================================================
// GET /celebrations - Upcoming birthdays & work anniversaries
// Must be defined BEFORE GET /:id to avoid route conflicts
// ============================================================
router.get("/celebrations", authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
    const currentYear = now.getFullYear();

    // Fetch active employees in the user company
    const employees = await req.prisma.user.findMany({
      where: {
        isActive: true,
        companyId: req.user.companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        dateOfBirth: true,
        dateOfJoining: true,
        department: true,
      },
    });

    const birthdays = [];
    const anniversaries = [];

    for (const emp of employees) {
      // Check birthdays: dateOfBirth format is "YYYY-MM-DD"
      if (emp.dateOfBirth) {
        const parts = emp.dateOfBirth.split("-");
        if (parts.length === 3) {
          const birthMonth = parts[1];
          const birthDay = parts[2];
          if (birthMonth === currentMonth) {
            birthdays.push({
              id: emp.id,
              name: emp.name,
              date: emp.dateOfBirth,
              day: parseInt(birthDay, 10),
              department: emp.department || null,
            });
          }
        }
      }

      // Check work anniversaries: dateOfJoining format is "YYYY-MM-DD"
      if (emp.dateOfJoining) {
        const parts = emp.dateOfJoining.split("-");
        if (parts.length === 3) {
          const joinYear = parseInt(parts[0], 10);
          const joinMonth = parts[1];
          const joinDay = parts[2];
          const years = currentYear - joinYear;
          // Only include if at least 1 year completed and the month matches
          if (joinMonth === currentMonth && years >= 1) {
            anniversaries.push({
              id: emp.id,
              name: emp.name,
              date: emp.dateOfJoining,
              day: parseInt(joinDay, 10),
              department: emp.department || null,
              years,
            });
          }
        }
      }
    }

    // Sort by day within the month
    birthdays.sort((a, b) => a.day - b.day);
    anniversaries.sort((a, b) => a.day - b.day);

    // Remove the temporary "day" field used for sorting
    const cleanBirthdays = birthdays.map(({ day, ...rest }) => rest);
    const cleanAnniversaries = anniversaries.map(({ day, ...rest }) => rest);

    return res.json({
      birthdays: cleanBirthdays,
      anniversaries: cleanAnniversaries,
    });
  } catch (error) {
    console.error("Error fetching celebrations:", error);
    return res.status(500).json({ error: "Failed to fetch celebrations" });
  }
});

// ============================================================
// GET / - List active announcements for the authenticated user
// ============================================================
router.get("/", authenticateToken, async (req, res) => {
  try {
    const now = new Date();

    // Use AND to combine the two OR conditions correctly
    const announcements = await req.prisma.announcement.findMany({
      where: {
        isActive: true,
        AND: [
          {
            OR: [
              { companyId: null },
              { companyId: req.user.companyId },
            ],
          },
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: now } },
            ],
          },
        ],
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Sort by priority (urgent > important > normal), then by createdAt desc
    announcements.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] !== undefined ? PRIORITY_ORDER[a.priority] : 2;
      const pb = PRIORITY_ORDER[b.priority] !== undefined ? PRIORITY_ORDER[b.priority] : 2;
      const priorityDiff = pa - pb;
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return res.json(announcements);
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return res.status(500).json({ error: "Failed to fetch announcements" });
  }
});
// ============================================================
// POST / - Create a new announcement (admin/team_lead only)
// ============================================================
router.post("/", authenticateToken, async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res
        .status(403)
        .json({ error: "Access denied. Admin or team lead role required." });
    }

    const { title, content, category, priority, companyId, expiresAt } =
      req.body;

    if (!title || !content) {
      return res
        .status(400)
        .json({ error: "Title and content are required." });
    }

    const validCategories = [
      "general",
      "policy",
      "event",
      "birthday",
      "anniversary",
    ];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({
        error:
          "Invalid category. Must be one of: " + validCategories.join(", "),
      });
    }

    const validPriorities = ["normal", "important", "urgent"];
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({
        error:
          "Invalid priority. Must be one of: " + validPriorities.join(", "),
      });
    }

    const announcement = await req.prisma.announcement.create({
      data: {
        title,
        content,
        category: category || "general",
        priority: priority || "normal",
        companyId: companyId !== undefined ? companyId : null,
        postedBy: req.user.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return res.status(201).json(announcement);
  } catch (error) {
    console.error("Error creating announcement:", error);
    return res.status(500).json({ error: "Failed to create announcement" });
  }
});

// ============================================================
// PUT /:id - Update an announcement (admin/team_lead only)
// ============================================================
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res
        .status(403)
        .json({ error: "Access denied. Admin or team lead role required." });
    }

    const announcementId = parseInt(req.params.id, 10);
    if (isNaN(announcementId)) {
      return res.status(400).json({ error: "Invalid announcement ID." });
    }

    // Verify the announcement exists
    const existing = await req.prisma.announcement.findUnique({
      where: { id: announcementId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Announcement not found." });
    }

    const { title, content, category, priority, companyId, expiresAt, isActive } =
      req.body;

    // Validate category if provided
    const validCategories = [
      "general",
      "policy",
      "event",
      "birthday",
      "anniversary",
    ];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({
        error:
          "Invalid category. Must be one of: " + validCategories.join(", "),
      });
    }

    // Validate priority if provided
    const validPriorities = ["normal", "important", "urgent"];
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({
        error:
          "Invalid priority. Must be one of: " + validPriorities.join(", "),
      });
    }

    // Build update data from provided fields only
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (category !== undefined) updateData.category = category;
    if (priority !== undefined) updateData.priority = priority;
    if (companyId !== undefined) updateData.companyId = companyId;
    if (expiresAt !== undefined)
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await req.prisma.announcement.update({
      where: { id: announcementId },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error("Error updating announcement:", error);
    return res.status(500).json({ error: "Failed to update announcement" });
  }
});

// ============================================================
// DELETE /:id - Soft deactivate an announcement (admin/team_lead only)
// ============================================================
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res
        .status(403)
        .json({ error: "Access denied. Admin or team lead role required." });
    }

    const announcementId = parseInt(req.params.id, 10);
    if (isNaN(announcementId)) {
      return res.status(400).json({ error: "Invalid announcement ID." });
    }

    // Verify the announcement exists
    const existing = await req.prisma.announcement.findUnique({
      where: { id: announcementId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Announcement not found." });
    }

    // Soft delete: set isActive to false
    await req.prisma.announcement.update({
      where: { id: announcementId },
      data: { isActive: false },
    });

    return res.json({ message: "Announcement deactivated successfully." });
  } catch (error) {
    console.error("Error deactivating announcement:", error);
    return res
      .status(500)
      .json({ error: "Failed to deactivate announcement" });
  }
});

module.exports = router;
