# Sharing a plugin one account installed on its own with every account.
Source docs/demo/shared/style.tape
Output docs/media/plugins.gif

Hide
Type 'export HOME="$DEMO_HOME" PATH="$DEMO_BIN:$PATH" PS1="$ "' Enter
Type "clear" Enter
Show

Sleep 500ms
Type "billy" Sleep 400ms Enter
Sleep 1.5s

# account list → ⚙ Settings → Shared plugins
Down@300ms 4
Enter
Sleep 1s
Down@400ms 2
Sleep 500ms
Enter
Sleep 2.5s

# + Add shared plugin → From one of your accounts → oz-harness-support
Down@400ms 2
Sleep 500ms
Enter
Sleep 1.5s
Enter
Sleep 1.5s
Enter
Sleep 2s

# uninstall the client account's own copy: yes
Enter
Sleep 4s
