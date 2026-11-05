#!/usr/bin/env bash
# Regenerate the GIFs in docs/media/ with VHS (https://github.com/charmbracelet/vhs).
#
# Billy runs against a throwaway home directory with demo accounts, so no real
# path, email or account name ends up in a recording. `claude` is replaced by a
# stub: nothing here touches your real Claude Code setup.
#
#   brew install vhs
#   bash docs/demo/record.sh            # every tape
#   bash docs/demo/record.sh plugins    # just docs/demo/plugins.tape

set -euo pipefail

REPO=$(cd "$(dirname "$0")/../.." && pwd)
DEMO=$(mktemp -d)
trap 'rm -rf "$DEMO"' EXIT

DEMO_BIN="$DEMO/bin"       # billy, plus a claude stub
DEMO_HOME="$DEMO/home"     # a Billy user with three accounts and two shared plugins
DEMO_FRESH="$DEMO/fresh"   # a Claude Code user who has never run Billy

json() { mkdir -p "$(dirname "$1")"; cat > "$1"; }

# --- bin -------------------------------------------------------------------
mkdir -p "$DEMO_BIN"
ln -s "$REPO/index.mjs" "$DEMO_BIN/billy"
cat > "$DEMO_BIN/claude" <<'EOF'
#!/usr/bin/env bash
# Stub: pretend every `claude plugin uninstall` succeeds.
[ "$1 $2" = "plugin uninstall" ] && echo "✔ Successfully uninstalled plugin: ${3%@*} (scope: user)"
exit 0
EOF
chmod +x "$DEMO_BIN/claude"

# --- a Billy user ----------------------------------------------------------
H="$DEMO_HOME"
json "$H/.billy/settings.json" <<< '{ "language": "en" }'
json "$H/.billy/accounts.json" <<EOF
[
  { "id": "work", "name": "work", "configDir": "$H/.claude-work", "sharedResources": true },
  { "id": "personal", "name": "personal", "configDir": "$H/.claude", "sharedResources": true },
  { "id": "client", "name": "client", "configDir": "$H/.claude-client", "sharedResources": false }
]
EOF
mkdir -p "$H/.claude-work" "$H/.claude" "$H/.agents/skills/"{code-review,release-notes,tdd}

# Two shared plugins, cloned from GitHub exactly as Billy would.
mkdir -p "$H/.billy/repos" "$H/.billy/plugins"
git clone --quiet --depth 1 https://github.com/warpdotdev/claude-code-warp.git \
  "$H/.billy/repos/warpdotdev__claude-code-warp"
git clone --quiet --depth 1 https://github.com/Lestat86/software-engineering-foundation.git \
  "$H/.billy/repos/Lestat86__software-engineering-foundation"
ln -s ../repos/warpdotdev__claude-code-warp/plugins/warp "$H/.billy/plugins/warp"
ln -s ../repos/Lestat86__software-engineering-foundation "$H/.billy/plugins/sef"

# The client account installed a plugin on its own: the one to share.
json "$H/.claude-client/plugins/installed_plugins.json" <<'EOF'
{ "version": 2, "plugins": { "oz-harness-support@claude-code-warp": [{ "scope": "user" }] } }
EOF
json "$H/.claude-client/plugins/known_marketplaces.json" <<'EOF'
{ "claude-code-warp": { "source": { "source": "github", "repo": "warpdotdev/claude-code-warp" } } }
EOF

# --- a Claude Code user who has never run Billy ----------------------------
F="$DEMO_FRESH"
json "$F/.claude/.claude.json" <<< '{ "oauthAccount": { "emailAddress": "you@example.com" } }'
for i in $(seq 1 21); do mkdir -p "$F/.claude/projects/project-$i"; done
mkdir -p "$F/.agents/skills/code-review"

# --- record ----------------------------------------------------------------
export DEMO_BIN DEMO_HOME DEMO_FRESH
cd "$REPO"
mkdir -p docs/media
if [ $# -gt 0 ]; then
  for name in "$@"; do vhs "docs/demo/$name.tape"; done
else
  for tape in docs/demo/*.tape; do vhs "$tape"; done
fi
