const fs = require('fs');
const path = require('path');

const files = [
  'src/pages/portal/Dashboard.jsx',
  'src/pages/portal/MyApplication.jsx',
  'src/pages/portal/DocumentManager.jsx',
  'src/pages/portal/ApplicationReview.jsx',
  'src/pages/portal/ApplicationTracker.jsx',
  'src/pages/admin/AdminDashboard.jsx',
  'src/pages/admin/ApplicationDetail.jsx',
  'src/pages/admin/AdminApplicants.jsx'
];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');

  const imports = new Set([
    'React', 'Fragment', 'Link', 'useNavigate', 'useParams', 'useSearchParams',
    'Button', 'Card', 'CardContent', 'CardHeader', 'CardTitle', 'CardDescription', 'CardFooter',
    'Badge', 'Progress', 'Input', 'Label', 'Textarea', 'Select', 'SelectContent', 'SelectItem',
    'SelectTrigger', 'SelectValue', 'Dialog', 'DialogContent', 'DialogHeader', 'DialogTitle',
    'DialogDescription', 'DialogFooter', 'Table', 'TableBody', 'TableCell', 'TableHead', 'TableHeader', 'TableRow',
    'Tooltip', 'TooltipContent', 'TooltipProvider', 'TooltipTrigger', 'TypeableSelect'
  ]);

  // Named imports: import { ... } from '...'
  const importNamedRegex = /import\s*\{([\s\S]*?)\}\s*from/g;
  let match;
  while ((match = importNamedRegex.exec(content)) !== null) {
    match[1].split(',').forEach(n => {
      const parts = n.trim().split(/\s+as\s+/);
      const name = (parts[1] || parts[0]).trim();
      if (name) imports.add(name);
    });
  }

  // Default imports: import Foo from '...'
  const importDefRegex = /import\s+([A-Za-z0-9_$]+)\s+from/g;
  while ((match = importDefRegex.exec(content)) !== null) {
    imports.add(match[1].trim());
  }

  // Locally declared components / variables
  const declRegex = /(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/g;
  while ((match = declRegex.exec(content)) !== null) {
    imports.add(match[1].trim());
  }

  // All JSX tags: <Tag or <Tag.Sub
  const jsxRegex = /<([A-Z][A-Za-z0-9_]*)/g;
  const missing = new Set();
  while ((match = jsxRegex.exec(content)) !== null) {
    const tag = match[1];
    if (!imports.has(tag)) {
      missing.add(tag);
    }
  }

  if (missing.size > 0) {
    console.log(`[!] ${file} has MISSING identifiers:`, Array.from(missing));
  } else {
    console.log(`[OK] ${file}`);
  }
}
