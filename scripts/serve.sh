#!/bin/bash
# Local only: (re)start the stack and the built app on :3000.
/home/claude/stack/start-stack.sh >/dev/null
pkill -f "tests/stubs/server.mjs" 2>/dev/null; (cd "$(dirname $0)/.." && nohup node tests/stubs/server.mjs > /dev/null 2>&1 &)
pkill -f "next start" 2>/dev/null; pkill -f "next-server" 2>/dev/null; sleep 1
cd "$(dirname $0)/.." && nohup npx next start -p 3000 > /tmp/claude-0/-home-claude/467e0814-0f6f-5ae9-a323-9fc71cc6ac47/scratchpad/next.log 2>&1 &
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:3000/ && break; sleep 0.5; done
curl -s -o /dev/null -w "app %{http_code}\n" http://localhost:3000/
