/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}"
    ],
    theme: {
        extend: {
            colors: {
                // Casino theme - elegant dark green table
                casino: {
                    felt: '#0d5c2e',
                    'felt-dark': '#073d1d',
                    'felt-light': '#1a7a42',
                    gold: '#d4af37',
                    'gold-light': '#f4cf57',
                    border: '#2a5a3a',
                },
                // Card colors
                card: {
                    red: '#dc2626',
                    black: '#1f2937',
                    back: '#1e3a5f',
                }
            },
            fontFamily: {
                display: ['Outfit', 'sans-serif'],
                body: ['Inter', 'sans-serif'],
            },
            animation: {
                'card-deal': 'card-deal 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                'chip-bounce': 'chip-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                'win-pulse': 'win-pulse 1.5s ease-in-out infinite',
                'blackjack-reveal': 'blackjack-reveal 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                'shake': 'shake 0.4s ease-in-out',
            },
            keyframes: {
                'card-deal': {
                    '0%': { transform: 'translateX(-300px) translateY(-200px) rotate(-15deg)', opacity: '0' },
                    '100%': { transform: 'translateX(0) translateY(0) rotate(0)', opacity: '1' },
                },
                'chip-bounce': {
                    '0%': { transform: 'translateY(-100px) scale(0)', opacity: '0' },
                    '60%': { transform: 'translateY(10px) scale(1.1)', opacity: '1' },
                    '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
                },
                'win-pulse': {
                    '0%, 100%': { boxShadow: '0 0 0 0 rgba(0, 255, 65, 0.4)' },
                    '50%': { boxShadow: '0 0 30px 15px rgba(0, 255, 65, 0.2)' },
                },
                'blackjack-reveal': {
                    '0%': { transform: 'scale(0.3) rotate(-30deg)', opacity: '0', filter: 'blur(10px)' },
                    '50%': { transform: 'scale(1.3) rotate(5deg)', filter: 'blur(0)' },
                    '70%': { transform: 'scale(0.9) rotate(-2deg)' },
                    '100%': { transform: 'scale(1) rotate(0)', opacity: '1' },
                },
                'shake': {
                    '0%, 100%': { transform: 'translateX(0)' },
                    '20%': { transform: 'translateX(-10px)' },
                    '40%': { transform: 'translateX(10px)' },
                    '60%': { transform: 'translateX(-10px)' },
                    '80%': { transform: 'translateX(10px)' },
                },
            },
            perspective: {
                '1000': '1000px',
            }
        },
    },
    plugins: [],
}
