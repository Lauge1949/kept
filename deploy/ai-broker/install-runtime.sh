#!/bin/sh
# Pin the Tingfinder AI broker runtime and write a review manifest. Runs as lauge, no sudo.
# Prints the one administrator command that approves exactly this runtime.
# Keyless: the broker is reachable only via its 0660 socket and the app's internal network.
set -eu
src=$(cd "$(dirname "$0")" && pwd)
share="$HOME/.local/share/tingfinder-ai"
runtime="$share/runtime"
config="$HOME/.config/tingfinder-ai"
sockdir="$HOME/.local/state/tingfinder-ai/socket"
umask 077
mkdir -p "$share" "$config" "$sockdir"
chmod 700 "$share" "$config"
chmod 750 "$sockdir"

new="$share/runtime.new"
[ -d "$new" ] && chmod -R u+w "$new" && rm -rf "$new"
mkdir -p "$new/native"
cp "$src/tingfinder_ai.py" "$src/test_tingfinder_ai.py" "$new/"
cp /srv/dba-platform/sandbox_agent.py /srv/dba-platform/provider_proxy.py "$new/"
claude=$(readlink -f "$HOME/.local/bin/claude")
codex=$(readlink -f "$HOME/.local/bin/codex")
cp "$claude" "$new/native/claude"
cp "$codex" "$new/native/codex"
cp "$(dirname "$codex")/codex-code-mode-host" "$new/native/codex-code-mode-host"
chmod 500 "$new/native/"*
chmod 400 "$new/"*.py
chmod 500 "$new/native" "$new"

python3 -I -B "$new/tingfinder_ai.py" --review > "$config/review.json"
python3 -I - "$config/review.json" <<'PY'
import json, sys
m = json.load(open(sys.argv[1]))
ok = m['negative_tests'] and all(m['native_canaries'].values())
print('negative_tests', m['negative_tests'], 'native_canaries', m['native_canaries'])
sys.exit(0 if ok else 1)
PY

if [ -d "$share/runtime.old" ]; then chmod -R u+w "$share/runtime.old"; rm -rf "$share/runtime.old"; fi
if [ -d "$runtime" ]; then mv "$runtime" "$share/runtime.old"; fi
mv "$new" "$runtime"
install -m 0644 "$src/tingfinder-ai.service" "$HOME/.config/systemd/user/tingfinder-ai.service"
systemctl --user daemon-reload
echo "Approve (administrator):"
echo "  sudo install -o root -g root -m 0644 $config/review.json /etc/agent-capabilities/tingfinder-ai.json"
echo "Then: systemctl --user enable --now tingfinder-ai.service (or restart)"
