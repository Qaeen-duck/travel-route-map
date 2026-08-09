/** @type {import('tailwindcss').Config} */
// 附录 A.1「温暖水彩组」色板在这里落成主题色。
// 两套并存：CSS 变量（index.css 定义）+ Tailwind 语义色名。
// P0-7 引入 shadcn/ui 时 shadcn 走 CSS 变量那套，可直接复用同一组值，不用二次调色。
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        terracotta: 'rgb(var(--wc-terracotta) / <alpha-value>)',
        sage: 'rgb(var(--wc-sage) / <alpha-value>)',
        cream: 'rgb(var(--wc-cream) / <alpha-value>)',
        skyblue: 'rgb(var(--wc-skyblue) / <alpha-value>)',
        mustard: 'rgb(var(--wc-mustard) / <alpha-value>)',
        softbrown: 'rgb(var(--wc-softbrown) / <alpha-value>)',
        inkbrown: 'rgb(var(--wc-inkbrown) / <alpha-value>)',
        wash: 'rgb(var(--wc-wash) / <alpha-value>)',
        coral: 'rgb(var(--wc-coral) / <alpha-value>)'
      },
      fontFamily: {
        sans: ['PingFang SC', 'Source Han Sans SC', 'Noto Sans SC', 'system-ui', 'sans-serif'],
        hand: ['Caveat', 'Kalam', 'PingFang SC', 'cursive']
      }
    }
  },
  plugins: []
};
