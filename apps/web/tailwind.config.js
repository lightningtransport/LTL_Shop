/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        shop: {
          bg: '#0f1720',
          panel: '#172332',
          border: '#2a3b4f',
          accent: '#f5a623',
          accentDark: '#d4891a',
          muted: '#8fa3b8',
          danger: '#e5484d',
          success: '#30a46c',
        },
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 30px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
};
