' Launches supervise.cmd with no visible window. A shortcut set to "minimized"
' still flashes a console at logon and leaves a taskbar entry; this runs it
' genuinely hidden (0 = hidden, False = don't wait).
Set sh = CreateObject("WScript.Shell")
sh.Run """" & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\supervise.cmd""", 0, False
