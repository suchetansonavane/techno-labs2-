#!/bin/bash

# 🚀 Neon Techno Lab - Pre-Deployment Verification Script
# This script checks all requirements before deploying to Vercel

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     NEON TECHNO LAB - DEPLOYMENT VERIFICATION SCRIPT        ║"
echo "║                    v1.0 - May 16, 2026                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0
WARN=0

# Helper functions
check_pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((PASS++))
}

check_fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((FAIL++))
}

check_warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
    ((WARN++))
}

section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# 1. Check Node.js and npm
section "1️⃣  Checking Node.js & npm"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    check_pass "Node.js installed: $NODE_VERSION"
else
    check_fail "Node.js not found. Install from https://nodejs.org/"
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    check_pass "npm installed: $NPM_VERSION"
else
    check_fail "npm not found"
fi

# 2. Check project structure
section "2️⃣  Checking Project Structure"

declare -a files_required=(
    "package.json"
    "vite.config.ts"
    "tsconfig.json"
    "index.html"
    "index.tsx"
    "App.tsx"
    "services/groqService.ts"
    "api/groq-proxy.ts"
    "vercel.json"
    "SECURITY.md"
)

for file in "${files_required[@]}"; do
    if [ -f "$file" ]; then
        check_pass "File exists: $file"
    else
        check_fail "Missing file: $file"
    fi
done

# 3. Check for API keys in version control
section "3️⃣  Checking for Exposed API Keys"

if grep -r "gsk_" --include="*.ts" --include="*.tsx" --include="*.js" --exclude-dir=node_modules --exclude-dir=dist . 2>/dev/null; then
    check_fail "⚠️ Found Groq API key in source code! Remove before deploying."
else
    check_pass "No Groq API keys in source code"
fi

if grep -r "AIzaSy" --include="*.ts" --include="*.tsx" --include="*.js" --exclude-dir=node_modules --exclude-dir=dist . 2>/dev/null; then
    check_fail "⚠️ Found Gemini API key in source code! Remove before deploying."
else
    check_pass "No Gemini API keys in source code"
fi

# 4. Check .gitignore
section "4️⃣  Checking .gitignore Configuration"

if grep -q ".env.local" .gitignore; then
    check_pass ".env.local is in .gitignore"
else
    check_warn ".env.local not in .gitignore (should protect secrets)"
fi

if grep -q "dist/" .gitignore; then
    check_pass "dist/ is in .gitignore"
else
    check_warn "dist/ not in .gitignore"
fi

# 5. Check dependencies
section "5️⃣  Checking Dependencies"

if [ -f "package-lock.json" ]; then
    check_pass "package-lock.json exists (reproducible builds)"
else
    check_warn "package-lock.json not found (run 'npm ci' for reproducible builds)"
fi

# Check for required dependencies
if grep -q '"@vercel/node"' package.json; then
    check_pass "@vercel/node in package.json (for API functions)"
else
    check_warn "@vercel/node not in package.json (needed for Vercel Functions)"
fi

if grep -q '"react":' package.json; then
    check_pass "React dependency found"
else
    check_fail "React not in package.json"
fi

if grep -q '"vite":' package.json; then
    check_pass "Vite dependency found"
else
    check_fail "Vite not in package.json"
fi

# 6. Check configuration files
section "6️⃣  Checking Configuration Files"

if [ -f "vercel.json" ]; then
    if grep -q "GROQ_API_KEY" vercel.json; then
        check_pass "Vercel config has GROQ_API_KEY environment variable"
    else
        check_warn "GROQ_API_KEY not listed in vercel.json environment"
    fi
else
    check_fail "vercel.json not found"
fi

if [ -f "vite.config.ts" ]; then
    # Check that API keys are NOT in define
    if grep -q 'process.env.GROQ_API_KEY.*JSON.stringify' vite.config.ts; then
        check_fail "❌ CRITICAL: API key still being embedded in bundle (vite.config.ts)"
    else
        check_pass "API keys not embedded in vite.config.ts bundle"
    fi
else
    check_fail "vite.config.ts not found"
fi

# 7. Check environment configuration
section "7️⃣  Checking Environment Configuration"

if [ -f ".env.local" ]; then
    if grep -q "GROQ_API_KEY" .env.local; then
        check_pass ".env.local has GROQ_API_KEY configured"
    else
        check_warn ".env.local exists but GROQ_API_KEY not set"
    fi
else
    check_warn ".env.local not found (needed for local development)"
fi

# 8. Check for build output
section "8️⃣  Checking Build Output"

if [ -d "dist" ]; then
    SIZE=$(du -sh dist | cut -f1)
    check_pass "dist/ directory exists (size: $SIZE)"
    
    if [ -f "dist/index.html" ]; then
        check_pass "dist/index.html exists"
    else
        check_warn "dist/index.html not found (run 'npm run build')"
    fi
else
    check_warn "dist/ not found (run 'npm run build' first)"
fi

# 9. Check TypeScript configuration
section "9️⃣  Checking TypeScript Configuration"

if [ -f "tsconfig.json" ]; then
    check_pass "tsconfig.json found"
    
    if grep -q '"target".*"ES2022"' tsconfig.json; then
        check_pass "TypeScript target set to ES2022"
    else
        check_warn "TypeScript target not ES2022 (check compatibility)"
    fi
else
    check_fail "tsconfig.json not found"
fi

# 10. Check Git status
section "🔟 Checking Git Status"

if command -v git &> /dev/null; then
    if git rev-parse --git-dir > /dev/null 2>&1; then
        UNCOMMITTED=$(git status --short | wc -l)
        if [ "$UNCOMMITTED" -eq 0 ]; then
            check_pass "Git repository clean (no uncommitted changes)"
        else
            check_warn "Git repository has $UNCOMMITTED uncommitted changes"
            echo "Run 'git status' to see details"
        fi
    else
        check_fail "Not a Git repository"
    fi
else
    check_warn "Git not found (needed for Vercel deployment)"
fi

# 11. Check security files
section "1️⃣1️⃣  Checking Security Documentation"

if [ -f "SECURITY.md" ]; then
    check_pass "SECURITY.md exists"
else
    check_fail "SECURITY.md not found"
fi

if [ -f "REQUIREMENTS.md" ]; then
    check_pass "REQUIREMENTS.md exists"
else
    check_warn "REQUIREMENTS.md not found"
fi

if [ -f "README_SETUP.md" ]; then
    check_pass "README_SETUP.md exists"
else
    check_warn "README_SETUP.md not found"
fi

# Final Summary
section "📊 VERIFICATION SUMMARY"

echo ""
echo -e "${GREEN}PASSED:  $PASS${NC}"
echo -e "${RED}FAILED:  $FAIL${NC}"
echo -e "${YELLOW}WARNINGS: $WARN${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
    if [ "$WARN" -eq 0 ]; then
        echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║          ✅ ALL CHECKS PASSED - READY TO DEPLOY             ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Commit changes: git add . && git commit -m 'ready for deployment'"
        echo "2. Push to GitHub: git push origin main"
        echo "3. Deploy to Vercel: https://vercel.com/new"
        echo "4. Set GROQ_API_KEY on Vercel dashboard"
        echo "5. Test deployment URL"
        exit 0
    else
        echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║      ⚠️  CHECKS PASSED WITH WARNINGS - REVIEW ABOVE        ║${NC}"
        echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo "Warnings are not blocking but should be reviewed."
        echo "You can still deploy, but address warnings first if possible."
        exit 1
    fi
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║       ❌ CHECKS FAILED - REVIEW ERRORS ABOVE               ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Fix the errors above before deploying to Vercel."
    exit 1
fi
