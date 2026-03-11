#!/usr/bin/env node

/**
 * CPIPL Feature Scaffold Generator
 *
 * Generates boilerplate route + component files following project patterns.
 * Saves Claude tokens by handling routine CRUD scaffolding locally.
 *
 * Usage:
 *   node scripts/scaffold.js <feature-name> [--fields name:String,status:String] [--admin-only]
 *
 * Examples:
 *   node scripts/scaffold.js visitors --fields name:String,purpose:String,visitDate:String
 *   node scripts/scaffold.js meetings --fields title:String,date:String,duration:Int --admin-only
 */

const fs = require('fs');
const path = require('path');

// Parse CLI args
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log(`
CPIPL Feature Scaffold Generator
=================================

Usage:
  node scripts/scaffold.js <feature-name> [options]

Options:
  --fields field1:Type,field2:Type   Define model fields (String, Int, Boolean, Float)
  --admin-only                       All routes require admin role
  --no-component                     Skip frontend component generation

Examples:
  node scripts/scaffold.js visitors --fields name:String,purpose:String,visitDate:String,status:String
  node scripts/scaffold.js meetings --fields title:String,date:String,duration:Int --admin-only

This generates:
  1. server/src/routes/<name>.js       (Express route with CRUD)
  2. client/src/components/<Name>Manager.jsx  (React component)
  3. Prisma schema snippet (printed to console — paste manually)
  4. app.js registration line (printed to console — paste manually)
  `);
  process.exit(0);
}

const featureName = args[0];
const adminOnly = args.includes('--admin-only');
const noComponent = args.includes('--no-component');

// Parse fields
let fields = [];
const fieldsIdx = args.indexOf('--fields');
if (fieldsIdx !== -1 && args[fieldsIdx + 1]) {
  fields = args[fieldsIdx + 1].split(',').map(f => {
    const [name, type] = f.split(':');
    return { name, type: type || 'String' };
  });
}

// Naming helpers
const kebab = featureName.toLowerCase().replace(/([A-Z])/g, '-$1').replace(/^-/, '');
const camel = featureName.charAt(0).toLowerCase() + featureName.slice(1);
const pascal = featureName.charAt(0).toUpperCase() + featureName.slice(1);
const routePath = kebab;

// ============================================
// 1. GENERATE BACKEND ROUTE
// ============================================
const requireFieldsList = fields.map(f => `'${f.name}'`).join(', ');
const prismaCreateData = fields.map(f => `        ${f.name}: req.body.${f.name}`).join(',\n');
const prismaUpdateData = fields.map(f => `        ...(req.body.${f.name} !== undefined && { ${f.name}: req.body.${f.name} })`).join(',\n');

const routeContent = `const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

// List all (admin) or own (member)
router.get('/', ${adminOnly ? 'requireAdmin, ' : ''}asyncHandler(async (req, res) => {
  const where = ${adminOnly ? '{}' : "req.user.role === 'admin' ? {} : { userId: req.user.id }"};
  const items = await req.prisma.${camel}.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true } } }
  });
  res.json(items);
}));

// Get by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const item = await req.prisma.${camel}.findUnique({ where: { id } });
  if (!item) throw notFound('${pascal}');
${adminOnly ? '' : `  if (req.user.role !== 'admin' && req.user.id !== item.userId) throw forbidden();\n`}  res.json(item);
}));

// Create
router.post('/', ${adminOnly ? 'requireAdmin, ' : ''}asyncHandler(async (req, res) => {
${requireFieldsList ? `  requireFields(req.body, ${requireFieldsList});\n` : ''}  const item = await req.prisma.${camel}.create({
    data: {
${prismaCreateData}${adminOnly ? '' : ',\n        userId: req.user.id'}
    }
  });
  res.status(201).json(item);
}));

// Update
router.put('/:id', ${adminOnly ? 'requireAdmin, ' : ''}asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const existing = await req.prisma.${camel}.findUnique({ where: { id } });
  if (!existing) throw notFound('${pascal}');
${adminOnly ? '' : `  if (req.user.role !== 'admin' && req.user.id !== existing.userId) throw forbidden();\n`}
  const item = await req.prisma.${camel}.update({
    where: { id },
    data: {
${prismaUpdateData}
    }
  });
  res.json(item);
}));

// Delete
router.delete('/:id', ${adminOnly ? 'requireAdmin, ' : ''}asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const existing = await req.prisma.${camel}.findUnique({ where: { id } });
  if (!existing) throw notFound('${pascal}');
${adminOnly ? '' : `  if (req.user.role !== 'admin' && req.user.id !== existing.userId) throw forbidden();\n`}
  await req.prisma.${camel}.delete({ where: { id } });
  res.json({ message: '${pascal} deleted successfully' });
}));

module.exports = router;
`;

// ============================================
// 2. GENERATE FRONTEND COMPONENT
// ============================================
const formFields = fields.map(f => `${f.name}: ''`).join(', ');
const formInputs = fields.map(f => `
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">${f.name.charAt(0).toUpperCase() + f.name.slice(1).replace(/([A-Z])/g, ' $1')}</label>
              <input
                type="${f.type === 'Int' || f.type === 'Float' ? 'number' : 'text'}"
                value={form.${f.name}}
                onChange={e => setForm(prev => ({ ...prev, ${f.name}: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>`).join('\n');

const tableHeaders = fields.map(f => `                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">${f.name.charAt(0).toUpperCase() + f.name.slice(1).replace(/([A-Z])/g, ' $1')}</th>`).join('\n');
const tableCells = fields.map(f => `                <td className="px-4 py-3 text-sm text-gray-900">{item.${f.name}}</td>`).join('\n');

const componentContent = `import { useState } from 'react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';

const INITIAL_FORM = { ${formFields} };

export default function ${pascal}Manager() {
  const { data: items, loading, error, refetch } = useFetch('/api/${routePath}', []);
  const { execute, loading: saving, error: saveErr, success } = useApi();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);

  const openCreate = () => {
    setForm(INITIAL_FORM);
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setForm({ ${fields.map(f => `${f.name}: item.${f.name} || ''`).join(', ')} });
    setEditing(item);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (editing) {
      await execute(() => api.put(\`/api/${routePath}/\${editing.id}\`, form), '${pascal} updated!');
    } else {
      await execute(() => api.post('/api/${routePath}', form), '${pascal} created!');
    }
    refetch();            // RELOAD data
    setShowForm(false);   // CLOSE form
    setEditing(null);     // CLEAR editing state
    setForm(INITIAL_FORM); // RESET form
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this?')) return;
    await execute(() => api.delete(\`/api/${routePath}/\${id}\`), '${pascal} deleted!');
    refetch();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">${pascal} Management</h1>
        <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          + Add ${pascal}
        </button>
      </div>

      {success && <AlertMessage type="success" message={success} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
            <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit' : 'Add'} ${pascal}</h2>
            <div className="space-y-4">
${formInputs}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {items.length === 0 ? (
        <EmptyState icon="📋" title="No ${pascal} Records" subtitle="Click '+ Add ${pascal}' to create one" />
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
${tableHeaders}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
${tableCells}
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
`;

// ============================================
// 3. WRITE FILES
// ============================================
const routeDir = path.join(__dirname, '..', 'server', 'src', 'routes');
const componentDir = path.join(__dirname, '..', 'client', 'src', 'components');

// Write route file
const routeFile = path.join(routeDir, `${camel}.js`);
if (fs.existsSync(routeFile)) {
  console.log(`\n  SKIPPED: ${routeFile} already exists`);
} else {
  fs.writeFileSync(routeFile, routeContent);
  console.log(`\n  CREATED: server/src/routes/${camel}.js`);
}

// Write component file
if (!noComponent) {
  const compFile = path.join(componentDir, `${pascal}Manager.jsx`);
  if (fs.existsSync(compFile)) {
    console.log(`  SKIPPED: ${compFile} already exists`);
  } else {
    fs.writeFileSync(compFile, componentContent);
    console.log(`  CREATED: client/src/components/${pascal}Manager.jsx`);
  }
}

// ============================================
// 4. PRINT MANUAL STEPS
// ============================================
const prismaModel = `
model ${pascal} {
  id        Int      @id @default(autoincrement())
${fields.map(f => `  ${f.name.padEnd(10)} ${f.type}`).join('\n')}
${adminOnly ? '' : '  userId    Int\n  user      User     @relation(fields: [userId], references: [id])\n'}  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}`;

console.log(`
================================================
  MANUAL STEPS REQUIRED:
================================================

1. Add to schema.prisma:
${prismaModel}

2. Add to server/src/app.js:
   const ${camel}Routes = require('./routes/${camel}');
   app.use('/api/${routePath}', ${camel}Routes);

3. Run migration:
   cd server && npx prisma db push

4. Add to frontend router (App.jsx or routes config):
   import ${pascal}Manager from './components/${pascal}Manager';
   <Route path="/${routePath}" element={<${pascal}Manager />} />

================================================
`);
