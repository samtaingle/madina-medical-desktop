/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          sidebar: '#0b192c',       // Deep royal midnight blue
          sidebarHover: '#1e3e62',  // Accent hover blue
          sidebarActive: '#1d4ed8', // Vibrant royal blue active indicator
          sidebarMuted: '#94a3b8',  // Soft slate text for unselected nav
          navy: '#0f172a',
          blue: '#1e40af',
          lightBlue: '#3b82f6',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
