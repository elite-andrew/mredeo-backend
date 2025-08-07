# 🚀 MREDEO Backend - Admin Quick Reference

## ⚡ **Daily Commands**
```bash
# Morning check
git fetch && git status
git log --oneline --since="yesterday"

# Review pull request
git checkout feature/branch-name
npm test && npm run lint

# Merge approved changes
git checkout main
git merge feature/branch-name
git push origin main
```

## 🔍 **Code Review Checklist**
- [ ] Tests pass (`npm test`)
- [ ] Code style good (`npm run lint`)  
- [ ] No secrets in code
- [ ] Authentication/security unchanged
- [ ] Database queries in services (not controllers)

## 🚨 **Emergency Actions**
```bash
# Revert bad commit
git revert bad-commit-hash
git push origin main

# Rollback to last good state (CAREFUL!)
git reset --hard last-good-commit
git push origin main --force
```

## 👥 **Team Management**
```bash
# See team activity
git shortlog -sn --since="1 week ago"

# Review team member's work
git log --author="name" --oneline --since="1 week ago"
```

## 📋 **Weekly Tasks**
- [ ] Review security alerts
- [ ] Check `npm audit` and `npm outdated`
- [ ] Merge approved pull requests
- [ ] Create release if ready
- [ ] Clean up merged branches
