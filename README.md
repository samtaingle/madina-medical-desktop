# Madina Medical (Pharmacy & Billing) Desktop Application

Production-ready, offline pharmacy management and medical billing desktop application.

## Stack
- **Desktop Shell:** Electron
- **Database:** SQLite (WAL mode)
- **Frontend:** React 18 + Vite + Tailwind CSS
- **Hardware Integration:** ESC/POS 58mm/80mm Thermal Printing, Direct USB Barcode Scanner, POS Hotkeys

## Project Structure
```
madina-medical-desktop/
├── electron/
│   ├── main.js              # Electron main process
│   ├── preload.js           # Context isolation bridge
│   ├── db/                  # SQLite connection and migration runner
│   └── hardware/            # ESC/POS printing and barcode listeners
├── src/
│   ├── main.jsx             # React entry point
│   ├── App.jsx              # Main application shell with royal-blue sidebar
│   ├── index.css            # Tailwind CSS styling
│   ├── components/          # Reusable UI & POS components
│   └── pages/               # Functional module views
├── package.json
├── vite.config.js
├── tailwind.config.js
└── electron-builder.yml
```

## Running the Application
- `npm run dev`: Runs Vite dev server and launches Electron concurrently.
- `npm run build`: Builds React frontend and packages Electron desktop installer.
