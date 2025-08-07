# MREDEO Backend - Git Collaboration Guide

## 🔄 Daily Git Workflow for Team Collaboration

### 📅 **Morning Routine (Start of Work)**
```bash
# 1. Switch to main branch
git checkout main

# 2. Get latest changes from remote
git pull origin main

# 3. Create new branch for your feature
git checkout -b feature/authentication-fixes
# or
git checkout -b bugfix/otp-email-issue
# or  
git checkout -b improvement/database-optimization
```

### 💼 **During Work (Making Changes)**
```bash
# 1. Check what files you've changed
git status

# 2. Add specific files (recommended)
git add src/controllers/authController.js
git add src/services/emailService.js

# OR add all changes (use carefully)
git add .

# 3. Commit with descriptive message
git commit -m "feat: add dynamic OTP delivery for email and SMS"
# or
git commit -m "fix: resolve login issue with phone numbers"
# or
git commit -m "docs: update README with new authentication flow"
```

### 🌆 **Evening Routine (End of Work)**
```bash
# 1. Push your branch to remote
git push origin feature/authentication-fixes

# 2. Create Pull Request on GitHub
# (Done via GitHub web interface)

# 3. Switch back to main for next day
git checkout main
```

## 🔀 **Handling Team Changes**

### **Scenario 1: Colleague pushed changes to main**
```bash
# Update your local main branch
git checkout main
git pull origin main

# Update your feature branch with latest main
git checkout feature/your-feature
git merge main
# OR (cleaner history)
git rebase main
```

### **Scenario 2: Merge conflicts (multiple people edited same file)**
```bash
# When git merge/rebase shows conflicts
git status  # See conflicted files

# Edit files to resolve conflicts (remove <<<<<<< ======= >>>>>>> markers)
# Then:
git add .
git commit -m "resolve merge conflicts"
```

### **Scenario 3: Pull Request approved and merged**
```bash
# Delete your local feature branch
git checkout main
git pull origin main  # Get the merged changes
git branch -d feature/your-feature  # Delete local branch
git push origin --delete feature/your-feature  # Delete remote branch
```

## 🚨 **Emergency Procedures**

### **Undo last commit (not pushed yet)**
```bash
git reset --soft HEAD~1  # Keep changes, undo commit
# or
git reset --hard HEAD~1  # Discard changes and commit
```

### **Discard all local changes**
```bash
git checkout .  # Discard unstaged changes
git reset --hard origin/main  # Reset to remote main
```

### **Stash changes temporarily**
```bash
git stash  # Save current changes temporarily
git pull origin main  # Get updates
git stash pop  # Restore your changes
```

## 📝 **Commit Message Best Practices**

### **Format:**
```
type: brief description

Optional longer description
```

### **Types:**
- `feat:` New feature
- `fix:` Bug fix  
- `docs:` Documentation changes
- `style:` Code formatting (no logic changes)
- `refactor:` Code restructuring (no feature changes)
- `test:` Adding tests
- `chore:` Maintenance tasks

### **Examples:**
```bash
git commit -m "feat: add email OTP verification for user signup"
git commit -m "fix: resolve database connection timeout issue"
git commit -m "docs: update API endpoints in README"
git commit -m "refactor: optimize database query performance"
```

## 🏷️ **Branch Naming Conventions**

```bash
feature/user-authentication
feature/payment-processing
bugfix/login-error
bugfix/otp-delivery-failure
improvement/database-performance
hotfix/security-vulnerability
docs/api-documentation
```

## 👥 **Team Coordination**

### **Before Starting Work:**
```bash
# Always start with latest main
git checkout main
git pull origin main
git checkout -b feature/your-new-feature
```

### **Before Submitting Pull Request:**
```bash
# Make sure your branch is up to date
git checkout main
git pull origin main
git checkout feature/your-feature
git merge main  # Resolve any conflicts
git push origin feature/your-feature
```

### **Code Review Process:**
1. Create Pull Request on GitHub
2. Add colleagues as reviewers
3. Address review comments
4. Get approval
5. Merge to main
6. Delete feature branch

## 🔍 **Useful Inspection Commands**

```bash
# See what changed
git diff  # Unstaged changes
git diff --staged  # Staged changes
git diff main..feature/your-branch  # Compare branches

# See commit history
git log --oneline  # Compact view
git log --graph --oneline --all  # Visual branch history

# See who changed what
git blame filename.js  # See who wrote each line

# See all branches
git branch -a  # Local and remote branches
```

## 📊 **Project Status Commands**

```bash
# See current status
git status

# See remote repositories
git remote -v

# See all branches and their tracking
git branch -vv

# See what's different between branches
git diff main..develop
```

## 🔄 **Complete Example Workflow**

Here's a complete example of a day's work:

```bash
# Morning: Start work
git checkout main
git pull origin main
git checkout -b feature/improve-otp-system

# Work: Make changes to files
# ... edit files ...
git add src/controllers/authController.js
git add src/services/emailService.js
git commit -m "feat: add dynamic OTP delivery based on signup method"

# Continue working
# ... more changes ...
git add .
git commit -m "test: add validation for email and phone OTP delivery"

# Before finishing: Get latest changes
git checkout main
git pull origin main
git checkout feature/improve-otp-system
git merge main  # Handle any conflicts

# Push your work
git push origin feature/improve-otp-system

# Create Pull Request on GitHub
# Get it reviewed and merged

# Clean up
git checkout main
git pull origin main
git branch -d feature/improve-otp-system
```

## ⚠️ **Important Rules for Team**

1. **Never push directly to main** - Always use Pull Requests
2. **Always pull before starting new work**
3. **Use descriptive commit messages**
4. **Keep commits focused** - One feature/fix per commit
5. **Test before pushing** - Make sure code works
6. **Review before merging** - Have colleagues review your code
7. **Delete merged branches** - Keep repository clean

## 🛟 **When Things Go Wrong**

```bash
# If you accidentally committed to main
git reset --soft HEAD~1
git checkout -b feature/my-changes
git add .
git commit -m "proper commit message"

# If you need to undo a merge
git merge --abort  # During merge
git reset --hard HEAD~1  # After merge (dangerous!)

# If remote branch is ahead and you can't push
git pull --rebase origin feature/your-branch
```

This workflow will keep your team coordinated and prevent conflicts! 🚀
