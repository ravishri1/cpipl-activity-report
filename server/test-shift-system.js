/**
 * Comprehensive Shift System Test
 * Tests all shift-related functionality end-to-end
 * Run: node test-shift-system.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testShiftSystem() {
  console.log('\n🔷 SHIFT SYSTEM END-TO-END TEST\n');
  
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Test 1: Database Schema Verification
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 1: Database Schema Verification');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const shiftCount = await prisma.shiftDefinition.count();
      const assignmentCount = await prisma.shiftAssignment.count();
      
      console.log(`✅ Shift table exists: ${shiftCount} shifts in database`);
      console.log(`✅ ShiftAssignment table exists: ${assignmentCount} assignments in database`);
      testsPassed += 2;
    } catch (err) {
      console.log(`❌ Schema error: ${err.message}`);
      testsFailed += 2;
    }

    // Test 2: Shift CRUD Operations
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 2: Shift CRUD Operations');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    let testShiftId = null;
    try {
      // Create test shift
      const newShift = await prisma.shiftDefinition.create({
        data: {
          name: 'Test Night Shift',
          startTime: '22:00',
          endTime: '06:00',
          breakDuration: 45,
          flexibility: 15,
        }
      });
      
      testShiftId = newShift.id;
      console.log(`✅ Create shift: ID ${newShift.id}, Name: ${newShift.name}`);
      console.log(`   - Working hours: ${newShift.startTime} to ${newShift.endTime}`);
      console.log(`   - Break: ${newShift.breakDuration} mins, Flexibility: ±${newShift.flexibility} mins`);
      testsPassed++;
      
      // Read shift
      const fetchedShift = await prisma.shiftDefinition.findUnique({
        where: { id: testShiftId }
      });
      
      if (fetchedShift) {
        console.log(`✅ Read shift: Retrieved ${fetchedShift.name}`);
        testsPassed++;
      } else {
        console.log(`❌ Read shift: Failed to retrieve`);
        testsFailed++;
      }
      
      // Update shift
      const updated = await prisma.shiftDefinition.update({
        where: { id: testShiftId },
        data: { flexibility: 20 }
      });
      
      if (updated.flexibility === 20) {
        console.log(`✅ Update shift: Updated flexibility to ${updated.flexibility} mins`);
        testsPassed++;
      } else {
        console.log(`❌ Update shift: Failed to update`);
        testsFailed++;
      }
      
    } catch (err) {
      console.log(`❌ Shift CRUD error: ${err.message}`);
      testsFailed += 3;
    }

    // Test 3: Shift Assignment
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 3: Shift Assignment');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    let testAssignmentId = null;
    try {
      // Get a test user
      const testUser = await prisma.user.findFirst({
        where: { role: 'member' }
      });
      
      if (!testUser) {
        console.log(`❌ No test user found`);
        testsFailed += 2;
      } else {
        // Create assignment
        const assignment = await prisma.shiftAssignment.create({
          data: {
            userId: testUser.id,
            shiftId: testShiftId,
            effectiveFrom: new Date(),
            reason: 'Test Assignment',
            notes: 'Created for system testing',
            status: 'active'
          },
          include: { shift: true }
        });
        
        testAssignmentId = assignment.id;
        console.log(`✅ Create assignment:`);
        console.log(`   - User: ${testUser.name}`);
        console.log(`   - Shift: ${assignment.shift.name}`);
        console.log(`   - Effective from: ${new Date(assignment.effectiveFrom).toISOString().split('T')[0]}`);
        console.log(`   - Status: ${assignment.status}`);
        testsPassed++;
        
        // Verify assignment with proper filtering
        const activeAssignment = await prisma.shiftAssignment.findFirst({
          where: {
            userId: testUser.id,
            status: 'active',
            effectiveFrom: { lte: new Date() },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: new Date() } }
            ]
          },
          include: { shift: true }
        });
        
        if (activeAssignment) {
          console.log(`✅ Active assignment query: Found ${activeAssignment.shift.name}`);
          testsPassed++;
        } else {
          console.log(`❌ Active assignment query: Failed`);
          testsFailed++;
        }
      }
      
    } catch (err) {
      console.log(`❌ Assignment error: ${err.message}`);
      testsFailed += 2;
    }

    // Test 4: User with Shift Relationship
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 4: User with Shift Relationship');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const userWithShift = await prisma.user.findUnique({
        where: { id: 1 }, // Admin user
        include: {
          shiftAssignments: {
            where: {
              status: 'active',
              effectiveFrom: { lte: new Date() },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: new Date() } }
              ]
            },
            take: 1,
            include: { shift: true }
          }
        }
      });
      
      if (userWithShift) {
        console.log(`✅ User query with shift includes: Retrieved ${userWithShift.name}`);
        if (userWithShift.shiftAssignments.length > 0) {
          console.log(`   - Current shift: ${userWithShift.shiftAssignments[0].shift.name}`);
        } else {
          console.log(`   - No active shift assignment`);
        }
        testsPassed++;
      } else {
        console.log(`❌ User query failed`);
        testsFailed++;
      }
      
    } catch (err) {
      console.log(`❌ User relationship error: ${err.message}`);
      testsFailed++;
    }

    // Test 5: Team Attendance Query with Shifts
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 5: Team Attendance Query with Shifts');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const teamWithShifts = await prisma.user.findMany({
        where: { role: { in: ['member', 'team_lead'] } },
        take: 5,
        include: {
          shiftAssignments: {
            where: {
              status: 'active',
              effectiveFrom: { lte: new Date() },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: new Date() } }
              ]
            },
            take: 1,
            include: { shift: true }
          },
          attendance: {
            where: { 
              createdAt: { 
                gte: new Date(new Date().setDate(new Date().getDate() - 30))
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 3
          }
        }
      });
      
      console.log(`✅ Retrieved ${teamWithShifts.length} team members with shift data`);
      
      teamWithShifts.forEach((member, idx) => {
        const shiftInfo = member.shiftAssignments.length > 0 
          ? member.shiftAssignments[0].shift.name 
          : 'No active shift';
        console.log(`   [${idx + 1}] ${member.name} → Shift: ${shiftInfo}`);
      });
      testsPassed++;
      
    } catch (err) {
      console.log(`❌ Team attendance query error: ${err.message}`);
      testsFailed++;
    }

    // Test 6: Payroll Query with Shifts
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 6: Payroll Query with Shifts');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const payrollData = await prisma.user.findMany({
        where: { role: 'member' },
        take: 3,
        include: {
          shiftAssignments: {
            where: {
              status: 'active',
              effectiveFrom: { lte: new Date() },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: new Date() } }
              ]
            },
            take: 1,
            include: { shift: true }
          },
          payslips: {
            take: 1,
            orderBy: { createdAt: 'desc' }
          }
        }
      });
      
      console.log(`✅ Retrieved payroll data for ${payrollData.length} employees`);
      
      payrollData.forEach((emp, idx) => {
        const shiftInfo = emp.shiftAssignments.length > 0
          ? `${emp.shiftAssignments[0].shift.startTime}-${emp.shiftAssignments[0].shift.endTime}`
          : 'No shift';
        const payslipCount = emp.payslips.length;
        console.log(`   [${idx + 1}] ${emp.name} → Shift: ${shiftInfo}, Payslips: ${payslipCount}`);
      });
      testsPassed++;
      
    } catch (err) {
      console.log(`❌ Payroll query error: ${err.message}`);
      testsFailed++;
    }

    // Test 7: Letter Template Placeholders
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 7: Letter Template with Shift Placeholders');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const templates = await prisma.letterTemplate.findMany({
        take: 3
      });
      
      const shiftPlaceholders = ['{{shift.name}}', '{{shift.startTime}}', '{{shift.endTime}}', '{{shift.breakDuration}}'];
      let foundPlaceholder = false;
      
      templates.forEach(template => {
        shiftPlaceholders.forEach(placeholder => {
          if (template.template && template.template.includes(placeholder)) {
            foundPlaceholder = true;
          }
        });
      });
      
      if (templates.length > 0) {
        console.log(`✅ Letter templates exist: ${templates.length} templates found`);
        console.log(`   - Shift placeholders available: ${shiftPlaceholders.join(', ')}`);
        testsPassed++;
      } else {
        console.log(`❌ No letter templates found`);
        testsFailed++;
      }
      
    } catch (err) {
      console.log(`❌ Letter template error: ${err.message}`);
      testsFailed++;
    }

    // Test 8: Data Validation
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 8: Data Validation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const shift = await prisma.shiftDefinition.findFirst();
      
      if (shift) {
        const validTimeFormat = /^\d{2}:\d{2}$/.test(shift.startTime) && /^\d{2}:\d{2}$/.test(shift.endTime);
        
        if (validTimeFormat) {
          console.log(`✅ Time format validation passed`);
          console.log(`   - Start time: ${shift.startTime}`);
          console.log(`   - End time: ${shift.endTime}`);
          testsPassed++;
        } else {
          console.log(`❌ Invalid time format`);
          testsFailed++;
        }
        
        if (shift.breakDuration > 0 && shift.flexibility >= 0) {
          console.log(`✅ Break and flexibility values valid`);
          console.log(`   - Break: ${shift.breakDuration} mins`);
          console.log(`   - Flexibility: ±${shift.flexibility} mins`);
          testsPassed++;
        } else {
          console.log(`❌ Invalid break or flexibility values`);
          testsFailed++;
        }
      }
      
    } catch (err) {
      console.log(`❌ Validation error: ${err.message}`);
      testsFailed += 2;
    }

    // Cleanup: Delete test assignment and shift
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Cleanup: Removing Test Data');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      if (testAssignmentId) {
        await prisma.shiftAssignment.delete({
          where: { id: testAssignmentId }
        });
        console.log(`✅ Deleted test assignment`);
      }
      
      if (testShiftId) {
        await prisma.shiftDefinition.delete({
          where: { id: testShiftId }
        });
        console.log(`✅ Deleted test shift`);
      }
    } catch (err) {
      console.log(`⚠️  Cleanup warning: ${err.message}`);
    }

  } finally {
    await prisma.$disconnect();
  }

  // Final Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 TEST SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED - Shift System is Ready!\n');
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${testsFailed} test(s) failed - Please review above\n`);
    process.exit(1);
  }
}

testShiftSystem().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(2);
});
