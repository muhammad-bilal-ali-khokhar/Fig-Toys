# Custom NSIS include for Fig POS installer polish.

!macro customInit
  # On update, read the existing install location from the registry so the
  # installer overwrites in place instead of asking for a new directory.
  ${ifNot} ${isUpdated}
    ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "InstallLocation"
    ${if} $0 != ""
      StrCpy $INSTDIR $0
    ${endIf}
  ${endIf}
!macroend

# Friendly welcome text on the assisted-installer welcome page.
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Fig POS Setup"
  !define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through installing Fig POS for New & used phones, IMEI tracking and Credit sales.$\r$\n$\r$\nIf Fig POS is already installed, this will update it to the latest version.$\r$\n$\r$\nClick Next to continue."
!macroend
