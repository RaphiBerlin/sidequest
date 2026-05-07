#!/bin/bash
# resume-build.sh — restart the sidequest task builder from where it left off
#
# Usage: bash scripts/resume-build.sh
#
# This script reads task-progress.json, finds the next pending Claude task,
# and opens a Claude Code session with the right prompt to continue building.
#
# Run this any time Claude hits a usage limit and you want to continue.

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROGRESS_FILE="$PROJECT_DIR/task-progress.json"
PROMPTS_FILE="$PROJECT_DIR/.claude/task-prompts.json"

# Find the next pending Claude task ID
NEXT_TASK=$(python3 -c "
import json
with open('$PROGRESS_FILE') as f:
    data = json.load(f)
pending = [t for t in data['tasks'] if t['status'] == 'pending' and t['who'] == 'Claude']
if pending:
    print(pending[0]['id'])
else:
    print('')
")

if [ -z "$NEXT_TASK" ]; then
    echo "✅ All Claude tasks are complete! Nothing to resume."
    exit 0
fi

TASK_TITLE=$(python3 -c "
import json
with open('$PROGRESS_FILE') as f:
    data = json.load(f)
task = next(t for t in data['tasks'] if t['id'] == $NEXT_TASK)
print(task['title'])
")

echo "▲ Resuming from Task $NEXT_TASK: $TASK_TITLE"
echo ""
echo "Opening Claude Code with resume prompt..."
echo ""

# Build the resume prompt
RESUME_PROMPT="You are continuing to build the Side/Quest app.

Project location: $PROJECT_DIR
Progress file: $PROGRESS_FILE
Task prompts file: $PROMPTS_FILE

INSTRUCTIONS:
1. Read $PROGRESS_FILE to see which tasks are done
2. Read $PROMPTS_FILE to get the prompt for the next pending task (task ID $NEXT_TASK)
3. Use the projectContext in task-prompts.json for full project context
4. Execute the task — write all required code files
5. Run: cd $PROJECT_DIR && npm run build
6. If build succeeds: update task-progress.json — set status to 'completed', add completedAt timestamp
7. If build fails: keep status 'pending', add error to notes field
8. Continue to the next pending task and repeat
9. When done or if you hit limits: write a summary to $PROJECT_DIR/.claude/build-log.md

Start now by reading the progress file and executing task $NEXT_TASK."

# Launch claude with the resume prompt
cd "$PROJECT_DIR"
claude "$RESUME_PROMPT"
