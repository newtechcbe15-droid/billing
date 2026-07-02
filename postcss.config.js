export default {
  plugins: {
    // 1. Injects the Tailwind CSS atomic utility engine compilation pass
    tailwindcss: {},
    
    // 2. Automatically tracks target browser rules to append CSS vendor engine prefixes
    autoprefixer: {},
  },
}