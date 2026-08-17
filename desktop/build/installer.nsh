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

# Friendly welcome text on the assisted-installer welcome page.
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Fig POS Setup"
  !define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through installing Fig POS for New & used phones, IMEI tracking and Credit sales.$\r$\n$\r$\nIf Fig POS is already installed, this will update it to the latest version.$\r$\n$\r$\nClick Next to continue."
!macroend
