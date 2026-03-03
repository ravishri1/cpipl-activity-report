@echo off
cd /d "D:\Activity Report Software"
echo Adding all changes...
git add -A
echo Committing changes...
git commit -m "Deploy: Production-Ready System"
echo Pushing to remote...
git push origin main
echo Deployment complete!
pause