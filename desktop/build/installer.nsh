# Custom NSIS include for Fig POS installer polish.

# Set default install directory to C:\Wavlon Studio\Fig POS
!macro preInit
  SetRegView 64
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\Wavlon Studio\Fig POS"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\Wavlon Studio\Fig POS"
  SetRegView 32
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\Wavlon Studio\Fig POS"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\Wavlon Studio\Fig POS"
!macroend

# When the app is already installed, ask before overwriting. Uses the
# uninstall registry entry (written only by a real install) rather than
# InstallLocation, which preInit fakes to force the default folder. Skips in
# silent mode so OTA self-updates still install without prompts.
!macro customInit
  ${ifNot} ${Silent}
    ReadRegStr $0 HKCU "${UNINSTALL_REGISTRY_KEY}" "DisplayName"
    ${if} $0 == ""
      ReadRegStr $0 HKLM "${UNINSTALL_REGISTRY_KEY}" "DisplayName"
    ${endIf}
    ${if} $0 != ""
      MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 \
        "Fig POS is already installed.$\r$\n$\r$\nDo you want to update it to this version?$\r$\n$\r$\nChoose No to cancel and leave the current installation unchanged." \
        IDYES +2
      Abort
    ${endIf}
  ${endIf}
!macroend

# Friendly welcome text on the assisted-installer welcome page.
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Fig POS Setup"
  !define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through installing Fig POS for New & used phones, IMEI tracking and Credit sales.$\r$\n$\r$\nIf Fig POS is already installed, this will update it to the latest version.$\r$\n$\r$\nClick Next to continue."
!macroend
