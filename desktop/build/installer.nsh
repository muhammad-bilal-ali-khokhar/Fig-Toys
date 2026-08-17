# Custom NSIS include for Fig POS installer polish.

# Friendly welcome text on the assisted-installer welcome page.
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Fig POS Setup"
  !define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through installing Fig POS for New & used phones, IMEI tracking and Credit sales.$\r$\n$\r$\nClick Next to continue."
!macroend
