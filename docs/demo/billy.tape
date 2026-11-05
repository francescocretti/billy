# The account list, settings, and "Where everything lives".
Source docs/demo/shared/style.tape
Output docs/media/billy.gif

Hide
Type 'export HOME="$DEMO_HOME" PATH="$DEMO_BIN:$PATH" PS1="$ "' Enter
Type "clear" Enter
Show

Sleep 500ms
Type "billy" Sleep 400ms Enter
Sleep 2s

# account list → ⚙ Settings
Down@400ms 4
Sleep 500ms
Enter
Sleep 2s

# Settings → Where everything lives
Down@400ms 4
Sleep 500ms
Enter
Sleep 4s

# the menu comes back on its first entry: ← Back is five down. Then launch "work".
Down@300ms 5
Sleep 500ms
Enter
Sleep 1.5s
Enter
Sleep 3s
