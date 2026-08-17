# Custom NSIS include for Fig POS installer polish.

!macro customInit
  # Detect existing installation — if already installed, use that directory
  # so the installer updates in place instead of creating a second copy.
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "InstallLocation"
  StrCmp $0 "" done
    StrCpy $INSTDIR $0
  done:
!macroend

# Friendly welcome text on the assisted-installer welcome page.
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Fig POS Setup"
  !define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through installing Fig POS for New & used phones, IMEI tracking and Credit sales.$\r$\n$\r$\nIf Fig POS is already installed, this will update it to the latest version.$\r$\n$\r$\nClick Next to continue."
!macroend
