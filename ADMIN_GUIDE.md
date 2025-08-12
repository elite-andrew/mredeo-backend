# 👑 MREDEO Backend - Repository Admin Guide

## 🎯 **Your Role as Repository Admin**

As the admin of the MREDEO backend repository, you're responsible for:
- 🔍 **Reviewing code changes** from team members
- 🔄 **Managing merges** and maintaining code quality
- 🚀 **Releasing stable versions** for production
- 🛡️ **Protecting the main branch** from breaking changes

## 📋 **Daily Admin Workflow**

### ⏰ **Morning Routine (5 minutes)**
```bash
# 1. Check for new pull requests
git fetch origin
git log --oneline origin/main..HEAD  # See what's ahead locally
git log --oneline HEAD..origin/main  # See what's new remotely

# 2. Review GitHub notifications
# - New pull requests from team members
# - Issues or bug reports
# - Security alerts
```

### 🔄 **Handling Team Member Changes**

#### **Scenario 1: Team Member Creates Pull Request**
```bash
# 1. Team member pushes to their branch
git checkout feature/new-auth-system
git push origin feature/new-auth-system

# 2. They create Pull Request on GitHub
# 3. You review on GitHub web interface

# 4. If approved, merge via GitHub UI or command line:
git checkout main
git pull origin main
git merge feature/new-auth-system
git push origin main
git branch -d feature/new-auth-system  # Clean up local branch
```

#### **Scenario 2: Direct Collaboration (Small Team)**
```bash
# 1. Check what colleagues have pushed
git fetch origin
git log --oneline HEAD..origin/main --author="colleague-name"

# 2. Review their changes
git diff HEAD..origin/main
git show commit-hash  # Review specific commits

# 3. If good, pull their changes
git pull origin main

# 4. Test locally, then confirm deployment
npm run test  # Run your tests
npm run lint  # Check code quality
```

### 🔍 **Code Review Best Practices**

#### **What to Check in Pull Requests:**
```bash
# 1. Run the changes locally
git checkout feature/branch-name
npm install  # Install any new dependencies
npm run test  # Run tests
npm run lint  # Check code style

# 2. Check specific files changed
git diff main..feature/branch-name
git diff main..feature/branch-name --name-only

# 3. Review sensitive files
git diff main..feature/branch-name -- src/controllers/
git diff main..feature/branch-name -- src/middleware/
git diff main..feature/branch-name -- package.json
```

#### **🚨 Red Flags to Watch For:**
- Changes to `.env` files (should only be `.env.example`)
- New dependencies without explanation
- Direct database queries in controllers (should use services)
- Hardcoded credentials or sensitive data
- Changes to authentication/security middleware

## 🛡️ **Branch Protection Strategy**

### **Recommended GitHub Settings:**
```
Repository Settings → Branches → Add Rule:
✅ Require pull request reviews before merging
✅ Require status checks to pass before merging  
✅ Require branches to be up to date before merging
✅ Include administrators (yes, even you!)
✅ Restrict pushes that create files over 100MB
```

### **Branch Naming Convention for Team:**
```
feature/description       # New features
bugfix/issue-number      # Bug fixes  
hotfix/critical-fix      # Emergency fixes
refactor/component-name  # Code improvements
docs/update-readme       # Documentation updates
```

## 🚀 **Release Management**

### **Creating Releases:**
```bash
# 1. Ensure main branch is stable
git checkout main
git pull origin main
npm run test
npm run lint

# 2. Update version and create tag
npm version patch  # or minor/major
git push origin main --tags

# 3. Create GitHub Release
# Use GitHub web interface to create release from tag
# Include changelog of what's new/fixed
```

### **Hotfix Process:**
```bash
# 1. Create hotfix branch from main
git checkout main
git checkout -b hotfix/critical-auth-bug

# 2. Fix the issue
# Edit files...
git add .
git commit -m "hotfix: fix critical authentication vulnerability"

# 3. Merge back immediately
git checkout main  
git merge hotfix/critical-auth-bug
git push origin main

# 4. Create emergency patch release
npm version patch
git push origin main --tags

# 5. Deploy immediately
```

## 👥 **Team Collaboration Commands**

### **Managing Team Members:**
```bash
# See who's been contributing
git shortlog -sn  # Commit count by author
git log --author="team-member-name" --oneline --since="1 week ago"

# Review team member's work
git log --author="fidelis" --oneline --graph --since="2 weeks ago"
git diff --author="fidelis" HEAD~10..HEAD
```

### **Handling Merge Conflicts (Your Responsibility):**
```bash
# When automatic merge fails
git merge feature/team-member-branch
# CONFLICT (content): Merge conflict in src/controllers/authController.js

# 1. Open conflicted files and resolve
code src/controllers/authController.js  # Edit manually

# 2. Mark as resolved
git add src/controllers/authController.js
git commit -m "merge: resolve conflict in authController"

# 3. Push resolved merge
git push origin main
```

## 📊 **Monitoring Repository Health**

### **Weekly Health Checks:**
```bash
# 1. Check repository size
git count-objects -vH

# 2. Review open issues and PRs
# Do this on GitHub web interface

# 3. Check for outdated dependencies  
npm audit
npm outdated

# 4. Review recent commits
git log --oneline --since="1 week ago" --graph

# 5. Check for secrets accidentally committed
git log --all --full-history -- **/.env
git log --all --full-history -p -S "password" # Search for potential secrets
```

### **Security Monitoring:**
```bash
# Check for sensitive files
find . -name "*.env" -not -path "./node_modules/*"
find . -name "*key*" -not -path "./node_modules/*" -not -name "*.md"

# Review authentication changes
git log --oneline -p -- src/middleware/auth.js
git log --oneline -p -- src/controllers/authController.js
```

## 🔧 **Emergency Procedures**

### **If Main Branch Breaks:**
```bash
# 1. Immediately revert the bad commit
git log --oneline -10  # Find the bad commit
git revert bad-commit-hash
git push origin main

# 2. Or rollback to last known good state
git reset --hard last-good-commit-hash
git push origin main --force  # ⚠️ Only as admin!
```

### **If Sensitive Data Committed:**
```bash
# 1. Remove from history (use carefully!)
git filter-branch --force --index-filter \
'git rm --cached --ignore-unmatch path/to/sensitive-file' \
--prune-empty --tag-name-filter cat -- --all

# 2. Force push (as admin)
git push origin --force --all

# 3. Change any exposed credentials immediately
```

## 📞 **Communication Guidelines**

### **When to Notify Team:**
- 🚨 **Immediately**: Security issues, main branch breaks
- 📅 **Daily**: New releases, major merges  
- 📊 **Weekly**: Dependency updates, repository health

### **Example Team Communication:**
```
📢 MREDEO Backend Update
🔄 Merged: Dynamic OTP delivery system (#PR-123)
🆕 Features: Email OTP support, phone/email validation
🧪 Testing: All tests passing
🚀 Ready for: Development environment deployment
⚠️ Action needed: Update your local main branch
```

## 🎯 **Success Metrics to Track**

- ✅ **Zero breaking builds** on main branch
- ⚡ **Pull requests reviewed** within 24 hours  
- 🔒 **No secrets** committed to repository
- 📈 **Test coverage** maintained or improved
- 🚀 **Regular releases** (weekly/bi-weekly)

---

**Remember**: As admin, you're the gatekeeper of code quality. When in doubt, ask for clarification before merging! 🛡️

## 🔗 **Quick Reference**

```bash
# Daily commands
git fetch && git status
git log --oneline --since="yesterday"

# Review commands  
git diff main..feature/branch
git log --author="name" --since="1 week ago"

# Admin commands
git merge feature/branch
git push origin main
git tag v1.2.3 && git push --tags

# Emergency commands
git revert commit-hash
git reset --hard last-good-commit
```

**Pro Tip**: Set up GitHub notifications on your phone for the MREDEO repository so you can respond quickly to urgent issues! 📱
