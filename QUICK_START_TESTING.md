# Quick Start: Asset Repair System Testing

**⚡ TL;DR Version - Just Want to Run Tests?**

---

## 1. Start Backend (Terminal 1)

```bash
cd "D:\Activity Report Software\server"
npm run dev
```

**Wait for:** `Server running on port 5000`

---

## 2. Run Tests (Terminal 2)

```bash
cd "D:\Activity Report Software\server"
node tests/repair-endpoints.test.js
```

**Wait for:** Test summary with success rate

---

## 3. Expected Output

```
✅ PASS: 10/10 tests
✅ ALL TESTS PASSED - System is production ready
```

---

## 4. If Tests Fail

1. Check error message in output
2. Refer to `ASSET_REPAIR_TEST_EXECUTION_GUIDE.md` for solutions
3. Common issue: **No assigned assets** → Create an asset with status='assigned'

---

## 5. After Tests Pass

1. Copy test output to a file
2. Save timestamp
3. Mark task #18 as COMPLETED in todo list
4. Document results

---

## File Locations

| File | Path |
|------|------|
| Test Suite | `server/tests/repair-endpoints.test.js` |
| Full Guide | `ASSET_REPAIR_TEST_EXECUTION_GUIDE.md` |
| Test Plan | `ASSET_REPAIR_TEST_PLAN.md` |
| Progress | `PHASE_2_PROGRESS_REPORT.md` |

---

## Prerequisites Checklist

- [ ] Node.js installed (`node --version`)
- [ ] npm available (`npm --version`)
- [ ] Database exists (`server/prisma/dev.db`)
- [ ] Dependencies installed (`npm install` in server)

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Server won't start | Check port 5000 isn't in use; restart npm |
| Tests can't connect | Ensure backend is running on port 5000 |
| No assigned assets | Create/modify an asset to status='assigned' |
| Node not found | Reinstall Node.js or check PATH |

---

## Test Suite Stats

- **Total Tests:** 10
- **Coverage:** All 8 repair endpoints + 2 integration tests
- **Duration:** 15-30 seconds
- **Success Rate Target:** 100% (10/10 pass)

---

## What Gets Tested

✅ Initiate repair  
✅ Get active repair  
✅ List all repairs  
✅ Update status  
✅ Get timeline  
✅ Edit details  
✅ Complete repair  
✅ Get overdue repairs  
✅ Member access denied  
✅ Proper error handling  

---

## Commands Reference

```bash
# Start backend
cd "D:\Activity Report Software\server" && npm run dev

# Run tests
cd "D:\Activity Report Software\server" && node tests/repair-endpoints.test.js

# Save results
cd "D:\Activity Report Software\server" && node tests/repair-endpoints.test.js > test-results.txt

# View database
cd "D:\Activity Report Software\server" && npx prisma studio

# Reinstall deps
cd "D:\Activity Report Software\server" && npm install
```

---

## Success Indicators

✅ Tests show green checkmarks  
✅ Final message: "ALL TESTS PASSED"  
✅ Success rate: 100% (10/10)  
✅ No red error messages  
✅ Response times: <1 sec per test  

---

**That's it! You're ready to test.** 🚀

For detailed info, see the full guides above.
